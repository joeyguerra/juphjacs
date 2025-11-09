import test from 'node:test'
import assert from 'node:assert/strict'
import { StaticPageHandler } from '../src/infrastructure/http/StaticPageHandler.mjs'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'

await test('StaticPageHandler', async t => {
    const testBuildDir = '/tmp/juphjacs-test-static-pages'
    
    // Setup test build directory
    await t.before(async () => {
        await mkdir(testBuildDir, { recursive: true })
        await writeFile(join(testBuildDir, 'index.html'), '<html><body>Home</body></html>')
        await writeFile(join(testBuildDir, 'about.html'), '<html><body>About</body></html>')
        await mkdir(join(testBuildDir, 'blog'), { recursive: true })
        await writeFile(join(testBuildDir, 'blog', 'index.html'), '<html><body>Blog</body></html>')
    })
    
    await t.after(async () => {
        await rm(testBuildDir, { recursive: true, force: true })
    })
    
    await t.test('should serve HTML files from build directory', async () => {
        const handler = new StaticPageHandler({
            buildFolder: testBuildDir
        })
        
        const mockReq = {
            url: 'http://localhost:3000/about.html',
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
        assert.equal(mockRes.headers['Content-Type'], 'text/html')
        assert.match(mockRes.body, /About/)
    })
    
    await t.test('should inject hot-reload script into HTML', async () => {
        const handler = new StaticPageHandler({
            buildFolder: testBuildDir
        })
        
        const mockReq = {
            url: 'http://localhost:3000/index.html',
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
        assert.match(mockRes.body, /HotReloader/)
        assert.match(mockRes.body, /__juphjacs__/)
    })
    
    await t.test('should resolve directory to index.html', async () => {
        const handler = new StaticPageHandler({
            buildFolder: testBuildDir
        })
        
        const mockReq = {
            url: 'http://localhost:3000/',
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
        assert.match(mockRes.body, /Home/)
    })
    
    await t.test('should resolve directory with trailing slash to index.html', async () => {
        const handler = new StaticPageHandler({
            buildFolder: testBuildDir
        })
        
        const mockReq = {
            url: 'http://localhost:3000/blog/',
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
        assert.match(mockRes.body, /Blog/)
    })
    
    await t.test('should return false for non-HTML files', async () => {
        const handler = new StaticPageHandler({
            buildFolder: testBuildDir
        })
        
        const mockReq = {
            url: 'http://localhost:3000/style.css',
            method: 'GET',
            headers: { host: 'localhost:3000' }
        }
        const mockRes = {}
        
        const handled = await handler.handle(mockReq, mockRes)
        
        assert.equal(handled, false)
    })
    
    await t.test('should return false if HTML file does not exist', async () => {
        const handler = new StaticPageHandler({
            buildFolder: testBuildDir
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
})
