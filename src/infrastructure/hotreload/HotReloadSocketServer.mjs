import EventEmitter from 'node:events'

class HotReloadSocketServer extends EventEmitter {
    constructor(io, options = {}) {
        super()
        this.io = io
        this.options = {
            namespace: options.namespace || '/hot-reload',
            ...options
        }
        
        // Use a namespace for hot-reload events
        this.namespace = this.io.of(this.options.namespace)
        
        this.clients = new Map()
        this.setupHandlers()
    }

    setupHandlers() {
        this.namespace.on('connection', (socket) => {
            const referer = socket.handshake.headers.referer || ''
            this.clients.set(socket.id, { socket, referer })
            
            this.emit('connection', socket.id)

            socket.on('disconnect', () => {
                this.clients.delete(socket.id)
                this.emit('disconnect', socket.id)
            })

            socket.on('error', (error) => {
                this.emit('error', error)
            })
        })
    }

    broadcast(event, data) {
        this.namespace.emit(event, data)
    }

    sendFileChanged(data) {
        this.broadcast('file-changed', data)
    }

    broadcastCssReload(data) {
        this.broadcast('css-reload', data)
    }

    emitToPath(event, path, data) {
        for (const { socket, referer } of this.clients.values()) {
            try {
                const url = new URL(referer)
                const pathname = url.pathname || '/'
                if (this.pathsMatch(pathname, path)) {
                    socket.emit(event, data)
                }
            } catch {
                // If referer is missing or invalid, skip targeted send
            }
        }
    }

    sendFileChangedToPath(path, data) {
        this.emitToPath('file-changed', path, data)
    }

    broadcastCssReloadToPath(path, data) {
        this.emitToPath('css-reload', path, data)
    }

    pathsMatch(current, target) {
        const normalize = (p) => {
            let s = String(p || '').split('#')[0].split('?')[0]
            if (!s.startsWith('/')) s = '/' + s
            s = s.replace(/\/index\.html$/i, '/')
            if (s.length > 1 && s.endsWith('/')) s = s.slice(0, -1)
            return s
        }
        return normalize(current) === normalize(target)
    }

    broadcastToUrl(urlPattern, data) {
        for (const { socket, referer } of this.clients.values()) {
            if (referer.includes(urlPattern)) {
                socket.emit('reload', data)
            }
        }
    }

    getClientCount() {
        return this.clients.size
    }

    async close() {
        // Disconnect all clients
        for (const { socket } of this.clients.values()) {
            socket.disconnect(true)
        }
        
        this.clients.clear()

        // Don't close the Socket.IO server - it's managed by DevServer
        // Just clear the namespace
        this.namespace.removeAllListeners()
        this.removeAllListeners()
    }
}

export { HotReloadSocketServer }
