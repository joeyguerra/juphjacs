import test from 'node:test'
import assert from 'node:assert/strict'
import { FrameworkResourceHandler } from '../src/infrastructure/http/FrameworkResourceHandler.mjs'

await test('FrameworkResourceHandler', async t => {
    await t.test('should handle /__juphjacs__/ requests', async () => {
        const handler = new FrameworkResourceHandler({
            frameworkRoot: '/Users/joeyguerra/src/joeyguerra/juphjacs/src/application'
        })
        
        const mockReq = {
            url: 'http://localhost:3000/__juphjacs__/HotReloader.mjs',
            method: 'GET',
            headers: { host: 'localhost:3000' }
        }
        const mockRes = {
            headers: {},
            statusCode: null,
            body: null,
            setHeader(name, value) {
                this.headers[name] = value
            },
            writeHead(code) {
                this.statusCode = code
            },
            end(content) {
                this.body = content
            }
        }
        
        const handled = await handler.handle(mockReq, mockRes)
        
        assert.equal(handled, true)
        assert.equal(mockRes.statusCode, 200)
        assert.equal(mockRes.headers['Content-Type'], 'application/javascript')
        assert.match(mockRes.body, /HotReloader/)
    })
    
    await t.test('should return false for non-framework requests', async () => {
        const handler = new FrameworkResourceHandler({
            frameworkRoot: '/Users/joeyguerra/src/joeyguerra/juphjacs/src/application'
        })
        
        const mockReq = {
            url: 'http://localhost:3000/index.html',
            method: 'GET',
            headers: { host: 'localhost:3000' }
        }
        const mockRes = {}
        
        const handled = await handler.handle(mockReq, mockRes)
        
        assert.equal(handled, false)
    })
    
    await t.test('should handle 404 for missing framework resources', async () => {
        const handler = new FrameworkResourceHandler({
            frameworkRoot: '/Users/joeyguerra/src/joeyguerra/juphjacs/src/application'
        })
        
        const mockReq = {
            url: 'http://localhost:3000/__juphjacs__/NonExistent.mjs',
            method: 'GET',
            headers: { host: 'localhost:3000' }
        }
        const mockRes = {
            headers: {},
            statusCode: null,
            body: null,
            setHeader(name, value) {
                this.headers[name] = value
            },
            writeHead(code) {
                this.statusCode = code
            },
            end(content) {
                this.body = content
            }
        }
        
        const handled = await handler.handle(mockReq, mockRes)
        
        assert.equal(handled, true)
        assert.equal(mockRes.statusCode, 404)
        assert.match(mockRes.body, /not found/i)
    })
})
