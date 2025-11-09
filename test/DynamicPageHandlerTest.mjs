import test from 'node:test'
import assert from 'node:assert/strict'
import { DynamicPageHandler } from '../src/infrastructure/http/DynamicPageHandler.mjs'

await test('DynamicPageHandler', async t => {
    await t.test('should call page.get() method for GET request', async () => {
        const handler = new DynamicPageHandler({
            pagesFolder: '/test/pages',
            findPageByRoute: (route) => {
                if (route === '/login.html') {
                    return {
                        filePath: '/test/pages/login.html',
                        get: async (req, res) => {
                            res.body = 'GET response'
                        }
                    }
                }
                return null
            }
        })
        
        const mockReq = {
            url: 'http://localhost:3000/login.html',
            method: 'GET',
            headers: { host: 'localhost:3000' }
        }
        const mockRes = {}
        
        const handled = await handler.handle(mockReq, mockRes)
        
        assert.equal(handled, true)
        assert.equal(mockRes.body, 'GET response')
    })
    
    await t.test('should call page.post() method for POST request', async () => {
        const handler = new DynamicPageHandler({
            pagesFolder: '/test/pages',
            findPageByRoute: (route) => {
                if (route === '/login.html') {
                    return {
                        filePath: '/test/pages/login.html',
                        post: async (req, res) => {
                            res.body = 'POST response'
                        }
                    }
                }
                return null
            }
        })
        
        const mockReq = {
            url: 'http://localhost:3000/login.html',
            method: 'POST',
            headers: { host: 'localhost:3000' }
        }
        const mockRes = {}
        
        const handled = await handler.handle(mockReq, mockRes)
        
        assert.equal(handled, true)
        assert.equal(mockRes.body, 'POST response')
    })
    
    await t.test('should return false if page not found', async () => {
        const handler = new DynamicPageHandler({
            pagesFolder: '/test/pages',
            findPageByRoute: (route) => null
        })
        
        const mockReq = {
            url: 'http://localhost:3000/notfound.html',
            method: 'GET',
            headers: { host: 'localhost:3000' }
        }
        const mockRes = {}
        
        const handled = await handler.handle(mockReq, mockRes)
        
        assert.equal(handled, false)
    })
    
    await t.test('should return false if page exists but method not implemented', async () => {
        const handler = new DynamicPageHandler({
            pagesFolder: '/test/pages',
            findPageByRoute: (route) => {
                if (route === '/static.html') {
                    return {
                        filePath: '/test/pages/static.html'
                        // no get() or post() methods
                    }
                }
                return null
            }
        })
        
        const mockReq = {
            url: 'http://localhost:3000/static.html',
            method: 'GET',
            headers: { host: 'localhost:3000' }
        }
        const mockRes = {}
        
        const handled = await handler.handle(mockReq, mockRes)
        
        assert.equal(handled, false)
    })
})
