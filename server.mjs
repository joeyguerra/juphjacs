import { createServer, IncomingMessage, ServerResponse } from 'node:http'
import { fileURLToPath } from 'node:url'
import { dirname, extname, join, relative, resolve } from 'node:path'
import fs from 'node:fs'
import { opendir, mkdir, readFile, writeFile, cp } from 'node:fs/promises'
import EventEmitter from 'node:events'
import { Server as SocketServer } from 'socket.io'
import createDebug from 'debug'
import pkg from './package.json' with {type: 'json'}
import { RequestParams } from './src/RequestParams.mjs'
import { ChokidarWannabee } from './src/ChokidarWannabee.mjs'
import { Writable } from 'node:stream'
import { UriToStaticFileRoute } from './src/UriToStaticFileRoute.mjs'
import MarkdownIt from 'markdown-it'
import { TemplateLiteralRenderer } from './src/TemplateLiteralRenderer.mjs'
import { MarkdownRenderer } from './src/MarkdownRenderer.mjs'
import { XmlRenderer } from './src/XmlRenderer.mjs'
import { TemplateRendererFactory } from './src/TemplateRendererFactory.mjs'
import { Page } from './src/Page.mjs'

const DEBUG = process.env.DEBUG

class Logger extends Writable {
    constructor(name, debug, options = {}) {
        super({...options, objectMode: true})
        this.name = name
        this.debug = debug
    }

    _write(chunk, encoding, callback) {
        process.stdout.write(chunk + '\n\n', callback)
    }

    debug (message, label) {
        if (!this.debug) return
        if (this.debug !== 'debug') return
        this.log(message, label, 'debug')
    }

    info (message, label) {
        if (!this.debug) return
        if (this.debug !== 'info') return
        this.log(message, label, 'info')
    }

    warn (message, label) {
        if (!this.debug) return
        if (this.debug !== 'warn') return
        this.log(message, label, 'warn')
    }

    error (message, label) {
        if (!this.debug) return
        if (this.debug !== 'error') return
        this.log(message, label, 'error')
    }

    log(message, label, level = 'info') {
        if (typeof message === 'object') {
            message = { ...message, time: new Date(), name: this.name }
        } else {
            message = { message, time: new Date() }
        }
        message = JSON.stringify(message, (key, value) => value instanceof Set ? [...value] : value)
        this.write(`\x1b[34m${level.toUpperCase()} ${label ? `[${new Date().toISOString()}] ${label}:` : `[${new Date().toISOString()}]`}\x1b[0m ${message}`)
    }
}

const PACKAGE_NAME = `${pkg.name}:server`
const debug = createDebug(PACKAGE_NAME)
const logger = new Logger(pkg.name, DEBUG)
const __dirname = dirname(fileURLToPath(import.meta.url))
const PAGES = join(__dirname, 'pages')
const SITE_FOLDER = '_site'
const CONTENT_TYPE = {
    css: 'text/css',
    ico: 'image/x-icon',
    html: 'text/html',
    txt: 'text/plain',
    js: 'text/javascript',
    json: 'application/json',
    png: 'image/png',
    jpg: 'image/jpg',
    svg: 'image/svg+xml',
    mjs: 'text/javascript',
    webp: 'image/webp',
    xml: 'application/xml'
}
const EVENTS = {
    TEMPLATE_RENDERED: 'template rendered',
    STATIC_SITE_GENERATED: 'static site generated',
    PRE_TEMPLATE_RENDER: 'pre template render'
}


class IncomingMessageOnSocket extends IncomingMessage {
    constructor(socket, urlParsed) {
        super(socket)
        this.urlParsed = urlParsed
        this.res = new ServerResponse(this)
    }
}

class IncomingMessageOnRequest extends IncomingMessage {
    constructor(req) {
        super(req)
        this.urlParsed = new URL(req.url ?? '/', `http://${req.headers?.host ?? 'localhost'}`)
    }
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
        yield await import(join(file.parentPath, file.name))
    }
}

async function * loadMiddlewares() {
    for await (const file of await opendir(join(__dirname, 'middlewares'))) {
        if (file.isDirectory()) continue
        if (extname(file.name) !== '.mjs') continue
        yield await import(join(file.parentPath, file.name))
    }
}


const filesToCopyOver = Array.from(['favicon.ico', 'robots.txt'])
const foldersToCopyOver = Array.from(['js', 'css', 'images'])

class SiteGenerator {
    constructor() {
        this.routes = new Set()
        this.layouts = new Map()
        this.localImports = new Map()
    }

    async * readAllFiles (folder) {
        const dir = await opendir(folder);
        for await (const dirent of dir) {
            const entryPath = join(folder, dirent.name);
            if (dirent.isDirectory()) {
                yield* this.readAllFiles(entryPath)
            } else {
                yield entryPath
            }
        }
    }
    async copyFoldersFrom(source, destination) {
        const dir = await opendir(source)
        for await (let folder of dir) {
            try {
                await this.copyFileFrom(join(folder.parentPath, folder.name), join(destination, folder.name))
            } catch (e) {
                logger.error({error: e, message: 'error copying folders from'}, 'copyFoldersFrom')
            }
        }
    }
    
    async copyFileFrom(file, destination) {
        try {
            await cp(file, destination, { recursive: true })
        } catch (e) {
            logger.error(e, 'error - copyFileFrom')
        }
    }
    
    async generateStaticSite() {
        try{await mkdir(SITE_FOLDER)}catch(e){}

        await this.copyFileFrom(join(__dirname, 'node_modules/morphdom/dist/morphdom-esm.js'), join(SITE_FOLDER, 'morphdom', 'morphdom-esm.js'))
        
        for await (let file of filesToCopyOver) {
            await this.copyFileFrom(join(PAGES, file), join(SITE_FOLDER, file))
        }

        for await (let folder of foldersToCopyOver) {
            await this.copyFoldersFrom(join(PAGES, folder), join(SITE_FOLDER, folder))
        }

        for await (const file of this.readAllFiles(PAGES)) {
            let ext = extname(file)
            await this.genFile(file)
        }
        process.emit(EVENTS.STATIC_SITE_GENERATED, this.routes, this.layouts)
    }

    async genFile(file) {
        // TODO: This strategy is not robust. It might need to be improved.
        if (file.includes('layout')) return
        let ext = extname(file)
        if (!['.md', '.html', '.xml'].includes(ext)) return
        let newFileName = file.replace('.md', '.html').replace(PAGES, SITE_FOLDER)
        await mkdir(dirname(newFileName), { recursive: true })

        const req = new IncomingMessage()
        const res = new ServerResponse(req)
        req.url = `http://localhost/${relative(SITE_FOLDER, newFileName)}`
        req.urlParsed = new URL(req.url)
        req.params = new RequestParams(new URL(req.url), null)

        const page = await this.renderPage(file, { req, res })
        const importRegex = /import\s+{[^}]+}\s+from\s+['"]([^'"]+\.mjs)['"]/g
        if (page.output.includes('import') || page.output.includes('require')) {
            let match = null
            while ((match = importRegex.exec(page.output)) !== null) {
                let keyName = resolve(PAGES, match[1].replace(/^\//, ''))
                let key = this.localImports.get(keyName)
                if (!key) {
                    this.localImports.set(keyName, new Set())
                    key = this.localImports.get(keyName)
                }
                key.add(resolve(__dirname, file))
            }
        }

        const cssRegex = /<link[^>]+href="(?!http|https)([^"]+\.css)"[^>]*>/g
        if (page.output.includes('<link')) {
            let match = null
            while ((match = cssRegex.exec(page.output)) !== null) {
                let keyName = resolve(PAGES, 'css', match[1].replace(/^\//, ''))
                let key = this.localImports.get(keyName)
                if (!key) {
                    this.localImports.set(keyName, new Set())
                    key = this.localImports.get(keyName)
                }
                key.add(resolve(__dirname, file))
            }
        }

        const scriptRegex = /<script[^>]+src="(?!http|https)([^"]+)"[^>]*><\/script>/g
        if (page.output.includes('<script')) {    
            let match = null
            while ((match = scriptRegex.exec(page.output)) !== null) {    
                let keyName = resolve(PAGES, 'js', match[1].replace(/^\//, ''))
                let key = this.localImports.get(keyName)
                if (!key) {
                    this.localImports.set(keyName, new Set())
                    key = this.localImports.get(keyName)
                }
                key.add(resolve(__dirname, file))
            }
        }
        await writeFile(newFileName, page.output)
        return page
    }

    async renderPage(filePath, initialContext = {}) {
        let ext = extname(filePath)
        const rootFolder = dirname(filePath)
        let content = await readFile(filePath, 'utf-8')
        const templateRendererFactory = new TemplateRendererFactory(extname, [
            new MarkdownRenderer(resolve, readFile, new MarkdownIt({
                html: true,
                linkify: true,
                typographer: true
            })),
            new TemplateLiteralRenderer(resolve, readFile),
            new XmlRenderer(resolve, readFile)
        ])
        const page = new Page(rootFolder, filePath, content, templateRendererFactory)
        process.emit(EVENTS.PRE_TEMPLATE_RENDER, filePath, initialContext, content)
        const template = await page.render(initialContext)
        if (page.route) {
            this.routes.add(new UriToStaticFileRoute(page.route, resolve(__dirname, filePath)))
        }
        if (page.layout) {
            let keyName = resolve(__dirname, page.layout)
            let key = this.layouts.get(keyName)
            if (!key) {
                this.layouts.set(keyName, new Set())
                key = this.layouts.get(keyName)
            }
            key.add(resolve(__dirname, filePath))
        }
        if (page.init ) {
            page.init()
        }
        process.emit(EVENTS.TEMPLATE_RENDERED, filePath, page.context, page.output)
        return page
    }
}

const siteGenerator = new SiteGenerator()

async function broadcast(filePath, relativePath, hotReloadNamespace, clients) {
    const ext = extname(filePath)
    await siteGenerator.genFile(filePath)
    const resourcesFolders = ['js', 'css', 'images']
    if(resourcesFolders.some(folder => filePath.includes(join(PAGES, folder)))) {
        await siteGenerator.copyFileFrom(filePath, join(SITE_FOLDER, relativePath))
    }

    for (const [socketId, context] of clients.entries()) {
        const route = siteGenerator.routes.values().find(route => route.match(context.url.pathname))
        logger.info({ uri: context.url.pathname, filePath, relativePath}, 'broadcast')
        if (context.url.pathname.replace(ext, '').includes(relativePath.replace(ext, '')) || route) {
            filePath = route ? route.filePath : filePath
            const page = await siteGenerator.renderPage(filePath, {req: context.req, res: context.res})
            hotReloadNamespace.to(socketId).emit('file changed', {fileThatTriggeredIt: relativePath, fileName: relativePath, data: page.output })
        }

        if (siteGenerator.localImports.get(filePath)) {
            for (const file of siteGenerator.localImports.get(filePath)) {
                const relativeFileIncludes = relative(PAGES, file)
                const route = siteGenerator.routes.values().find(route => route.match(context.url.pathname))
                if (context.url.pathname.replace(ext, '').includes(relativeFileIncludes.replace(ext, '')) || route) {
                    const page = await siteGenerator.renderPage(file, {req: context.req, res: context.res})
                    hotReloadNamespace.to(socketId).emit('file changed', { fileThatTriggeredIt: relativePath, fileName: file, data: page.output })
                }
            }
        }
    }
}

const middlewares = new Set()

async function main (server, execute) {

    try {
        for await (const plugin of loadPlugins()) {
            await plugin.default()
        }
    } catch (e) {
        console.error(e)
    }

    try {
        for await (const middleware of loadMiddlewares()) {
            middlewares.add(await middleware.default())
        }    
    } catch (e) {
        console.error(e)
    }

    await siteGenerator.generateStaticSite()
    const io = new SocketServer(server)
    const clients = new Map()
    const hotReloadNamespace = io.of('/hot-reload')

    const chokidar = new ChokidarWannabee(PAGES, async (folder, event, filePath, absolutePath) => {
        let filesWithThisLayout = siteGenerator.layouts.get(absolutePath)
        if (!filesWithThisLayout) return false
        for await (const file of filesWithThisLayout) {
            await chokidar.fire(dirname(file), event, file)
        }
        return true
    })

    hotReloadNamespace.on('connection', socket => {
        logger.info({message: 'connected to hot reloading %s', id: socket.id}, 'hot-reload:connection')
        const url = new URL(socket.handshake.headers.referer)
        url.pathname = ifSlashAddIndex(url.pathname)
        const req = new IncomingMessageOnSocket(socket, url)
        req.method = 'GET'
        req.url = url.pathname
        req.headers = socket.handshake.headers
        logger.info({message: 'connecting to the hot-reload namespace', uri: url.pathname}, 'hot-reload:connection')
        clients.set(socket.id, {url, req, res: null})
        socket.on('disconnect', () => {
            clients.delete(socket.id)
            logger.info({message: '/hot-reload user disconnected %s', id: socket.id}, 'hot-reload:connection')
        })
    })
    
    io.on('connection', socket => {
        logger.info({message: `connected ${socket.id}`, referer: socket.handshake.headers.referer}, 'io:connection')
        const url = new URL(socket.handshake.headers.referer)
        url.pathname = ifSlashAddIndex(url.pathname)
        const req = new IncomingMessageOnSocket(socket, url)
        req.url = url.pathname
        req.urlParsed = url
        req.headers = socket.handshake.headers
        const route = routes.values().find(route => route.match(url.pathname))
        if (route) {
            req.params = new RequestParams(req.urlParsed, route.regex)
        }
        const res = req.res
        socket.on('chat message', async msg => {
            logger.info({message: 'chat message', msg}, 'chat message')
            if (msg.method) {
                req.method = msg.method
            }
            if (msg.headers) {
                req.headers = msg.headers
            }
            const params = new URLSearchParams(msg)
            const obj = {}
            for (const [key, value] of params.entries()) {
                obj[key] = value
            }
            req.body = obj
    
            for await (const middleware of middlewares.values()) {
                await middleware(req, res)
            }
            const ext = extname(url.pathname).substring(1)
            const { output, template } = await renderTemplate(route.filePath, routes, layouts, {req, res })
            const relativePath = relative(PAGES, route.filePath)
            socket.emit('chat message:response', {fileThatTriggeredIt: route.filePath, fileName: relativePath, data: output })
        })
    })

    const shortCircuitUrls = ['socket.io']
    const honeypoturls = []
    server.on('request', async (req, res) => {
        const url = new URL(req.url, `http://${req.headers.host}`)
        if (shortCircuitUrls.some(shortCircuitUrl => url.pathname.includes(shortCircuitUrl))) {
            return
        }

        for await (const middleware of middlewares.values()) {
            await middleware(req, res)
            if (res.headersSent) return
        }

        req.urlParsed = new URL(req.url ?? '/', `http://${req.headers?.host ?? 'localhost'}`)
        url.pathname = ifSlashAddIndex(url.pathname)
        const route = siteGenerator.routes.values().find(route => route.match(url.pathname))
        logger.info({url: req.urlParsed, headers: req.headers}, 'request')
        if (route) {
            const ext = extname(req.url).substring(1)
            req.params = new RequestParams(req.urlParsed, route.regex)
            logger.info({message: 'handling route', url: req.url}, 'route')
            const { output, template } = await siteGenerator.renderPage(route.filePath, {req, res })
            const method = req.method.toLowerCase()
            if (res.headersSent) return
            if (template.context && template.context[method]) {
                return await template.context[method](req, res)
            }
            res.setHeader('Content-Type', CONTENT_TYPE[ext] ?? 'text/html')
            return res.end(output)
        }

        req.params = new RequestParams(req.urlParsed, null)
        try {
            const ext = extname(url.pathname).substring(1)
            const isHoneypot = honeypoturls.includes(join(SITE_FOLDER, url.pathname))
            if (isHoneypot) {
                logger.info({message: 'honeypot', url: url.pathname, status: 404}, 'honeypot')
                res.statusCode = 404
                return res.end('Not found')
            }

            if (ext) {
                await fs.promises.access(join(SITE_FOLDER, url.pathname), fs.constants.F_OK)
                res.setHeader('Content-Type', CONTENT_TYPE[ext] ?? 'application/octet-stream')
                return fs.createReadStream(join(SITE_FOLDER, url.pathname)).pipe(res)
            }
        } catch (e) {
            logger.error(e, 'error')
        }
    
        res.statusCode = 404
        res.end()
    })

    Array('add', 'change').forEach(event => {
        chokidar.watch(PAGES).on(event, async (filePath, stats) => {
            const relativePath = relative(PAGES, filePath)
            await broadcast(filePath, relativePath, hotReloadNamespace, clients)
        })
    })
    
    server.listen(process.env.PORT ?? 3000, () => {
        createDebug.log(`Server running at http://localhost:${server.address().port}/`)
    })
}

const server = createServer({ IncomingMessage: IncomingMessageOnRequest })
const args = process.argv.reduce((acc, current, i, items) => {
    if (current === '--execute') {
        acc.execute = items[i + 1]
    }
    return acc
}, {execute: null})


main(server, args.execute)

export {
    server,
    EVENTS
}