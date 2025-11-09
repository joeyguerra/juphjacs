import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert'
import { HotReloadSocketServer } from '../src/infrastructure/hotreload/HotReloadSocketServer.mjs'
import { createServer } from 'node:http'
import { Server as SocketServer } from 'socket.io'
import { io as ioClient } from 'socket.io-client'
import { setTimeout as sleep } from 'node:timers/promises'

describe('HotReloadSocketServer', () => {
    let httpServer
    let socketServer
    let websocketServer
    let clients = []

    beforeEach(() => {
        httpServer = createServer()
        socketServer = new SocketServer(httpServer)
    })

    afterEach(async () => {
        // Close all client connections
        for (const client of clients) {
            client.disconnect()
        }
        clients = []

        // Close servers
        if (websocketServer) {
            await websocketServer.close()
        }
        
        if (socketServer) {
            await new Promise(resolve => socketServer.close(resolve))
        }
        
        if (httpServer.listening) {
            await new Promise(resolve => httpServer.close(resolve))
        }
    })

    it('should create a reload server', () => {
        websocketServer = new HotReloadSocketServer(socketServer)
        assert.ok(websocketServer)
        assert.ok(websocketServer.io)
        assert.ok(websocketServer.namespace)
    })

    it('should accept client connections', async () => {
        websocketServer = new HotReloadSocketServer(socketServer)
        
        await new Promise(resolve => httpServer.listen(0, resolve))
        const port = httpServer.address().port

        let connectionCount = 0
        websocketServer.on('connection', () => {
            connectionCount++
        })

        const client = ioClient(`http://localhost:${port}/hot-reload`)
        clients.push(client)

        await sleep(60)

        assert.strictEqual(connectionCount, 1)
    })

    it('should broadcast reload messages to all clients', async () => {
        websocketServer = new HotReloadSocketServer(socketServer)
        
        await new Promise(resolve => httpServer.listen(0, resolve))
        const port = httpServer.address().port

        const receivedMessages = []

        // Connect two clients
        const client1 = ioClient(`http://localhost:${port}/hot-reload`)
        const client2 = ioClient(`http://localhost:${port}/hot-reload`)
        clients.push(client1, client2)

        client1.on('reload', (data) => {
            receivedMessages.push({ client: 1, data })
        })

        client2.on('reload', (data) => {
            receivedMessages.push({ client: 2, data })
        })

        await sleep(60)

        // Broadcast a reload
        websocketServer.broadcast('reload', { file: 'test.html', content: '<h1>Test</h1>' })

        await sleep(60)

        assert.strictEqual(receivedMessages.length, 2)
        assert.ok(receivedMessages.every(m => m.data.file === 'test.html'))
    })

    it('should send file-changed events with content', async () => {
        websocketServer = new HotReloadSocketServer(socketServer)
        
        await new Promise(resolve => httpServer.listen(0, resolve))
        const port = httpServer.address().port

        let receivedData = null

        const client = ioClient(`http://localhost:${port}/hot-reload`)
        clients.push(client)

        client.on('file-changed', (data) => {
            receivedData = data
        })

        await sleep(60)

        const testData = {
            filePath: '/pages/index.html',
            content: '<html><body><h1>Updated</h1></body></html>',
            timestamp: Date.now()
        }

        websocketServer.sendFileChanged(testData)

        await sleep(60)

        assert.ok(receivedData)
        assert.strictEqual(receivedData.filePath, testData.filePath)
        assert.strictEqual(receivedData.content, testData.content)
    })

    it('should handle client disconnections', async () => {
        websocketServer = new HotReloadSocketServer(socketServer)
        
        await new Promise(resolve => httpServer.listen(0, resolve))
        const port = httpServer.address().port

        let disconnectCount = 0
        websocketServer.on('disconnect', () => {
            disconnectCount++
        })

        const client = ioClient(`http://localhost:${port}/hot-reload`)
        clients.push(client)

        await sleep(60)

        client.disconnect()

        await sleep(60)

        assert.strictEqual(disconnectCount, 1)
    })

    it('should track connected clients', async () => {
        websocketServer = new HotReloadSocketServer(socketServer)
        
        await new Promise(resolve => httpServer.listen(0, resolve))
        const port = httpServer.address().port

        assert.strictEqual(websocketServer.getClientCount(), 0)

        const client1 = ioClient(`http://localhost:${port}/hot-reload`)
        clients.push(client1)
        await sleep(60)

        assert.strictEqual(websocketServer.getClientCount(), 1)

        const client2 = ioClient(`http://localhost:${port}/hot-reload`)
        clients.push(client2)
        await sleep(60)

        assert.strictEqual(websocketServer.getClientCount(), 2)

        client1.disconnect()
        await sleep(60)

        assert.strictEqual(websocketServer.getClientCount(), 1)
    })

    it('should support selective reload by URL pattern', async () => {
        websocketServer = new HotReloadSocketServer(socketServer)
        
        await new Promise(resolve => httpServer.listen(0, resolve))
        const port = httpServer.address().port

        const client1Messages = []
        const client2Messages = []

        const client1 = ioClient(`http://localhost:${port}/hot-reload`, {
            extraHeaders: { referer: 'http://localhost/blog/post1.html' }
        })
        const client2 = ioClient(`http://localhost:${port}/hot-reload`, {
            extraHeaders: { referer: 'http://localhost/about.html' }
        })
        clients.push(client1, client2)

        client1.on('reload', (data) => client1Messages.push(data))
        client2.on('reload', (data) => client2Messages.push(data))

        await sleep(60)

        // Reload only pages matching pattern
        websocketServer.broadcastToUrl('/blog/', { file: 'post1.html' })

        await sleep(60)

        // Only client1 (on blog page) should receive the message
        assert.strictEqual(client1Messages.length, 1)
        assert.strictEqual(client2Messages.length, 0)
    })

    it('should emit error events for problems', async () => {
        websocketServer = new HotReloadSocketServer(socketServer)
        
        const errors = []
        websocketServer.on('error', (error) => {
            errors.push(error)
        })

        await new Promise(resolve => httpServer.listen(0, resolve))

        // Try to send data before any clients connect - should handle gracefully
        websocketServer.broadcast('reload', { file: 'test.html' })

        await sleep(60)

        // Should not emit errors for this case
        assert.strictEqual(errors.length, 0)
    })

    it('should support CSS-only reload', async () => {
        websocketServer = new HotReloadSocketServer(socketServer)
        
        await new Promise(resolve => httpServer.listen(0, resolve))
        const port = httpServer.address().port

        let cssReloadReceived = false

        const client = ioClient(`http://localhost:${port}/hot-reload`)
        clients.push(client)

        client.on('css-reload', (data) => {
            cssReloadReceived = true
        })

        await sleep(60)

        websocketServer.broadcastCssReload({ file: 'style.css' })

        await sleep(60)
        assert.strictEqual(cssReloadReceived, true)
    })

    it('should close all connections gracefully', async () => {
        websocketServer = new HotReloadSocketServer(socketServer)
        
        await new Promise(resolve => httpServer.listen(0, resolve))
        const port = httpServer.address().port

        const client1 = ioClient(`http://localhost:${port}/hot-reload`)
        const client2 = ioClient(`http://localhost:${port}/hot-reload`)
        clients.push(client1, client2)

        await sleep(60)

        assert.strictEqual(websocketServer.getClientCount(), 2)

        await websocketServer.close()

        await sleep(60)

        assert.strictEqual(websocketServer.getClientCount(), 0)
    })
})
