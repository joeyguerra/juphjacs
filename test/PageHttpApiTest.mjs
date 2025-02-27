import { FetchRequest, FetchResponse } from '../src/FetchApi.mjs'
import { createServer } from 'node:http'

import test from 'node:test'
import assert from 'node:assert/strict'

import { join } from 'node:path'
import { readFile } from 'node:fs/promises'
import { SiteGenerator } from '../src/SiteGenerator.mjs'

import { MarkdownPage } from '../src/MarkdownPage.mjs'

const __dirname = new URL('.', import.meta.url).pathname

await test('Page HTTP API', async t => {
    await t.test('GET Return a Page', async () => {
        const siteGenerator = new SiteGenerator(__dirname, join(__dirname, 'html'), join(__dirname, 'site'))
        const server = createServer({
            IncomingMessage: FetchRequest,
            ServerResponse: FetchResponse
        })

        server.on('request', async (req, res) => {
            try {
                const page = await siteGenerator.getPage(getFileFromUrl(req), __dirname)
                await page.get(req, res)
            } catch (e) {
                console.error(e)
                res.end(e.message)
            }
        })

        await new Promise((resolve, reject) => {
            server.listen(0, 'localhost', resolve)
            server.on('error', reject)
        })
        const port = server.address().port
        const response = await fetch(`http://localhost:${port}/html/index.html`)

        await new Promise((resolve, reject) => {
            server.close(resolve)
        })

        const text = await response.text()
        assert.deepEqual(response.status, 200)
        assert.match(text, /<!DOCTYPE html>/)
        assert.match(text, /<h1>Test Page<\/h1>/)
        assert.match(text, /<\/html>/)
    })

    await t.test('Can include an html fragment in a page', async () => {
        const siteGenerator = new SiteGenerator(__dirname, join(__dirname, 'html'), join(__dirname, 'site'))
        const server = createServer({
            IncomingMessage: FetchRequest,
            ServerResponse: FetchResponse
        })

        server.on('request', async (req, res) => {
            const page = await siteGenerator.getPage(getFileFromUrl(req), __dirname)
            try {
                await page.get(req, res)
            } catch (e) {
                console.error(e)
                res.end(e.message)
            }
        })

        await new Promise((resolve, reject) => {
            server.listen(0, 'localhost', resolve)
            server.on('error', reject)
        })
        const port = server.address().port
        const response = await fetch(`http://localhost:${port}/html/fragment.html`)

        await new Promise((resolve, reject) => {
            server.close(resolve)
        })

        const text = await response.text()
        assert.deepEqual(response.status, 200)
        assert.match(text, /<!DOCTYPE html>/)
        assert.match(text, /<h2>This is the component name<\/h2>/)
        assert.match(text, /<\/html>/)
    })

    await t.test('Can redirect', async () => {
        const siteGenerator = new SiteGenerator(__dirname, join(__dirname, 'html'), join(__dirname, 'site'))
        const server = createServer({
            IncomingMessage: FetchRequest,
            ServerResponse: FetchResponse
        })

        server.on('request', async (req, res) => {
            const page = await siteGenerator.getPage(getFileFromUrl(req), __dirname)
            try {
                await page.get(req, res)
            } catch (e) {
                console.error(e)
                res.end(e.message)
            }
        })

        await new Promise((resolve, reject) => {
            server.listen(0, 'localhost', resolve)
            server.on('error', reject)
        })
        const port = server.address().port
        const response = await fetch(`http://localhost:${port}/html/redirect.html`, { redirect: 'manual' })
        await new Promise((resolve, reject) => {
            server.close(resolve)
        })
        const text = await response.text()
        assert.deepEqual(response.status, 302)
        assert.match(response.headers.get('Location'), /http:\/\/localhost\/cookie/)
        assert.match(text, /Redirect/)
    })
})

await test('Cookie', async t => {
    await t.test('Can set a cookie and render value in markup', async () => {
        const siteGenerator = new SiteGenerator(__dirname, join(__dirname, 'html'), join(__dirname, 'site'))
        const server = createServer({
            IncomingMessage: FetchRequest,
            ServerResponse: FetchResponse
        })

        server.on('request', async (req, res) => {
            const page = await siteGenerator.getPage(getFileFromUrl(req), __dirname)
            try {
                await page.get(req, res)
            } catch (e) {
                console.error(e)
                res.end(e.message)
            }
        })

        await new Promise((resolve, reject) => {
            server.listen(0, 'localhost', resolve)
            server.on('error', reject)
        })
        const port = server.address().port
        const response = await fetch(`http://localhost:${port}/html/cookie.html`, {
            headers: {
                Cookie: 'theme=dark'
            }
        })
        await new Promise((resolve, reject) => {
            server.close(resolve)
        })
        const text = await response.text()
        assert.deepEqual(response.status, 200)
        assert.match(text, /theme: dark/)
    })

})

await test('Page HTTP POST, PUT, DELETE API', async t => {
    await t.test('Can handle a POST request', async () => {
        const siteGenerator = new SiteGenerator(__dirname, join(__dirname, 'html'), join(__dirname, 'site'))
        const server = createServer({
            IncomingMessage: FetchRequest,
            ServerResponse: FetchResponse
        })

        server.on('request', async (req, res) => {
            const page = await siteGenerator.getPage(getFileFromUrl(req), __dirname)
            try {
                await page.post(req, res)
            } catch (e) {
                console.error(e)
                res.end(e.message)
            }
        })

        await new Promise((resolve, reject) => {
            server.listen(0, 'localhost', resolve)
            server.on('error', reject)
        })
        const port = server.address().port
        const response = await fetch(`http://localhost:${port}/html/upload.html`, {
            method: 'POST',
            headers: {
                'Content-Type': 'multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW'
            },
            body: `------WebKitFormBoundary7MA4YWxkTrZu0gW\r\nContent-Disposition: form-data; name="file"; filename="hello.txt"\r\nContent-Type: text/plain\r\n\r\nHello World\r\n------WebKitFormBoundary7MA4YWxkTrZu0gW--\r\n`
        })

        await new Promise((resolve, reject) => {
            server.close(resolve)
        })

        const text = await response.text()
        assert.deepEqual(response.status, 201)
        assert.match(text, /name: hello.txt/)
        assert.match(text, /size: 13/)
        assert.match(text, /Hello World/)
    })

    await t.test('Can handle a PUT request', async () => {
        const siteGenerator = new SiteGenerator(__dirname, join(__dirname, 'html'), join(__dirname, 'site'))
        const server = createServer({
            IncomingMessage: FetchRequest,
            ServerResponse: FetchResponse
        })

        server.on('request', async (req, res) => {
            const page = await siteGenerator.getPage(getFileFromUrl(req), __dirname)
            try {
                await page.put(req, res)
            } catch (e) {
                console.error(e)
                res.end(e.message)
            }
        })

        await new Promise((resolve, reject) => {
            server.listen(0, 'localhost', resolve)
            server.on('error', reject)
        })
        const port = server.address().port
        const response = await fetch(`http://localhost:${port}/html/route.html`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ param: '1' })
        })
        await new Promise((resolve, reject) => {
            server.close(resolve)
        })
        const text = await response.text()
        assert.deepEqual(response.status, 201)
        assert.match(text, /Hello 1/)
    })

    await t.test('Can handle a DELETE request', async () => {
        const siteGenerator = new SiteGenerator(__dirname, join(__dirname, 'html'), join(__dirname, 'site'))
        const server = createServer({
            IncomingMessage: FetchRequest,
            ServerResponse: FetchResponse
        })

        server.on('request', async (req, res) => {
            const page = await siteGenerator.getPage(getFileFromUrl(req), __dirname)
            try {
                await page.delete(req, res)
            } catch (e) {
                console.error(e)
                res.end(e.message)
            }
        })

        await new Promise((resolve, reject) => {
            server.listen(0, 'localhost', resolve)
            server.on('error', reject)
        })
        const port = server.address().port
        const response = await fetch(`http://localhost:${port}/html/route.html`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ param: '1' })
        })
        await new Promise((resolve, reject) => {
            server.close(resolve)
        })
        const text = await response.text()
        assert.deepEqual(response.status, 202)
        assert.match(text, /DELETE 1/)
    })

    await t.test('Respond to XML', async () => {
        const siteGenerator = new SiteGenerator(__dirname, join(__dirname, 'html'), join(__dirname, 'site'))
        const server = createServer({
            IncomingMessage: FetchRequest,
            ServerResponse: FetchResponse
        })

        server.on('request', async (req, res) => {
            const page = await siteGenerator.getPage(getFileFromUrl(req), __dirname)
            try {
                await page.get(req, res)
            } catch (e) {
                console.error(e)
                res.end(e.message)
            }
        })

        await new Promise((resolve, reject) => {
            server.listen(0, 'localhost', resolve)
            server.on('error', reject)
        })
        const port = server.address().port
        const response = await fetch(`http://localhost:${port}/html/sitemap.xml`)
        await new Promise((resolve, reject) => {
            server.close(resolve)
        })
        const text = await response.text()
        assert.deepEqual(response.headers.get('content-type'), 'text/xml')
        assert.deepEqual(response.status, 200)
        assert.match(text, /<\?xml version="1.0" encoding="UTF-8"\?>/)
    })
})

await test('Page: Markdown', async t => {
    await t.test('Render a markdown file', async () => {
        const server = createServer({
            IncomingMessage: FetchRequest,
            ServerResponse: FetchResponse
        })

        server.on('request', async (req, res) => {
            try {
                const filePath = getFileFromUrl(req).replace('.html', '.md')
                const page = new MarkdownPage(filePath, __dirname, await readFile(filePath, 'utf-8'))
                await page.get(req, res)
            } catch (e) {
                console.error(e)
                res.end(e.message)
            }
        })

        await new Promise((resolve, reject) => {
            server.listen(0, 'localhost', resolve)
            server.on('error', reject)
        })
        const port = server.address().port
        const response = await fetch(`http://localhost:${port}/html/markdown.html`)

        await new Promise((resolve, reject) => {
            server.close(resolve)
        })

        const text = await response.text()
        assert.deepEqual(response.status, 200)
        assert.match(text, /<!DOCTYPE html>/)
        assert.match(text, /<h1>Test Page for Markdown File<\/h1>/)
        assert.match(text, /<\/html>/)
    })

})

function getFileFromUrl(req) {
    const url = new URL(req.url, `http://${req.headers.host}`)
    const filePath = join(__dirname, url.pathname)
    return filePath
}
