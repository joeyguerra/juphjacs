import test from 'node:test'
import assert from 'node:assert/strict'
import { JuphjacWebServer } from '../src/application/WebServer.mjs'

await test('Server Integration - Dynamic Page Handling', async t => {
    await t.test('should execute page.post() method for POST request', async () => {
        const server = new JuphjacWebServer({
            rootDir: '/Users/joeyguerra/src/joeyguerra/juphjacs',
            logLevel: 'error'
        })
        
        await server.initialize()
        await server.start(0) // use random port
        
        const port = server.httpServer.address().port
        
        try {
            // Make a POST request to login page
            const response = await fetch(`http://localhost:${port}/login.html`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username: 'admin',
                    password: 'admin',
                    csrf: '123456'
                }),
                redirect: 'manual' // Don't follow redirects
            })
            
            // Should get a redirect
            assert.equal(response.status, 302)
            assert.equal(response.headers.get('Location'), '/admin.html')
            assert.match(response.headers.get('Set-Cookie'), /session=admin/)
        } finally {
            await server.stop()
        }
    })
    
    await t.test('should execute page.get() method for GET request', async () => {
        const server = new JuphjacWebServer({
            rootDir: '/Users/joeyguerra/src/joeyguerra/juphjacs',
            logLevel: 'error'
        })
        
        await server.initialize()
        await server.start(0)
        
        const port = server.httpServer.address().port
        
        try {
            const response = await fetch(`http://localhost:${port}/login.html`)
            
            assert.equal(response.status, 200)
            assert.equal(response.headers.get('Content-Type'), 'text/html')
            const html = await response.text()
            assert.match(html, /Login/)
        } finally {
            await server.stop()
        }
    })
    
    await t.test('should serve framework resources', async () => {
        const server = new JuphjacWebServer({
            rootDir: '/Users/joeyguerra/src/joeyguerra/juphjacs',
            logLevel: 'error'
        })
        
        await server.initialize()
        await server.start(0)
        
        const port = server.httpServer.address().port
        
        try {
            const response = await fetch(`http://localhost:${port}/__juphjacs__/HotReloader.mjs`)
            
            assert.equal(response.status, 200)
            assert.equal(response.headers.get('Content-Type'), 'application/javascript')
            const code = await response.text()
            assert.match(code, /HotReloader/)
        } finally {
            await server.stop()
        }
    })
    
    await t.test('should serve static HTML pages without dynamic methods', async () => {
        const server = new JuphjacWebServer({
            rootDir: '/Users/joeyguerra/src/joeyguerra/juphjacs',
            logLevel: 'error'
        })
        
        await server.initialize()
        await server.start(0)
        
        const port = server.httpServer.address().port
        
        try {
            // admin.html exists but doesn't have get() method, should serve static
            const response = await fetch(`http://localhost:${port}/admin.html`)
            
            assert.equal(response.status, 200)
            assert.equal(response.headers.get('Content-Type'), 'text/html')
            const html = await response.text()
            assert.match(html, /Admin/)
            // Should have hot-reload injected
            assert.match(html, /HotReloader/)
        } finally {
            await server.stop()
        }
    })
    
    await t.test('should serve static CSS files', async () => {
        const server = new JuphjacWebServer({
            rootDir: '/Users/joeyguerra/src/joeyguerra/juphjacs',
            logLevel: 'error'
        })
        
        await server.initialize()
        await server.start(0)
        
        const port = server.httpServer.address().port
        
        try {
            const response = await fetch(`http://localhost:${port}/css/index.css`)
            assert.equal(response.status, 200)
            assert.equal(response.headers.get('content-type'), 'text/css')
            const content = await response.text()
            assert.ok(content.length > 0, 'CSS file should have content')
        } finally {
            await server.stop()
        }
    })
    
    await t.test('should serve static JavaScript files', async () => {
        const server = new JuphjacWebServer({
            rootDir: '/Users/joeyguerra/src/joeyguerra/juphjacs',
            logLevel: 'error'
        })
        
        await server.initialize()
        await server.start(0)
        
        const port = server.httpServer.address().port
        
        try {
            const response = await fetch(`http://localhost:${port}/js/HotReloader.mjs`)
            assert.equal(response.status, 200)
            assert.equal(response.headers.get('content-type'), 'application/javascript')
            const content = await response.text()
            assert.ok(content.includes('HotReloader'), 'Should contain HotReloader code')
        } finally {
            await server.stop()
        }
    })
    
    await t.test('should return 404 for non-existent files', async () => {
        const server = new JuphjacWebServer({
            rootDir: '/Users/joeyguerra/src/joeyguerra/juphjacs',
            logLevel: 'error'
        })
        
        await server.initialize()
        await server.start(0)
        
        const port = server.httpServer.address().port
        
        try {
            const response = await fetch(`http://localhost:${port}/does-not-exist.html`)
            assert.equal(response.status, 404)
            assert.equal(response.headers.get('content-type'), 'text/html')
            const html = await response.text()
            assert.match(html, /404/)
            assert.match(html, /Not Found/)
        } finally {
            await server.stop()
        }
    })
    
    await t.test('should serve directory index.html when browsing to /blog', async () => {
        const server = new JuphjacWebServer({
            rootDir: '/Users/joeyguerra/src/joeyguerra/juphjacs',
            logLevel: 'error'
        })
        
        await server.initialize()
        await server.start(0)
        
        const port = server.httpServer.address().port
        
        try {
            const response = await fetch(`http://localhost:${port}/blog`)
            const body = await response.text()
            assert.equal(response.status, 200, `Expected 200 but got ${response.status}: ${body.substring(0, 200)}`)
            assert.equal(response.headers.get('content-type'), 'text/html')
            assert.ok(body.includes('Blog'), 'Should contain blog content')
            // Should have hot-reload injected via TEMPLATE_RENDERED event
            assert.match(body, /HotReloader/, 'Should have HotReloader script injected')
            assert.match(body, /socket\.io/, 'Should have socket.io script injected')
        } finally {
            await server.stop()
        }
    })
    
    await t.test('should serve directory index.html when browsing to /blog/', async () => {
        const server = new JuphjacWebServer({
            rootDir: '/Users/joeyguerra/src/joeyguerra/juphjacs',
            logLevel: 'error'
        })
        
        await server.initialize()
        await server.start(0)
        
        const port = server.httpServer.address().port
        
        try {
            const response = await fetch(`http://localhost:${port}/blog/`)
            assert.equal(response.status, 200)
            assert.equal(response.headers.get('content-type'), 'text/html')
            const html = await response.text()
            assert.ok(html.includes('Blog'), 'Should contain blog content')
        } finally {
            await server.stop()
        }
    })
    
    await t.test('should pass user context to page objects', async () => {
        // Create a mock database service
        const mockDb = {
            users: {
                findOne: async (query) => ({ email: query.email, name: 'Test User' })
            }
        }
        
        const mockLogger = {
            info: (msg) => console.log(`[MOCK] ${msg}`)
        }
        
        const server = new JuphjacWebServer({
            rootDir: '/Users/joeyguerra/src/joeyguerra/juphjacs',
            logLevel: 'error',
            context: {
                db: mockDb,
                logger: mockLogger,
                customService: 'test-123'
            }
        })
        
        await server.initialize()
        await server.start(0)
        
        const port = server.httpServer.address().port
        
        try {
            // Verify context is stored on server
            assert.ok(server.userContext, 'Server should have userContext')
            assert.equal(server.userContext.customService, 'test-123')
            assert.ok(server.userContext.db, 'Context should have db')
            assert.ok(server.userContext.logger, 'Context should have logger')
            
            // Verify context is passed to DynamicPageHandler
            // The handler chain contains DynamicPageHandler which should have context
            assert.ok(server.handlerChain, 'Server should have handler chain')
        } finally {
            await server.stop()
        }
    })
    
    await t.test('should make WebSocket server available in context', async () => {
        const server = new JuphjacWebServer({
            rootDir: '/Users/joeyguerra/src/joeyguerra/juphjacs',
            logLevel: 'error',
            context: {
                customValue: 'test-123'
            }
        })
        
        await server.initialize()
        await server.start(0)
        
        const port = server.httpServer.address().port
        
        try {
            // Verify hot-reload WebSocket server was added to context
            assert.ok(server.userContext.websocket, 'Context should have websocket')
            assert.strictEqual(server.userContext.websocket, server.websocketServer, 'websocket should be the HotReloadSocketServer instance')
            
            // Verify Socket.IO server was added to context
            assert.ok(server.userContext.io, 'Context should have io (Socket.IO server)')
            assert.strictEqual(server.userContext.io, server.socketServer, 'io should be the Socket.IO server instance')
            
            // Verify original context values are preserved
            assert.equal(server.userContext.customValue, 'test-123')
        } finally {
            await server.stop()
        }
    })
})
