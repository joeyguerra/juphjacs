import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { RequestBodyParser } from '../src/RequestBodyParser.mjs'
import fs from 'node:fs'
import crypto from 'node:crypto'


async function parseRequestBody(request) {
    return new RequestBodyParser(request).parse()
}

const createTestServer = () => {
    return http.createServer(async (req, res) => {
        if (req.method === 'POST') {
            try {
                const parsedBody = await parseRequestBody(req)
                res.writeHead(200, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ received: parsedBody }))
            } catch (error) {
                res.writeHead(400, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ error: error.message }))
            }
        } else {
            res.writeHead(405).end()
        }
    })
}


class FormData {
    #streams = []
    #fields = []
    #boundary = ''
    constructor() {
        this.#boundary = `----WebKitFormBoundary${crypto.randomUUID()}`
    }
    
    append(name, value, filename) {
        if (value instanceof fs.ReadStream) {
            this.#streams.push({ name, value, filename })
        } else {
            this.#fields.push({ name, value })
        }
    }
    
    get headers() {
        return { 'Content-Type': `multipart/form-data; boundary=${this.#boundary}` }
    }

    async *[Symbol.asyncIterator]() {
        for (const field of this.#fields) {
            yield `--${this.#boundary}\r\nContent-Disposition: form-data; name="${field.name}"\r\n\r\n${field.value}\r\n`
        }
        for (const stream of this.#streams) {
            yield `--${this.#boundary}\r\nContent-Disposition: form-data; name="${stream.name}"; filename="${stream.filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`
            yield* stream.value
            yield '\r\n'
        }
        yield `--${this.#boundary}--\r\n`
    }
}


test('Parse JSON body correctly', async () => {
    const server = createTestServer()
    await new Promise((resolve) => server.listen(0, resolve))
    const port = server.address().port

    const response = await fetch(`http://localhost:${port}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Alice', age: 25 })
    })

    const data = await response.json()
    assert.deepEqual(data, { received: { name: 'Alice', age: 25 } })

    server.close()
})

test('Parse URL-encoded body correctly', async () => {
    const server = createTestServer()
    await new Promise((resolve) => server.listen(0, resolve))
    const port = server.address().port

    const response = await fetch(`http://localhost:${port}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'name=Bob&age=30'
    })

    const data = await response.json()
    assert.deepEqual(data, { received: { name: 'Bob', age: '30' } })

    server.close()
})

test('Parse text/plain body correctly', async () => {
    const server = createTestServer()
    await new Promise((resolve) => server.listen(0, resolve))
    const port = server.address().port

    const response = await fetch(`http://localhost:${port}`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: 'Hello, world!'
    })

    const data = await response.json()
    assert.deepEqual(data, { received: 'Hello, world!' })

    server.close()
})

test('Return an error for invalid JSON', async () => {
    const server = createTestServer()
    await new Promise((resolve) => server.listen(0, resolve))
    const port = server.address().port

    const response = await fetch(`http://localhost:${port}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{ invalid json '
    })

    const data = await response.json()
    assert.equal(data.error, 'Invalid request body')

    server.close()
})

test('Return 405 for non-POST requests', async () => {
    const server = createTestServer()
    await new Promise((resolve) => server.listen(0, resolve))
    const port = server.address().port

    const response = await fetch(`http://localhost:${port}`, {
        method: 'GET'
    })

    assert.equal(response.status, 405)

    server.close()
})

test('Parse multipart form-data (file upload) correctly', async () => {
    const server = createTestServer()
    await new Promise((resolve) => server.listen(0, resolve))
    const port = server.address().port

    const form = new FormData()
    form.append('username', 'Charlie')
    form.append('file', fs.createReadStream('./test/testFile.txt'), 'testFile.txt')

    const response = await fetch(`http://localhost:${port}`, {
        method: 'POST',
        headers: form.headers,
        body: form,
        duplex: 'half'
    })

    const data = await response.json()
    assert.equal(data.received.fields.username, 'Charlie')
    assert.equal(data.received.files.file.filename, 'testFile.txt')
    server.close()
})


