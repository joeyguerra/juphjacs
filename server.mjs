import { SiteGenerator, EVENTS } from './src/SiteGenerator.mjs'
import pkg from './package.json' with {type: 'json'}
import { Logger } from './src/Logger.mjs'
import { dirname, extname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer, IncomingMessage, ServerResponse } from 'node:http'
import { opendir, mkdir, access } from 'node:fs/promises'
import { Server as SocketServer } from 'socket.io'
import { ChokidarWannabee } from './src/ChokidarWannabee.mjs'
import { RequestParams } from './src/RequestParams.mjs'
import { createReadStream, constants } from 'node:fs'
import { RingBuffer } from './src/RingBuffer.mjs'

const DEBUG = process.env.DEBUG
const PACKAGE_NAME = `${pkg.name}:server`
const ringBuffer = new RingBuffer(100)

const logger = new Logger(pkg.name, ringBuffer, DEBUG)
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

siteGenerator.on('error', e => logger.error(e, 'error in site generator'))

class IncomingMessageOnSocket extends IncomingMessage {
    constructor(socket, urlParsed) {
        super(socket)
        this.urlParsed = urlParsed
        this.res = new ServerResponse(this)
    }
    async formData() {
    }

    async json() {
    }

    async text() {
    }

    async arrayBuffer() {
    }

    async blob() {
    }

    async buffer() {
    }
}

class IncomingMessageOnRequest extends IncomingMessage {
    #request = null
    constructor(req) {
        super(req)
        this.url = this.url ?? '/'
        this.urlParsed = new URL(this.url, `http://${req?.headers?.host ?? 'localhost'}`)
    }

    async formData() {
        const form = new FormData()
        const text = await this.text()
        const params = new URLSearchParams(text)
        for (const [key, value] of params) {
            form.append(key, value)
        }
        return form
    }

    async json() {
        return await JSON.parse(await this.text())
    }

    async text() {
        return new Promise((resolve, reject) => {
            let data = ''
            this.on('data', chunk => data += chunk)
            this.on('end', () => resolve(data))
            this.on('error', reject)
        })
    }

    async arrayBuffer() {
    }

    async blob() {

    }

    async buffer() {
    }

}

class ConnectedClient {
    constructor(socketId, broadcastOperator, connectionHeaders) {
        this.socketId = socketId
        this.broadcastOperator = broadcastOperator
        this.headers = connectionHeaders
        this.url = new URL(connectionHeaders.referer)
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

    for (const [socketId, socket] of clients.entries()) {
        const url = new URL(socket.handshake.headers.referer)
        url.pathname = ifSlashAddIndex(url.pathname)
        const requestFromWebSocketConnection = new IncomingMessageOnSocket(socket, url)
        requestFromWebSocketConnection.method = 'GET'
        requestFromWebSocketConnection.url = url.pathname
        requestFromWebSocketConnection.headers = socket.handshake.headers
        let shouldBreak = false
        const response = new ServerResponse(requestFromWebSocketConnection)
        logger.info({shouldBreak, url, filePath, middleware: middlewares.values()}, 'broadcasting file change')
        for await (const middleware of middlewares.values()) {
            await middleware(requestFromWebSocketConnection, response)
            shouldBreak = response.headersSent
        }
        if (shouldBreak) break
        const route = siteGenerator.routes.values().find(route => route.match(url.pathname))
        logger.info({ uri: url.pathname, filePath, relativePath}, 'broadcast')
        if (url.pathname.replace(ext, '').includes(relativePath.replace(ext, '')) || route) {
            filePath = route ? route.filePath : filePath
            const page = await siteGenerator.renderPage(filePath, {req: requestFromWebSocketConnection, res: socket.res})
            socket.emit('file changed', {fileThatTriggeredIt: relativePath, fileName: relativePath, data: page.output })
        }

        if (siteGenerator.localImports.get(filePath)) {
            for (const file of siteGenerator.localImports.get(filePath)) {
                const relativeFileIncludes = relative(PAGES, file)
                const route = siteGenerator.routes.values().find(route => route.match(url.pathname))
                if (url.pathname.replace(ext, '').includes(relativeFileIncludes.replace(ext, '')) || route) {
                    const page = await siteGenerator.renderPage(file, {req: requestFromWebSocketConnection, res: socket.res})
                    socket.emit('file changed', { fileThatTriggeredIt: relativePath, fileName: file, data: page.output })
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
        logger.warn(e.message)
    }

    const req = new IncomingMessageOnRequest()
    req.url = 'http://localhost/'
    const res = new ServerResponse(req)

    const io = new SocketServer(server)
    const shortCircuitUrls = ['socket.io']
    const honeypoturls = []
    const clients = new Map()
    const hotReloadNamespace = io.of('/hot-reload')
    const loggerNamespace = io.of('/logger')
    
    
    const chokidar = new ChokidarWannabee(PAGES, async (folder, event, filePath, absolutePath) => {
        let filesWithThisLayout = siteGenerator.layouts.get(absolutePath)
        if (!filesWithThisLayout) return false
        for await (const file of filesWithThisLayout) {
            await chokidar.fire(dirname(file), event, file)
        }
        return true
    })

    loggerNamespace.on('connection', socket => {
        logger.info({message: 'connected to logger %s', id: socket.id}, 'logger:connection')
        clients.set(socket.id, socket)
        socket.on('disconnect', () => {
            clients.delete(socket.id)
            logger.info({message: '/logger user disconnected %s', id: socket.id}, 'logger:connection')
        })
        socket.on('get logs', () => {
            const interval = setInterval(() => {
                for (const log of ringBuffer) {
                    socket.emit('logs', log)
                }
            }, 1000)
        })
    })

    hotReloadNamespace.on('connection', socket => {
        logger.info({message: 'connected to hot reloading %s', id: socket.id}, 'hot-reload:connection')
        clients.set(socket.id, socket)
        socket.on('disconnect', () => {
            clients.delete(socket.id)
            logger.info({message: '/hot-reload user disconnected %s', id: socket.id}, 'hot-reload:connection')
        })
    })

    server.on('request', async (req, res) => {
        const url = new URL(req.url, `http://${req.headers.host}`)
        if (shortCircuitUrls.some(shortCircuitUrl => url.pathname.includes(shortCircuitUrl))) {
            return
        }

        for await (const middleware of middlewares.values()) {
            await middleware(req, res)
        }

        req.urlParsed = new URL(req.url ?? '/', `http://${req.headers?.host ?? 'localhost'}`)
        url.pathname = ifSlashAddIndex(url.pathname)
        const route = siteGenerator.routes.values().find(route => route.match(url.pathname))
        logger.info({url: req.urlParsed, headers: req.headers}, 'request')
        if (route) {
            const ext = extname(req.url).substring(1)
            req.params = new RequestParams(req.urlParsed, route.regex)
            logger.info({message: 'handling route', url: req.url}, 'route')
            const page = await siteGenerator.renderPage(route.filePath, { req, res })
            const method = req.method.toLowerCase()
            if (res.headersSent) return
            if (page && page[method]) {
                await page[method].apply(page, [req, res])
                if (res.headersSent) return
            }
            res.setHeader('Content-Type', CONTENT_TYPE[ext] ?? 'text/html')
            return res.end(page.output)
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