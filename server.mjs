import { SiteGenerator } from './src/SiteGenerator.mjs'
import pkg from './package.json' with {type: 'json'}
import { Logger } from './src/Logger.mjs'
import { dirname, extname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer, IncomingMessage, ServerResponse } from 'node:http'
import { opendir, mkdir, stat } from 'node:fs/promises'
import { Server as SocketServer } from 'socket.io'
import { ChokidarWannabee } from './src/ChokidarWannabee.mjs'
import { RequestParams } from './src/RequestParams.mjs'
import { createReadStream, constants } from 'node:fs'
import { RingBuffer } from './src/RingBuffer.mjs'
import { FetchRequest, FetchResponse } from './src/FetchApi.mjs'
import { Page, EVENTS } from './src/Page.mjs'

const DEBUG = process.env.DEBUG
const PACKAGE_NAME = `${pkg.name}:server`
const ringBuffer = new RingBuffer(100)

const logger = new Logger(pkg.name, ringBuffer, DEBUG)
const __dirname = dirname(fileURLToPath(import.meta.url))
const PAGES = join(__dirname, 'pages')
const SITE_FOLDER = join(__dirname, '_site')
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
    if (/^\/$/.test(modifiedPathname)) {
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
        const requestFromWebSocketConnection = new FetchRequest(socket)
        requestFromWebSocketConnection.method = 'GET'
        requestFromWebSocketConnection.url = url.pathname
        requestFromWebSocketConnection.headers = socket.handshake.headers
        let shouldBreak = false
        const response = new FetchResponse(requestFromWebSocketConnection)
        logger.info({shouldBreak, url, filePath, middleware: middlewares.values()}, 'broadcasting file change')
        for await (const middleware of middlewares.values()) {
            await middleware(requestFromWebSocketConnection, response)
            shouldBreak = response.headersSent
        }
        if (shouldBreak) break

        const page = siteGenerator.pages.values().find(page => page.route.filePath.includes(url.pathname))
       
        if (page) {
            socket.emit('file changed', {fileThatTriggeredIt: relativePath, fileName: relativePath, data: page.content })
        } else {
            logger.info({message: 'no page found', url: url.pathname}, 'broadcast')
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

    const req = new FetchRequest()
    req.url = 'http://localhost/'

    const res = new FetchResponse(req)
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
        req.urlParsed = new URL(req.url ?? '/', `http://${req.headers?.host ?? 'localhost'}`)
        if (shortCircuitUrls.some(shortCircuitUrl => req.urlParsed.pathname.includes(shortCircuitUrl))) {
            return
        }

        for await (const middleware of middlewares.values()) {
            await middleware(req, res)
        }

        req.urlParsed.pathname = ifSlashAddIndex(req.urlParsed.pathname)

        const ext = extname(req.urlParsed.pathname).substring(1)
        const isHoneypot = honeypoturls.includes(join(SITE_FOLDER, req.urlParsed.pathname))
        if (isHoneypot) {
            logger.info({message: 'honeypot', url: req.urlParsed.pathname, status: 404}, 'honeypot')
            res.statusCode = 404
            return res.end('Not found')
        }

        // TODO: This strategy is not robust. It might need to be improved.
        if (ext.length > 0 && !['html'].includes(ext)) {
            try {
                const stats = await stat(join(SITE_FOLDER, req.urlParsed.pathname), constants.F_OK)
                if (!stats.isDirectory()) {
                    res.setHeader('Content-Type', CONTENT_TYPE[ext] ?? 'text/plain')
                    return createReadStream(join(SITE_FOLDER, req.urlParsed.pathname)).pipe(res)
                } else {
                    res.statusCode = 404
                    return res.end('Not found')
                }
            } catch (e) {
                logger.error(`${e.message} for ${req.urlParsed.pathname} in ${SITE_FOLDER}`)
            }
        }

        try {
            const existing = siteGenerator.pages.values().find(page => page.route.filePath.includes(req.urlParsed.pathname))
            let filePath = join(PAGES, req.urlParsed.pathname)
            if (existing) {
                filePath = existing.filePath
            }
            
            const page = await Page.get(filePath, PAGES)
    
            if (!existing) {
                res.statusCode = 404
                return res.end('Not found')
            }

            if (page[req.method.toLowerCase()]) {
                await page[req.method.toLowerCase()](req, res)
            } else {
                await page.render()
                res.statusCode = 200
                res.end(page.content)
            }
        } catch (e) {
            logger.error(`${e.message} for ${req.urlParsed.pathname} in ${PAGES}`)
            res.statusCode = 500
            res.end('Internal server error')
    }
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

const server = createServer({
    IncomingMessage: FetchRequest,
    ServerResponse: FetchResponse
})

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