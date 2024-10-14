import { createServer, IncomingMessage } from 'node:http'
import { fileURLToPath } from 'node:url'
import { dirname, extname, join, relative, resolve } from 'node:path'
import fs from 'node:fs'
import { opendir, mkdir, readFile, writeFile, cp } from 'node:fs/promises'
import EventEmitter from 'node:events'
import { Server as SocketServer } from 'socket.io'
import createDebug from 'debug'
import pkg from './package.json' with {type: 'json'}
import { Template } from './src/Template.mjs'
import { TemplateMarkdown } from './src/TemplateMarkdown.mjs'
import { RequestParams } from './src/RequestParams.mjs'
import { ChokidarWannabee } from './src/ChokidarWannabee.mjs'
import { UriToStaticFileRoute } from './src/UriToStaticFileRoute.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PAGES = join(__dirname, 'pages')
const SITE_FOLDER = '_site'
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
    TEMPLATE_RENDERED: 'template rendered',
    STATIC_SITE_GENERATED: 'static site generated',
    PRE_TEMPLATE_RENDER: 'pre template render'
}

async function* readAllFiles(folder) {
    const dir = await opendir(folder);
    for await (const dirent of dir) {
        const entryPath = join(folder, dirent.name);
        if (dirent.isDirectory()) {
            yield* readAllFiles(entryPath)
        } else {
            yield entryPath
        }
    }
}

function ifSlashAddIndex(pathname) {
    let modifiedPathname = pathname
    if (/\/$/.test(modifiedPathname)) {
        modifiedPathname = `${modifiedPathname}index.html`
    }
    return modifiedPathname
}

async function * loadPlugins() {
    for await (const file of await opendir(join(__dirname, 'plugins'))) {
        if (file.isDirectory()) continue
        if (extname(file.name) !== '.mjs') continue
        yield await import(join(file.path, file.name))
    }
}

function getTemplate(ext) {
    switch (ext) {
        case '.md':
            return new TemplateMarkdown(readFile)
        case '.html':
            return new Template(readFile)
        default:
            return null
    }
}

async function renderTemplate(filePath, routes, layouts, initialContext = {}) {
    let ext = extname(filePath)
    debug('rendering template', filePath)
    let content = await readFile(filePath, 'utf-8')
    let template = getTemplate(ext)
    process.emit(EVENTS.PRE_TEMPLATE_RENDER, filePath, initialContext, content)
    debug('prerender', filePath)
    let output = await template.render(content, initialContext)
    if (template.context.route) {
        routes.add(new UriToStaticFileRoute(template.context.route, resolve(__dirname, filePath), renderTemplate))
    }
    if (template.context.layout) {
        let keyName = resolve(__dirname, template.context.layout)
        let key = layouts.get(keyName)
        if (!key) {
            layouts.set(keyName, new Set())
            key = layouts.get(keyName)
        }
        key.add(resolve(__dirname, filePath))
    }
    process.emit(EVENTS.TEMPLATE_RENDERED, filePath, template.context, output)
    return { output, template, routes, layouts }
}

async function generateStaticSite(renderTemplate) {
    let routes = new Set()
    let layouts = new Map()
    try{await mkdir(SITE_FOLDER)}catch(e){}
    for await (let folder of Array.from(['js', 'css', 'images'])) {
        await cp(join(PAGES, folder), join(SITE_FOLDER, folder), { recursive: true })
    }
    for await (const file of readAllFiles(PAGES)) {
        await genFile(file, renderTemplate, routes, layouts)
    }
    process.emit(EVENTS.STATIC_SITE_GENERATED, routes, layouts)
    return { routes, layouts }
}

async function genFile(file, renderTemplate, routes, layouts) {
    // TODO: This strategy is not robust. It should be improved.
    if (file.includes('layout')) return
    let ext = extname(file)
    if (!['.md', '.html'].includes(ext)) return
    let newFileName = file.replace('.md', '.html').replace(PAGES, SITE_FOLDER)
    await mkdir(dirname(newFileName), { recursive: true })
    const { output, template } = await renderTemplate(file, routes, layouts, { req: new IncomingMessage(), res: new IncomingMessage()})
    await writeFile(newFileName, output)
    return {routes, layouts}
}

async function broadcast(filePath, hotReloadNamespace, routes, layouts, clients) {
    const relativePath = relative(PAGES, filePath)
    const ext = extname(filePath)
    await genFile(filePath, renderTemplate, routes, layouts)
    for (const [socketId, context] of clients.entries()) {
        const route = routes.values().find(route => route.match(context.url.pathname))
        debug('file changing', context.url.pathname, relativePath, route)
        if (context.url.pathname.replace(ext, '').includes(relativePath.replace(ext, '')) || route) {
            filePath = route ? route.filePath : filePath
            const { output, template } = await renderTemplate(filePath, routes, layouts, {req: context.req, res: context.res})
            hotReloadNamespace.to(socketId).emit('file changed', { fileName: relativePath, data: output })
        }
    }
}

async function main (server) {
    for await (const plugin of loadPlugins()) {
        await plugin.default()
    }

    const { routes, layouts } = await generateStaticSite(renderTemplate)
    const io = new SocketServer(server)
    const clients = new Map()
    const hotReloadNamespace = io.of('/hot-reload')
    const chokidar = new ChokidarWannabee(PAGES, async (folder, event, filePath, absolutePath) => {
        let key = layouts.get(absolutePath)
        if (!key) return false
        for await (const file of key) {
            debug('in delegate', file)
            await chokidar.fire(dirname(file), event, filePath)
        }
        return true
    })

    hotReloadNamespace.on('connection', socket => {
        debug('connected %s', socket.id)
        const url = new URL(socket.handshake.headers.referer)
        url.pathname = ifSlashAddIndex(url.pathname)
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

        url.pathname = ifSlashAddIndex(url.pathname)
        const route = routes.values().find(route => route.match(url.pathname))
        if (route) {
            const ext = extname(req.url).substring(1)
            const params = new RequestParams(req.urlParsed, route.regex)
            debug('handling route', req.url, params)
            res.setHeader('Content-Type', CONTENT_TYPE[ext] ?? 'text/html')
            const { output, template } = await renderTemplate(route.filePath, routes, layouts, {req, res, params })
            return res.end(output)
        }
    
        try {
            const ext = extname(url.pathname).substring(1)
            if (ext) {
                await fs.promises.access(join(SITE_FOLDER, url.pathname), fs.constants.F_OK)
                res.setHeader('Content-Type', CONTENT_TYPE[ext] ?? 'application/octet-stream')
                return fs.createReadStream(join(SITE_FOLDER, url.pathname)).pipe(res)
            }
        } catch (e) {
            debug('File not found', e)
        }
    
        res.statusCode = 404
        res.end()
    })

    Array('add', 'change').forEach(event => {
        chokidar.watch(PAGES).on(event, async (filePath, stats) => {
            await broadcast(filePath, hotReloadNamespace, routes, layouts, clients)
        })
    })
    
    server.listen(process.env.PORT ?? 3000, () => {
        createDebug.log(`Server running at http://localhost:${server.address().port}/`)
    })
}

const server = createServer({ IncomingMessage: IncomingMessageOnRequest })

main(server)

export {
    server,
    EVENTS
}