import { FetchRequest, FetchResponse } from '../src/infrastructure/http/FetchApi.mjs'
import { createServer } from 'node:http'

import test from 'node:test'
import assert from 'node:assert/strict'

await test('Fetch API', async t => {
    await t.test('Start a server with Fetch API', async () => {
        const server = createServer({
            IncomingMessage: FetchRequest,
            ServerResponse: FetchResponse
        })

        server.on('request', (req, res) => {
            res.end('Hello World')
        })

        await new Promise((resolve, reject) => {
            server.listen(0, 'localhost', resolve)
            server.on('error', reject)
        })
        const port = server.address().port
        const response = await fetch(`http://localhost:${port}`)

        await new Promise((resolve, reject) => {
            server.close(resolve)
        })

        assert.deepEqual(response.status, 200)
        assert.match(await response.text(), /Hello World/)
    })

    await t.test('Can set a cookie and render value in markup', async () => {
        const server = createServer({
            IncomingMessage: FetchRequest,
            ServerResponse: FetchResponse
        })

        server.on('request', (req, res) => {
            res.setHeader('Set-Cookie', 'theme=dark')
            res.end('theme: dark')
        })

        await new Promise((resolve, reject) => {
            server.listen(0, 'localhost', resolve)
            server.on('error', reject)
        })
        const port = server.address().port
        const response = await fetch(`http://localhost:${port}`, {
            headers: {
                Cookie: 'theme=dark'
            }
        })

        await new Promise((resolve, reject) => {
            server.close(resolve)
        })

        assert.deepEqual(response.status, 200)
        assert.match(await response.text(), /theme: dark/)
        assert.match(response.headers.get('Set-Cookie'), /theme=dark/)
    })

    await t.test('Can POST a form with Fetch API', async () => {
        const server = createServer({
            IncomingMessage: FetchRequest,
            ServerResponse: FetchResponse
        })
        server.on('request', async (req, res) => {
            const formData = await req.formData()
            const file = formData.files.file
            res.end(`name: ${file.filename} size: ${file.size} ${await file.text()}`)
        })

        const port = await new Promise((resolve, reject) => {
            server.on('error', reject)
            server.listen(0, 'localhost', () => {
                console.log('Server listening on http://localhost:' + server.address().port)
                resolve(server.address().port)
            })
        })

        const formData = new FormData()
        formData.append('file', new Blob(['Hello World'], { type: 'text/plain' }), 'hello.txt')
        const response = await fetch(`http://localhost:${port}/upload`, {
            method: 'POST',
            body: formData
        })

        await new Promise((resolve, reject) => {
            server.close(resolve)
        })

        assert.deepEqual(response.status, 200)

        const text = await response.text()
        assert.match(text, /name: hello.txt/)
        assert.match(text, /size: 13/)
        assert.match(text, /Hello World/)
    })

    await t.test('Can POST a JSON with Fetch API', async () => {
        const server = createServer({
            IncomingMessage: FetchRequest,
            ServerResponse: FetchResponse
        })
        server.on('request', async (req, res) => {
            try {
                const json = await req.json()
                res.end(JSON.stringify(json))
            } catch (error) {
                console.error(error)
                res.end(error.message)
            }
        })

        const port = await new Promise((resolve, reject) => {
            server.on('error', reject)
            server.listen(0, 'localhost', () => {
                console.log('Server listening on http://localhost:' + server.address().port)
                resolve(server.address().port)
            })
        })
        const expected = { hello: 'world' }
        const response = await fetch(`http://localhost:${port}/json`, {
            method: 'POST',
            body: JSON.stringify({ hello: 'world' }),
            headers: {
                'Content-Type': 'application/json'
            }
        })
        assert.deepEqual(response.status, 200)

        const json = await response.json()
        
        await new Promise((resolve, reject) => {
            server.close(resolve)
        })
        assert.deepEqual(json, expected)
    })

    await t.test('Can POST a text with Fetch API', async () => {
        const server = createServer({
            IncomingMessage: FetchRequest,
            ServerResponse: FetchResponse
        })
        server.on('request', async (req, res) => {
            res.end(await req.text())
        })

        const port = await new Promise((resolve, reject) => {
            server.on('error', reject)
            server.listen(0, 'localhost', () => {
                console.log('Server listening on http://localhost:' + server.address().port)
                resolve(server.address().port)
            })
        })

        const response = await fetch(`http://localhost:${port}/text`, {
            method: 'POST',
            body: 'Hello World',
            headers: {
                'Content-Type': 'text/plain'
            }
        })

        await new Promise((resolve, reject) => {
            server.close(resolve)
        })

        assert.deepEqual(response.status, 200)
        assert.match(await response.text(), /Hello World/)

    })

    await t.test('Can send query string parameters with Fetch API', async () => {
        const server = createServer({
            IncomingMessage: FetchRequest,
            ServerResponse: FetchResponse
        })
        server.on('request', async (req, res) => {
            const url = new URL(req.url, 'http://localhost')
            res.end(url.searchParams.toString())
        })

        const port = await new Promise((resolve, reject) => {
            server.on('error', reject)
            server.listen(0, 'localhost', () => {
                console.log('Server listening on http://localhost:' + server.address().port)
                resolve(server.address().port)
            })
        })

        const response = await fetch(`http://localhost:${port}/query?hello=world`)
        await new Promise((resolve, reject) => {
            server.close(resolve)
        })

        assert.deepEqual(response.status, 200)
        assert.match(await response.text(), /hello=world/)
    })
})
