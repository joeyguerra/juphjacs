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
