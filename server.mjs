import { SiteGenerator, EVENTS } from './src/SiteGenerator.mjs'
import pkg from './package.json' with {type: 'json'}
import { Logger } from './src/Logger.mjs'
import { dirname, extname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer, IncomingMessage, ServerResponse } from 'node:http'
import { opendir, mkdir, readFile, writeFile, cp, access } from 'node:fs/promises'
import { Server as SocketServer } from 'socket.io'
import { ChokidarWannabee } from './src/ChokidarWannabee.mjs'
import { RequestParams } from './src/RequestParams.mjs'
import { createReadStream, constants } from 'node:fs'


const DEBUG = process.env.DEBUG
const PACKAGE_NAME = `${pkg.name}:server`
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
const middlewares = new Set()
const filesToCopyOver = Array.from(['favicon.ico', 'robots.txt'])
const foldersToCopyOver = Array.from(['js', 'css', 'images'])
const siteGenerator = new SiteGenerator(__dirname, PAGES, SITE_FOLDER, filesToCopyOver, foldersToCopyOver)

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
        this.urlParsed = new URL(req?.url ?? '/', `http://${req?.headers?.host ?? 'localhost'}`)
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

async function broadcast(filePath, relativePath, hotReloadNamespace, clients) {
    const ext = extname(filePath)
    const req = new IncomingMessage()
    const res = new ServerResponse(req)

    await siteGenerator.genFile(filePath, req, res)

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

async function main (server, execute) {

    try {
        for await (const plugin of loadPlugins()) {
            await plugin.default()
        }
    } catch (e) {
        logger.warn(e)
    }

    try {
        for await (const middleware of loadMiddlewares()) {
            middlewares.add(await middleware.default())
        }    
    } catch (e) {
        logger.warn(e)
    }

    const req = new IncomingMessageOnRequest()
    req.url = 'http://localhost/'
    const res = new ServerResponse(req)

    const io = new SocketServer(server)
    const shortCircuitUrls = ['socket.io']
    const honeypoturls = []
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
                await access(join(SITE_FOLDER, url.pathname), constants.F_OK)
                res.setHeader('Content-Type', CONTENT_TYPE[ext] ?? 'application/octet-stream')
                return createReadStream(join(SITE_FOLDER, url.pathname)).pipe(res)
            }
        } catch (e) {
            logger.error(e.message)
        }
    
        res.statusCode = 404
        res.end('Not found')
    })

    await siteGenerator.generateStaticSite(req, res)

    Array('add', 'change').forEach(event => {
        chokidar.watch(PAGES).on(event, async (filePath, stats) => {
            const relativePath = relative(PAGES, filePath)
            await broadcast(filePath, relativePath, hotReloadNamespace, clients)
        })
    })
    
    server.listen(process.env.PORT ?? 3000, () => {
        logger.info(`Server running at http://localhost:${server.address().port}/`)
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