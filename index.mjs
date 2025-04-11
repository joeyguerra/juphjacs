import { SiteGenerator, EVENTS as SITE_GENERATOR_EVENTS } from './src/SiteGenerator.mjs'
import pkg from './package.json' with {type: 'json'}
import { Logger } from './src/Logger.mjs'
import { dirname, extname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer, IncomingMessage, ServerResponse } from 'node:http'
import { opendir, mkdir, stat, readFile } from 'node:fs/promises'
import { Server as SocketServer } from 'socket.io'
import { ChokidarWannabee } from './src/ChokidarWannabee.mjs'
import { RequestParams } from './src/RequestParams.mjs'
import { createReadStream, constants } from 'node:fs'
import { RingBuffer } from './src/RingBuffer.mjs'
import { FetchRequest, FetchResponse } from './src/FetchApi.mjs'
import { Page, EVENTS } from './src/Page.mjs'
import { argv } from 'node:process'
import { parseArgs } from 'node:util'
import { CoreClientSiteCode } from './src/CoreClientSiteCode.mjs'

const DEBUG = process.env.DEBUG
const ringBuffer = new RingBuffer(100)

const logger = new Logger(pkg.name, ringBuffer, DEBUG)
const rootFolder = process.cwd()

const options = {
    pages: {
        type: 'string',
        default: join(rootFolder, 'pages')
    },
    'site-folder': {
        type: 'string',
        default: join(rootFolder, '_site')
    },
    resources: {
        type: 'string',
        default: 'css,js,images'
    },
    execute: {
        type: 'boolean',
        default: false
    }
}

const parsedArgs = parseArgs({ options, args: argv.slice(2) })

const PAGES = process.env.PAGES ?? parsedArgs.values.pages
const SITE_FOLDER = process.env.SITE_FOLDER ?? parsedArgs.values['site-folder']
const foldersToCopyOver = process.env.RESOURCES?.split(',').map(f => f.trim()) ?? parsedArgs.values.resources.split(',').map(folder => folder.trim())
const EXECUTE = process.env.EXECUTE ?? parsedArgs.values.execute

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

const shortCircuitUrls = ['socket.io']
const honeypoturls = []

const middlewares = new Set()
const filesToCopyOver = Array.from([
    {
        from: join(PAGES, 'favicon.ico'),
        to: join(SITE_FOLDER, 'favicon.ico')
    },
    {
        from: join(PAGES, 'robots.txt'),
        to: join(SITE_FOLDER, 'robots.txt')
    }
])

async function* readAllFiles(folder) {
    const dir = await opendir(folder)
    for await (const dirent of dir) {
        const entryPath = join(folder, dirent.name)
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

async function* loadPlugins() {
    for await (const file of await opendir(join(rootFolder, 'plugins'))) {
        if (file.isDirectory()) continue
        if (extname(file.name) !== '.mjs') continue
        const pluginPath = join(file.parentPath, file.name)
        const fileUrl = new URL(`file://${pluginPath.replace(/\\/g, '/')}`)
        yield await import(fileUrl)
    }
}

async function* loadMiddlewares() {
    for await (const file of await opendir(join(rootFolder, 'middlewares'))) {
        if (file.isDirectory()) continue
        if (extname(file.name) !== '.mjs') continue
        const modulePath = join(file.parentPath, file.name)
        const fileUrl = new URL(`file://${modulePath.replace(/\\/g, '/')}`)
        yield await import(fileUrl)
    }
}

function createFetchRequestFromSocket(socket) {
    const url = new URL(socket.handshake.headers.referer)
    url.pathname = ifSlashAddIndex(url.pathname)
    const requestFromWebSocketConnection = new FetchRequest(socket)
    requestFromWebSocketConnection.method = 'GET'
    requestFromWebSocketConnection.url = url.pathname
    requestFromWebSocketConnection.headers = socket.handshake.headers
    return requestFromWebSocketConnection
}

async function broadcast(filePath, relativePath, hotReloadNamespace, delegate, siteGenerator) {
    const ext = extname(filePath)
    const req = new IncomingMessage()
    const res = new ServerResponse(req)
    const lookupKey = relativePath.replace('.md', '.html')

    if (foldersToCopyOver.some(folder => filePath.includes(join(PAGES, folder)))) {
        await siteGenerator.copyFileFrom(filePath, join(SITE_FOLDER, relativePath))
    }

    const changedPage = siteGenerator.pages.get(`/${lookupKey}`)

    if (!changedPage) {
        logger.info({ message: 'page not found', filePath }, 'broadcast')
        return
    }

    const clientsOnPage = Array.from(hotReloadNamespace.sockets.values()).filter(socket => {
        const url = new URL(socket.handshake.headers.referer)
        url.pathname = ifSlashAddIndex(url.pathname)
        return changedPage.route.match(url.pathname)
    })

    if (clientsOnPage.length > 0) {
        const content = await readFile(changedPage.filePath, 'utf-8')
        changedPage.template = content
    }

    const generatedPage = await siteGenerator.genFile(filePath, delegate)

    for await (const socket of clientsOnPage) {
        const requestFromWebSocketConnection = createFetchRequestFromSocket(socket)
        let shouldSkip = false
        const response = new FetchResponse(requestFromWebSocketConnection)
        for await (const middleware of middlewares.values()) {
            for await (const middleware of middlewares.values()) {
                try {
                    await middleware(requestFromWebSocketConnection, response)
                } catch (e) {
                    logger.error(`Error in middleware ${e} ${e.stack}`)
                    response.statusCode = 500
                    response.end('Internal Server Error')
                }
            }
            shouldSkip = response.headersSent
        }
        if (shouldSkip) continue
        socket.emit('file changed', { fileThatTriggeredIt: relativePath, fileName: relativePath, data: generatedPage.content })
    }
}

async function handleRequest(req, res, siteGenerator) {
    req.urlParsed = new URL(req.url ?? '/', `http://${req.headers?.host ?? 'localhost'}`)

    if (shortCircuitUrls.some(shortCircuitUrl => req.urlParsed.pathname.includes(shortCircuitUrl))) {
        return
    }

    let coreClientSiteCode = new CoreClientSiteCode(req.urlParsed.pathname, rootFolder, req, logger)
    if (coreClientSiteCode.pipe(res)) {
        return
    }

    for await (const middleware of middlewares.values()) {
        try {
            await middleware(req, res)
        } catch (e) {
            logger.error(`Error in middleware ${e} ${e.stack}`)
            res.statusCode = 500
            res.end('Internal Server Error')
            req.destroy()
            return
        }
    }

    req.urlParsed.pathname = ifSlashAddIndex(req.urlParsed.pathname)

    const isHoneypot = honeypoturls.includes(join(siteGenerator.siteFolder, req.urlParsed.pathname))
    if (isHoneypot) {
        logger.info({ message: 'honeypot', url: req.urlParsed.pathname, status: 200 }, 'honeypot')
        res.statusCode = 200
        res.end('Ok')
        return req.destroy()
    }

    const method = req.method.toLowerCase()
    const page = siteGenerator.pages.values().find(page => page.route.test(req.urlParsed.pathname))
    if (page && page[method]) {
        await page[method](req, res)
        return
    }

    let fileToLoad = join(siteGenerator.siteFolder, req.urlParsed.pathname)
    const ext = extname(req.urlParsed.pathname).substring(1)
    let contentType = CONTENT_TYPE[ext] ?? 'text/plain'
    if (page) {
        fileToLoad = page.filePath.replace(siteGenerator.pagesFolder, siteGenerator.siteFolder)
        contentType = page.contentType
    }

    try {
        const stats = await stat(fileToLoad, constants.F_OK)
        if (!stats.isDirectory()) {
            res.setHeader('Content-Type', contentType)
            res.statusCode = 200
            res.statusMessage = 'OK'
            const stream = createReadStream(fileToLoad)
            stream.on('finish', () => {
                req.destroy()
            })
            return stream.pipe(res)
        } else {
            res.statusCode = 404
            res.end('Not found')
            return req.destroy()
        }
    } catch (e) {
        logger.error(`Serving file: ${e.message} for ${req.urlParsed.pathname} in ${SITE_FOLDER}`)
        if (e.code === 'ENOENT') {
            res.statusCode = 404
            res.end('Not found')
            req.destroy()
        } else {
            res.statusCode = 500
            res.end('Internal Server Error')
            req.destroy()
        }
    }
}

async function main(server, delegate = {}) {
    if (!delegate) {
        delegate = {}
    }

    const siteGenerator = new SiteGenerator(rootFolder, PAGES, SITE_FOLDER, filesToCopyOver, foldersToCopyOver)
    siteGenerator.on(SITE_GENERATOR_EVENTS.STATIC_SITE_GENERATED, (routes, layouts) => {
        process.emit(SITE_GENERATOR_EVENTS.STATIC_SITE_GENERATED, routes, layouts)
    })

    siteGenerator.on('error', e => {
        logger.error(`${e.file} ${e.error}`, 'error in site generator')
    })

    try {
        for await (const plugin of loadPlugins()) {
            await plugin.default(delegate)
        }
    } catch (e) {
        logger.warn(`Error loading plugins: ${e.message}`)
    }

    try {
        for await (const middleware of loadMiddlewares()) {
            middlewares.add(await middleware.default(delegate))
        }
    } catch (e) {
        logger.warn(e.message)
    }

    const io = new SocketServer(server)
    const hotReloadNamespace = io.of('/hot-reload')

    //TODO: Need to change the strategy for triggering file changes for layout files.
    const chokidar = new ChokidarWannabee(PAGES, async (folder, event, filePath, absolutePath) => {
        let filesWithThisLayout = siteGenerator.layouts.get(absolutePath)
        if (!filesWithThisLayout) return false
        for await (const file of filesWithThisLayout) {
            await chokidar.fire(dirname(file), event, file)
        }
        return true
    })
    hotReloadNamespace.on('connection', socket => {
        logger.info({ message: 'connected to hot reloading %s', id: socket.id }, 'hot-reload:connection')
        socket.on('disconnect', async () => {
            socket.removeAllListeners()
            socket.disconnect(true)
            logger.info({ message: '/hot-reload user disconnected %s', id: socket.id }, 'hot-reload:connection')
        })
    })

    server.on('close', () => {
        io.close(() => {})
    
        for (const [id, socket] of io.sockets.sockets) {
            socket.disconnect(true)
        }    
        siteGenerator.dispose()
    })

    server.on('request', async (req, res) => {
        try {
            await handleRequest(req, res, siteGenerator)
        } catch (e) {
            logger.error(`Error in request handler ${e}`)
            res.statusCode = 500
            res.end('Internal Server Error')
            req.destroy()
        }
    })

    delegate.broadcast = async function (content, filePath) {
        for await (const socket of hotReloadNamespace.sockets.values()) {
            const requestFromWebSocketConnection = createFetchRequestFromSocket(socket)
            let shouldBreak = false
            const response = new FetchResponse(requestFromWebSocketConnection)
            for await (const middleware of middlewares.values()) {
                await middleware(requestFromWebSocketConnection, response)
                shouldBreak = response.headersSent
            }
            if (shouldBreak) break

            const page = siteGenerator.pages.values().find(page => page.route.test(requestFromWebSocketConnection.url))
            if (page && page.route.filePath === filePath) {
                socket.emit('file changed', { fileThatTriggeredIt: filePath, fileName: filePath, data: page.content })
            } else {
                // logger.debug({ message: 'No page found', filePath, url: requestFromWebSocketConnection.url }, 'broadcast')
            }
        }
    }

    await siteGenerator.generateStaticSite(delegate)

    Array('add', 'change').forEach(event => {
        chokidar.watch(PAGES).on(event, async (filePath, stats) => {
            const relativePath = relative(PAGES, filePath)
            await broadcast(filePath, relativePath, hotReloadNamespace, delegate, siteGenerator)
        })
    })

    if (EXECUTE) {
        process.exit()
    }
}

export {
    main,
    logger,
    EVENTS,
    ringBuffer,
    FetchRequest,
    FetchResponse,
    SiteGenerator,
    handleRequest
}