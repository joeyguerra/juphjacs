import { createServer, IncomingMessage } from 'node:http'
import { fileURLToPath } from 'node:url'
import { dirname, extname, join, relative, resolve } from 'node:path'
import fs from 'node:fs'
import EventEmitter from 'node:events'
import vm, { SyntheticModule, SourceTextModule } from 'node:vm'
import { Server as SocketServer } from 'socket.io'
import createDebug from 'debug'
import pkg from './package.json' with {type: 'json'}
import { Template } from './src/Template.mjs'
import { RequestParams } from './src/RequestParams.mjs'

class IncomingMessageOnSocket extends IncomingMessage {
    constructor(socket, urlParsed) {
        super(socket)
        this.urlParsed = urlParsed
    }
}

class IncomingMessageOnRequest extends IncomingMessage {
    constructor(req) {
        super(req)
        this.urlParsed = new URL(req.url ?? '/', `http://${req.headers?.host ?? 'localhost'}`)
    }
}

const PACKAGE_NAME = `${pkg.name}:server`
const debug = createDebug(PACKAGE_NAME)

const EVENTS = {
    TEMPLATE_RENDERED: 'template rendered'
}
const server = createServer({ IncomingMessage: IncomingMessageOnRequest })
const __dirname = dirname(fileURLToPath(import.meta.url))
const io = new SocketServer(server)
const clients = new Map()
const PUBLIC = join(__dirname, 'public')
const CONTENT_TYPE = {
    css: 'text/css',
    html: 'text/html',
    js: 'text/javascript',
    json: 'application/json',
    png: 'image/png',
    jpg: 'image/jpg',
    svg: 'image/svg+xml',
    mjs: 'text/javascript'
}
class UriToStaticFileRoute {
    constructor(regex, filePath) {
        this.regex = regex
        this.filePath = filePath
    }
    match(uri) {
        return this.regex.test(uri)
    }
    async handle(req, res) {
        const ext = extname(req.url).substring(1)
        const params = new RequestParams(req.urlParsed, this.regex)
        debug('handling route', req.url, params.year)
        res.setHeader('Content-Type', CONTENT_TYPE[ext] ?? 'text/html')
        const { output, template } = await renderTemplate(this.filePath, layouts, {req, res, params })
        res.end(output)
    }
}

const routes = new Set()
const hotReloadNamespace = io.of('/hot-reload')
hotReloadNamespace.on('connection', socket => {
    debug('connected %s', socket.id)
    const url = new URL(socket.handshake.headers.referer)
    if (url.pathname === '/') {
        url.pathname = '/index.html'
    }
    const req = new IncomingMessageOnSocket(socket, url)
    req.method = 'GET'
    req.url = url.pathname
    req.headers = socket.handshake.headers
    clients.set(socket.id, {url, req, res: null})

    socket.on('disconnect', () => {
        clients.delete(socket.id)
        debug('user disconnected %s', socket.id)
    })
    socket.on('chat message', msg => {
        debug('message is %s', msg)
    })
})

server.on('request', async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`)
    if (url.pathname.indexOf('socket.io') > -1) return
    if (url.pathname.indexOf('morphdom-esm.js') > -1) {
        res.setHeader('Content-Type', 'text/javascript')
        fs.createReadStream(join(__dirname, 'node_modules/morphdom/dist/morphdom-esm.js')).pipe(res)
        return
    }
    const route = routes.values().find(route => route.match(url.pathname))
    debug('on server rquest', route, url.pathname)
    if (route) {
        return await route.handle(req, res)
    }
    if (/\/$/.test(url.pathname)) {
        url.pathname = `${url.pathname}index.html`
    }
    try {
        await fs.promises.access(join(PUBLIC, url.pathname), fs.constants.F_OK)
    } catch (e) {
        debug(e)
        res.statusCode = 404
        res.end()
        return
    }
    const ext = extname(url.pathname).substring(1)
    res.setHeader('Content-Type', CONTENT_TYPE[ext] ?? 'application/octet-stream')
    if (ext === 'html') {
        const filePath = join(PUBLIC, url.pathname)
        const { output, template } = await renderTemplate(filePath, layouts, {req, res})
        res.end(output)
    } else {
        fs.createReadStream(join(PUBLIC, url.pathname)).pipe(res)
    }
})

async function renderTemplate(filePath, layouts, initialContext = {}) {
    let content = await fs.promises.readFile(filePath, 'utf-8')
    let template = new Template(fs.promises.readFile)
    const output = await template.render(content, initialContext)
    if (template.context.layout) {
        let keyName = resolve(__dirname, template.context.layout)
        let key = layouts.get(keyName)
        if (!key) {
            layouts.set(keyName, new Set())
            key = layouts.get(keyName)
        }
        key.add(filePath)
    }
    if (template.context.route) {
        routes.add(new UriToStaticFileRoute(template.context.route, filePath))
    }
    process.emit(EVENTS.TEMPLATE_RENDERED, filePath, output)
    return { output, template }
}
async function compileTemplates(dir) {
    const templates = new Map()
    const layouts = new Map()
    for await (const file of dir) {
        if (file.isDirectory()) {
            await compileTemplates(await fs.promises.opendir(join(file.path, file.name), { recursive: true}))
        } else {
            if (!['.html'].includes(extname(file.name))) continue
            const filePath = resolve(dir.path, file.name)
            let content = await fs.promises.readFile(filePath, 'utf-8')
            let template = new Template(fs.promises.readFile)
            try {
                const output = await template.render(content, { req: new IncomingMessage(), res: new IncomingMessage() })
                debug('rendering', file.name)
            } catch(e) {

            }
            if (template.context.route) {
                routes.add(new UriToStaticFileRoute(template.context.route, filePath))
            }
            if (template.context.layout) {
                const keyName = resolve(__dirname, template.context.layout)
                let key = layouts.get(keyName)
                if (key) {
                    key.add(filePath)
                } else {
                    layouts.set(keyName, new Set([filePath]))
                }
            }
        }
    }
    return { templates, layouts }
}

async function broadcast(filePath, stats, layouts) {
    const relativePath = relative(PUBLIC, filePath)
    for (const [socketId, context] of clients.entries()) {
        if (context.url.pathname.includes(relativePath)) {
            const { output, template } = await renderTemplate(filePath, layouts, {req: context.req, res: context.res})
            hotReloadNamespace.to(socketId).emit('file changed', { fileName: relativePath, data: output })
        }
    }
}

class ChokidarWannabee extends EventEmitter {
    constructor(folder, layouts) {
        super()
        this.folder = folder
        this.layouts = layouts
        this.debounceTimers = new Map()
    }
    mapEvent(event) {
        switch (event) {
            case 'rename':
                return 'change'
            default:
                return event
        }
    }
    watch(folder) {
        fs.watch(folder,  { recursive: true }, this.fire.bind(this, folder))
        return this
    }
    async fire (folder, event, filename) {
        const eventName = this.mapEvent(event)
        const absolutePath = resolve(folder, filename)
        const debounceKey = `${absolutePath}-${eventName}`
        if (this.debounceTimers.has(debounceKey)) {
            clearTimeout(this.debounceTimers.get(debounceKey))
        }
        let key = this.layouts.get(absolutePath)
        if (key) {
            for await (const filePath of key) {
                await this.fire(dirname(filePath), event, filePath)
            }
            return
        }
        this.debounceTimers.set(debounceKey, setTimeout(async () => {
            try {
                const stats = await fs.promises.stat(absolutePath)
                if (stats.isDirectory()) return
                this.emit(eventName, absolutePath, stats)
            } catch (e) {
                if (e.code === 'ENOENT') {
                    this.emit('warning', e)
                } else {
                    this.emit('error', e)
                }
            }
        }, 300))
    }
}

const { templates, layouts } = await compileTemplates(await fs.promises.opendir(PUBLIC, { recursive: true}))
const chokidar = new ChokidarWannabee(PUBLIC, layouts)
Array('add', 'change').forEach(event => {
    chokidar.watch(PUBLIC).on(event, async (filePath, stats) => {
        await broadcast(filePath, stats, chokidar.layouts)
    })
})

const plugins = []
server.listen(process.env.PORT ?? 3000, async () => {
    const pluginsDir = await fs.promises.opendir(join(__dirname, 'plugins'))
    for await (const file of pluginsDir) {
        if (file.isDirectory()) continue
        if (extname(file.name) !== '.mjs') continue
        const plugin = await import(join(__dirname, 'plugins', file.name))
        plugins.push(plugin.default)
    }
    plugins.forEach(plugin => plugin(server, debug))
    createDebug.log(`Server running at http://localhost:${server.address().port}/`)
})

export {
    server,
    EVENTS
}