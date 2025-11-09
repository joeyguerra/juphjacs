import { test } from 'node:test'
import assert from 'node:assert'
import { ErrorHandler } from '../src/infrastructure/http/ErrorHandler.mjs'

test('ErrorHandler - should return 404 for file not found errors', async () => {
    const handler = new ErrorHandler()
        
        const req = {
            method: 'GET',
            url: '/non-existent.html',
            headers: { host: 'localhost:3000' }
        }
        
        let statusCode = null
        let responseBody = ''
        
        const res = {
            headersSent: false,
            writeHead: (code, headers) => {
                statusCode = code
            },
            end: (body) => {
                responseBody = body
            }
        }
        
        const error = new Error('ENOENT: no such file or directory')
        error.code = 'ENOENT'
        
        const result = await handler.handle(req, res, error)
        
    assert.strictEqual(result, true, 'ErrorHandler should always return true')
    assert.strictEqual(statusCode, 404)
    assert.match(responseBody, /Not Found/)
})

test('ErrorHandler - should return 405 for method not allowed', async () => {
    const handler = new ErrorHandler()
    
    const req = {
        method: 'DELETE',
        url: '/page.html',
        headers: { host: 'localhost:3000' }
    }
        
        let statusCode = null
        let responseBody = ''
        
        const res = {
            headersSent: false,
            writeHead: (code, headers) => {
                statusCode = code
            },
            end: (body) => {
                responseBody = body
            }
        }
        
        const error = new Error('Method not allowed')
        error.code = 'METHOD_NOT_ALLOWED'
        
        const result = await handler.handle(req, res, error)
        
    assert.strictEqual(result, true)
    assert.strictEqual(statusCode, 405)
    assert.match(responseBody, /Method Not Allowed/)
})

test('ErrorHandler - should return 500 for other errors', async () => {
    const handler = new ErrorHandler()
    
    const req = {
        method: 'GET',
        url: '/page.html',
        headers: { host: 'localhost:3000' }
    }
        
        let statusCode = null
        let responseBody = ''
        
        const res = {
            headersSent: false,
            writeHead: (code, headers) => {
                statusCode = code
            },
            end: (body) => {
                responseBody = body
            }
        }
        
        const error = new Error('Something went wrong')
        
        const result = await handler.handle(req, res, error)
        
    assert.strictEqual(result, true)
    assert.strictEqual(statusCode, 500)
    assert.match(responseBody, /Internal Server Error/)
})

test('ErrorHandler - should handle 404 when no error is provided', async () => {
    const handler = new ErrorHandler()
    
    const req = {
        method: 'GET',
        url: '/non-existent.html',
        headers: { host: 'localhost:3000' }
    }
        
        let statusCode = null
        
        const res = {
            headersSent: false,
            writeHead: (code, headers) => {
                statusCode = code
            },
            end: () => {}
        }
        
        const result = await handler.handle(req, res)
        
    assert.strictEqual(result, true)
    assert.strictEqual(statusCode, 404)
})

test('ErrorHandler - should not write if headers already sent', async () => {
    const handler = new ErrorHandler()
    
    const req = {
        method: 'GET',
        url: '/page.html',
        headers: { host: 'localhost:3000' }
    }
        
        let writeHeadCalled = false
        
        const res = {
            headersSent: true,
            writeHead: () => {
                writeHeadCalled = true
            },
            end: () => {}
        }
    
    const result = await handler.handle(req, res, new Error('Test'))
    
    assert.strictEqual(result, true)
    assert.strictEqual(writeHeadCalled, false, 'Should not call writeHead if headers sent')
})
