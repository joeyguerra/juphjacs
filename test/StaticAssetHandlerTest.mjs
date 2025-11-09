import test from 'node:test'
import assert from 'node:assert/strict'
import { StaticAssetHandler } from '../src/infrastructure/http/StaticAssetHandler.mjs'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'

await test('StaticAssetHandler', async t => {
    const testBuildDir = '/tmp/juphjacs-test-static-assets'
    
    await t.before(async () => {
        await mkdir(join(testBuildDir, 'css'), { recursive: true })
        await mkdir(join(testBuildDir, 'js'), { recursive: true })
        await mkdir(join(testBuildDir, 'images'), { recursive: true })
        
        await writeFile(join(testBuildDir, 'css', 'style.css'), 'body { margin: 0; }')
        await writeFile(join(testBuildDir, 'js', 'app.js'), 'console.log("app")')
        await writeFile(join(testBuildDir, 'images', 'logo.png'), Buffer.from([0x89, 0x50, 0x4E, 0x47]))
    })
    
    await t.after(async () => {
        await rm(testBuildDir, { recursive: true, force: true })
    })
    
    await t.test('should serve CSS files', async () => {
        const handler = new StaticAssetHandler({
            buildFolder: testBuildDir
        })
        
        const mockReq = {
            url: 'http://localhost:3000/css/style.css',
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
        assert.equal(mockRes.headers['Content-Type'], 'text/css')
        assert.match(mockRes.body, /margin/)
    })
    
    await t.test('should serve JavaScript files', async () => {
        const handler = new StaticAssetHandler({
            buildFolder: testBuildDir
        })
        
        const mockReq = {
            url: 'http://localhost:3000/js/app.js',
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
        assert.match(mockRes.body, /console/)
    })
    
    await t.test('should serve binary files (images)', async () => {
        const handler = new StaticAssetHandler({
            buildFolder: testBuildDir
        })
        
        const mockReq = {
            url: 'http://localhost:3000/images/logo.png',
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
        assert.equal(mockRes.headers['Content-Type'], 'image/png')
        assert.ok(Buffer.isBuffer(mockRes.body))
    })
    
    await t.test('should return false for HTML files', async () => {
        const handler = new StaticAssetHandler({
            buildFolder: testBuildDir
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
    
    await t.test('should return false if file does not exist', async () => {
        const handler = new StaticAssetHandler({
            buildFolder: testBuildDir
        })
        
        const mockReq = {
            url: 'http://localhost:3000/css/missing.css',
            method: 'GET',
            headers: { host: 'localhost:3000' }
        }
        const mockRes = {}
        
        const handled = await handler.handle(mockReq, mockRes)
        
        assert.equal(handled, false)
    })
    
    await t.test('should return false for directory paths', async () => {
        const handler = new StaticAssetHandler({
            buildFolder: testBuildDir
        })
        
        const mockReq = {
            url: 'http://localhost:3000/images',
            method: 'GET',
            headers: { host: 'localhost:3000' }
        }
        const mockRes = {}
        
        const handled = await handler.handle(mockReq, mockRes)
        
        assert.equal(handled, false, 'Should return false for directories')
    })
    
    await t.test('should handle various file types with correct MIME types', async () => {
        const handler = new StaticAssetHandler({
            buildFolder: testBuildDir
        })
        
        const testCases = [
            { ext: 'json', mime: 'application/json' },
            { ext: 'xml', mime: 'application/xml' },
            { ext: 'svg', mime: 'image/svg+xml' },
            { ext: 'woff2', mime: 'font/woff2' },
            { ext: 'mp4', mime: 'video/mp4' },
            { ext: 'pdf', mime: 'application/pdf' }
        ]
        
        for (const { ext, mime } of testCases) {
            const result = handler.getContentType(ext)
            assert.equal(result, mime, `Expected ${ext} to have MIME type ${mime}`)
        }
    })
})
