import test, { beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { opendir, readFile } from 'node:fs/promises'
import { join, extname, resolve } from 'node:path'
import MarkdownIt from 'markdown-it'
import { TemplateLiteralRenderer } from '../src/TemplateLiteralRenderer.mjs'
import { MarkdownRenderer } from '../src/MarkdownRenderer.mjs'
import { XmlRenderer } from '../src/XmlRenderer.mjs'
import { TemplateRendererFactory } from '../src/TemplateRendererFactory.mjs'
import { Page } from '../src/Page.mjs'
import { IncomingMessage, ServerResponse } from 'node:http'
import { UriToStaticFileRoute } from '../src/UriToStaticFileRoute.mjs'
import { url } from 'node:inspector'

const __dirname = new URL('.', import.meta.url).pathname

await test('Page Rendering', async t => {
    await t.test('HTML Page', async t => {
        const rootFolder = join(__dirname, 'html')
        const filePath = join(rootFolder, 'index.html')
        
        await testPageRendering(t, rootFolder, filePath, new TemplateLiteralRenderer(), new UriToStaticFileRoute( /\/index.html/, filePath), 'Main page', join(rootFolder, 'layout.html'), (actual, expected) => {
            assert.match(actual.output, /<h1>Test Page<\/h1>/)
            assert.match(actual.output, /<!DOCTYPE html>/)
            assert.deepEqual(actual.route, expected.route)
            assert.deepEqual(actual.layout, expected.layout)
            assert.deepEqual(actual.title, expected.title)
        })
    })

    await t.test('XML Page', async t => {
        const rootFolder = join(__dirname, 'html')
        const filePath = join(rootFolder, 'sitemap.xml')
        await testPageRendering(t, rootFolder, filePath, new XmlRenderer(), new UriToStaticFileRoute(/\/sitemap.xml/, filePath), null, null, (actual, expected) => {
            assert.match(actual.output, /<\?xml version="1.0" encoding="UTF-8"\?>/)
            assert.match(actual.output, /<loc>https:\/\/example.com\/<\/loc>/is)
            assert.deepEqual(actual.route, expected.route)
        })
    })

    await t.test('Markdown Page', async t => {
        const rootFolder = join(__dirname, 'markdown')
        const filePath = join(rootFolder, 'index.md')
        await testPageRendering(t, rootFolder, filePath, new MarkdownRenderer(, new MarkdownIt({
            html: true,
            linkify: true,
            typographer: true
        })), new UriToStaticFileRoute(/\/index.html/, filePath.replace('.md', '.html')), 'Main page', join(rootFolder, 'layout.html'), (actual, expected) => {
            assert.match(actual.output, /<h1>This is a test markdown page<\/h1>/)
            assert.match(actual.output, /<!DOCTYPE html>/)
            assert.deepEqual(actual.route, expected.route)
        })
    })
})

async function testHttpApi(method, url, body, headers, assertions) {
    const rootFolder = join(__dirname, 'html')
    const filePath = join(rootFolder, 'route.html')
    const page = await createPage(rootFolder, filePath, new TemplateLiteralRenderer())
    await page.render()
    const req = new IncomingMessage()
    req.method = method
    req.headers = headers
    if (body) {
        req.push(body)
    }
    req.push(null)
    req.url = url
    const res = new ServerResponse(req)
    await page[method.toLowerCase()](req, res)
    assertions(req, res)
}

await test('Page HTTP API', async t => {
    await t.test('GET /route', async () => {
        await testHttpApi('GET', 'http://localhost/route/World', null, {}, async (req, res) => {
            assert.deepEqual(res.status, 200)
            assert.match(await res.text(), /Hello World/)
        })
    })

    await t.test('POST /route', async () => {
        const formData = new URLSearchParams()
        formData.append('param', 'World')
        await testHttpApi('POST', 'http://localhost/route', formData.toString(), {
            'Content-Type': 'application/x-www-form-urlencoded'
        }, async (req, res) => {
            assert.deepEqual(res.status, 200)
            assert.match(await res.text(), /Hello World/)
        })
    })

    await t.test('PUT /route', async () => {
        const body = JSON.stringify({ param: 'JSON World' })
        await testHttpApi('PUT', 'http://localhost/route', body, {
            'Content-Type': 'application/json'
        }, async (req, res) => {
            assert.deepEqual(res.status, 200)
            assert.match(await res.text(), /Hello JSON World/)
        })
    })

    await t.test('File upload', async () => {
        const rootFolder = join(__dirname, 'html')
        const filePath = join(rootFolder, 'upload.html')
        const page = await createPage(rootFolder, filePath, new TemplateLiteralRenderer())
        await page.render()
        const formData = new FormData()
        formData.append('file', new Blob(['Hello World'], { type: 'text/plain' }), 'hello.txt')
        const req = new IncomingMessage()
        req.method = 'POST'
        req.headers = {
            'Content-Type': 'multipart/form-data; boundary=' + formData._boundary
        }
        const boundary = formData._boundary
        const body = Buffer.concat(formData.getBuffer())
        req.push(Buffer.from(`--${boundary}\r\n`))
        req.push(Buffer.from(`Content-Disposition: form-data; name="file"; filename="hello.txt"\r\n`))
        req.push(Buffer.from(`Content-Type: text/plain\r\n\r\n`))
        req.push(Buffer.from('Hello World\r\n'))
        req.push(Buffer.from(`--${boundary}--\r\n`))
        req.push(null)
        req.url = 'http://localhost/upload'
        const res = new ServerResponse(req)
        await page.post(req, res)
        assert.deepEqual(res.status, 200)

        const text = await res.text()        
        assert.match(text, /name: hello.txt/)
        assert.match(text, /size: 11/)
        assert.match(text, /Hello World/)
    })

    await t.test('Can set a cookie and render value in markup', async () => {
        const rootFolder = join(__dirname, 'html')
        const filePath = join(rootFolder, 'cookie.html')
        const page = await createPage(rootFolder, filePath, new TemplateLiteralRenderer())
        await page.render()
        const response = await page.get(new Request('http://localhost/cookie', {
            headers: {
                Cookie: 'theme=dark'
            }
        }), new Response())
        assert.deepEqual(response.status, 200)
        assert.match(await response.text(), /theme: dark/)
    })

    await t.test('Can set a cookie on redirect', async () => {
        const rootFolder = join(__dirname, 'html')
        const filePath = join(rootFolder, 'redirect.html')
        const page = await createPage(rootFolder, filePath, new TemplateLiteralRenderer())
        await page.render()
        const req = new IncomingMessage()
        req.url = 'http://localhost/redirect'
        const res = new ServerResponse(req)
        await page.get(req, res)
        assert.deepEqual(res.status, 302)
        const cookiePage = await createPage(rootFolder, join(rootFolder, 'cookie.html'), new TemplateLiteralRenderer())
        await cookiePage.render(cookiePage)
        console.log(res.headers['Location'])
        const cookieRequest = new IncomingMessage()
        console.log(res)
        cookieRequest.url = res.headers['Location']
        const cookieResponse = new ServerResponse(cookieRequest)
        await cookiePage.get(cookieRequest, {
            headers: {
                Cookie: res.headers['Set-Cookie']
            }
        }, cookieResponse)
        assert.deepEqual(cookieResponse.status, 200)
        assert.match(await cookieResponse.text(), /theme: dark/)
    })
})