import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { Page } from '../src/Page.mjs'
import { TemplateLiteralRenderer } from '../src/TemplateLiteralRenderer.mjs'

await test('PrettyUrlRoutingTest', async t => {
    await t.test('Should load page with a pretty URL', async t => {
        const rootFolder = resolve('test', 'fixtures')
        const filePath = resolve(rootFolder, 'pages', 'pretty-url-routing.mjs')
        const template = await readFile(filePath, 'utf-8')
        const pageModule = await import(filePath)
        const pageInstance = new Page(rootFolder, filePath, template, new TemplateLiteralRenderer())
        const req = { url: '/pretty-url-routing', headers: { host: 'localhost' } }
        const res = { end: () => {} }
        const expected = 'Test Pretty URL Routing'
        await pageInstance.get(req, res)
        assert.equal(pageInstance.title, expected)
    })
})