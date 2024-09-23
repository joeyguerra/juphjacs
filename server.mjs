import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { dirname, extname, join, relative, resolve } from 'node:path'
import fs from 'node:fs'
import EventEmitter from 'node:events'
import vm, { SyntheticModule, SourceTextModule } from 'node:vm'
import { Server as SocketServer } from 'socket.io'
import createDebug from 'debug'
import pkg from './package.json' with {type: 'json'}
import { Template, TemplateWithLayout, LAYOUT_META_REGEX } from './src/Template.mjs'

const PACKAGE_NAME = `${pkg.name}:server`
const debug = createDebug(PACKAGE_NAME)

const server = createServer()
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

io.on('connection', socket => {
    debug('connected %s', socket.id)
    socket.on('url', url => {
        clients.set(socket.id, url)
    })
    socket.on('disconnect', () => {
        clients.delete(socket.id)
        debug('user disconnected %s', socket.id)
    })
    socket.on('chat message', msg => {
        debug('message is %s', msg)
    })
})

server.on('request', async (req, res) => {
    const uri = req.url === '/' ? 'index.html' : req.url
    if (uri.indexOf('socket.io') > -1) return
    if (uri.indexOf('morphdom-esm.js') > -1) {
        res.setHeader('Content-Type', 'text/javascript')
        fs.createReadStream(join(__dirname, 'node_modules/morphdom/dist/morphdom-esm.js')).pipe(res)
        return
    }
    try {
        await fs.promises.access(join(PUBLIC, uri), fs.constants.F_OK)
    } catch (e) {
        res.statusCode = 404
        res.end()
        return
    }
    const ext = extname(uri).substring(1)
    res.setHeader('Content-Type', CONTENT_TYPE[ext] ?? 'application/octet-stream')
    if (ext === 'html') {
        const filePath = join(PUBLIC, uri)
        const html = await renderTemplate(filePath, layouts)
        res.end(html)
    } else {
        fs.createReadStream(join(PUBLIC, uri)).pipe(res)
    }
})

async function renderTemplate(filePath, layouts) {
    let content = await fs.promises.readFile(filePath, 'utf-8')
    const layoutMatch = content.match(LAYOUT_META_REGEX)
    const layoutPath = layoutMatch ? join(__dirname, layoutMatch.groups.fileName) : null
    let template = new Template(content)
    if (layoutPath) {
        let key = layouts.get(layoutPath)
        if (!key) {
            layouts.set(layoutPath, new Set())
            key = layouts.get(layoutPath)
        }
        key.add(filePath)
        const layoutContent = await fs.promises.readFile(layoutPath, 'utf-8')
        template = new TemplateWithLayout(content, layoutContent)
    }
    return await template.render()
}

async function loadLayouts(dir) {
    const layouts = new Map()
    for await (const file of dir) {
        if (file.isDirectory()) {
            loadLayouts(await fs.promises.opendir(join(dir.path, file.name), { recursive: true}))
        } else {
            if (extname(file.name) !== '.html') continue
            const content = await fs.promises.readFile(resolve(dir.path, file.name), 'utf-8')
            const layoutMatch = content.match(LAYOUT_META_REGEX)
            if (!layoutMatch) continue
            const key = layouts.get(layoutMatch.groups.fileName)
            if (key) {
                key.add(resolve(__dirname, file.name))
            } else {
                layouts.set(resolve(__dirname, layoutMatch.groups.fileName), new Set([resolve(dir.path, file.name)]))
            }
        }
    }
    return layouts
}

async function broadcast(filePath, stats, layouts) {
    const data = await renderTemplate(filePath, layouts)
    const relativePath = relative(PUBLIC, filePath)
    for (const [socketId, url] of clients.entries()) {
        if (url.includes(relativePath)) {
            io.to(socketId).emit('file changed', { fileName: relativePath, data })
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
        fs.watch(folder, this.fire.bind(this, folder))
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

const layouts = await loadLayouts(await fs.promises.opendir(PUBLIC, { recursive: true}))
const chokidar = new ChokidarWannabee(PUBLIC, layouts)
Array('add', 'change').forEach(event => {
    chokidar.watch(PUBLIC).on(event, async (filePath, stats) => {
        await broadcast(filePath, stats, chokidar.layouts)
    })
})

server.listen(process.env.PORT ?? 3000, async () => {
    createDebug.log(`Server running at http://localhost:${server.address().port}/`)
})
