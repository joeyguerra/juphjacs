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

const __dirname = new URL('.', import.meta.url).pathname

async function createPage(rootFolder, filePath, renderer) {
    const content = await readFile(filePath, 'utf-8')
    const templateRendererFactory = new TemplateRendererFactory(extname, [renderer])
    return new Page(rootFolder, filePath, content, templateRendererFactory, readFile)
}

async function testPageRendering(t, rootFolder, filePath, renderer, expectedRoute, expectedTitle, expectedLayout, assertions) {
    const page = await createPage(rootFolder, filePath, renderer)
    const expected = await createPage(rootFolder, filePath, renderer)
    expected.route = expectedRoute
    expected.title = expectedTitle
    expected.layout = expectedLayout
    const actual = await page.render()
    assertions(actual, expected)
}

await test('Page Rendering', async t => {
    await t.test('HTML Page', async t => {
        const rootFolder = join(__dirname, 'html')
        const filePath = join(rootFolder, 'index.html')
        await testPageRendering(t, rootFolder, filePath, new TemplateLiteralRenderer(resolve, readFile), '/index.html', 'Main page', join(rootFolder, 'layout.html'), (actual, expected) => {
            assert.match(actual.output, /<h1>Test Page<\/h1>/)
            assert.match(actual.output, /<!DOCTYPE html>/)
            assert.equal(actual.route, expected.route)
            assert.equal(actual.layout, expected.layout)
            assert.equal(actual.title, expected.title)
        })
    })

    await t.test('XML Page', async t => {
        const rootFolder = join(__dirname, 'html')
        const filePath = join(rootFolder, 'sitemap.xml')
        await testPageRendering(t, rootFolder, filePath, new XmlRenderer(resolve, readFile), '/sitemap.xml', null, null, (actual, expected) => {
            assert.match(actual.output, /<\?xml version="1.0" encoding="UTF-8"\?>/)
            assert.match(actual.output, /<loc>https:\/\/example.com\/<\/loc>/is)
            assert.equal(actual.route, expected.route)
        })
    })

    await t.test('Markdown Page', async t => {
        const rootFolder = join(__dirname, 'markdown')
        const filePath = join(rootFolder, 'index.md')
        await testPageRendering(t, rootFolder, filePath, new MarkdownRenderer(resolve, readFile, new MarkdownIt({
            html: true,
            linkify: true,
            typographer: true
        })), '/index.html', 'Main page', join(rootFolder, 'layout.html'), (actual, expected) => {
            assert.match(actual.output, /<h1>This is a test markdown page<\/h1>/)
            assert.match(actual.output, /<!DOCTYPE html>/)
            assert.equal(actual.route, expected.route)
        })
    })
})

async function testHttpApi(method, url, body, headers, assertions) {
    const rootFolder = join(__dirname, 'html')
    const filePath = join(rootFolder, 'route.html')
    const page = await createPage(rootFolder, filePath, new TemplateLiteralRenderer(resolve, readFile))
    await page.render()
    const request = new Request(url, { method, headers, body })
    const response = await page[method.toLowerCase()](request)
    assertions(response)
}

await test('Page HTTP API', {only: true}, async t => {
    await t.test('GET /route', {only: true}, async () => {
        await testHttpApi('GET', 'http://localhost/route/World', null, {}, async response => {
            assert.equal(response.status, 200)
            assert.match(await response.text(), /Hello World/)
        })
    })

    await t.test('POST /route', async () => {
        const formData = new URLSearchParams()
        formData.append('param', 'World')
        await testHttpApi('POST', 'http://localhost/route', formData.toString(), {
            'Content-Type': 'application/x-www-form-urlencoded'
        }, async response => {
            assert.equal(response.status, 200)
            assert.match(await response.text(), /Hello World/)
        })
    })

    await t.test('PUT /route', async () => {
        const body = JSON.stringify({ param: 'JSON World' })
        await testHttpApi('PUT', 'http://localhost/route', body, {
            'Content-Type': 'application/json'
        }, async response => {
            assert.equal(response.status, 200)
            assert.match(await response.text(), /Hello JSON World/)
        })
    })

    await t.test('File upload', async () => {
        const rootFolder = join(__dirname, 'html')
        const filePath = join(rootFolder, 'upload.html')
        const page = await createPage(rootFolder, filePath, new TemplateLiteralRenderer(resolve, readFile))
        await page.render()
        const formData = new FormData()
        formData.append('file', new Blob(['Hello World'], { type: 'text/plain' }), 'hello.txt')
        const response = await page.post(new Request('http://localhost/upload', {
            method: 'POST',
            body: formData
        }), new Response())
        assert.equal(response.status, 200)
        const text = await response.text()
        assert.match(text, /name: hello.txt/)
        assert.match(text, /size: 11/)
        assert.match(text, /Hello World/)
    })

    await t.test('Can set a cookie and render value in markup', async () => {
        const rootFolder = join(__dirname, 'html')
        const filePath = join(rootFolder, 'cookie.html')
        const page = await createPage(rootFolder, filePath, new TemplateLiteralRenderer(resolve, readFile))
        await page.render()
        const response = await page.get(new Request('http://localhost/cookie', {
            headers: {
                Cookie: 'theme=dark'
            }
        }), new Response())
        assert.equal(response.status, 200)
        assert.match(await response.text(), /theme: dark/)
    })

    await t.test('Can set a cookie on redirect', async () => {
        const rootFolder = join(__dirname, 'html')
        const filePath = join(rootFolder, 'redirect.html')
        const page = await createPage(rootFolder, filePath, new TemplateLiteralRenderer(resolve, readFile))
        await page.render()
        const response = await page.get(new Request('http://localhost/redirect'), new Response())
        assert.equal(response.status, 302)
        const cookiePage = await createPage(rootFolder, join(rootFolder, 'cookie.html'), new TemplateLiteralRenderer(resolve, readFile))
        await cookiePage.render()
        const cookieResponse = await cookiePage.get(new Request(response.headers.get('Location'), {
            headers: {
                Cookie: response.headers.get('Set-Cookie')
            }
        }), new Response())
        assert.equal(cookieResponse.status, 200)
        assert.match(await cookieResponse.text(), /theme: dark/)
    })
})