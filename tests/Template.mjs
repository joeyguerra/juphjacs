import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { Template, TemplateWithLayout } from '../src/Template.mjs'

await test('Template', async t => {
    await t.test('Properties in a context object are interpolated with string literal in a template.', async t => {
        const template = new Template(null)
        const html = await template.render('<h1>Hello ${name}</h1>', { name: 'world' })
        assert.equal(html, '<h1>Hello world</h1>')
    })
    await t.test('A partial html file can define a layout to be rendered within.', async t => {
        const html = await readFile('tests/html/index.html', 'utf-8')
        let expected = await readFile('tests/html/layout-expectation.html', 'utf-8')
        expected = expected.split('\n').map(line => line.trim()).join('')
        const template = new Template(readFile)
        let actual = await template.render(html, { title: 'Testing Page', name: 'world' })
        actual = actual.split('\n').map(line => line.trim()).join('')
        assert.equal(actual, expected)
    })
    await t.test('Javascript in <script server> tags is executed on the server and the exported module can be in string literals in the html file.', async t => {
        const html = await readFile('tests/html/script.html', 'utf-8')
        const expected = await readFile('tests/html/script-expectation.html', 'utf-8')
        const template = new Template(readFile)
        const actual = await template.render(html, { name: 'world' })
        assert.equal(actual, expected)
    })
    await t.test('Can import a node module and use it in a <script server> block', async t => {
        const html = await readFile('tests/html/import.html', 'utf-8')
        const expected = await readFile('tests/html/import-expectation.html', 'utf-8')
        const template = new Template(readFile)
        const actual = await template.render(html)
        assert.equal(actual, expected)
    })
    await t.test('Can set the route of a page', async t => {
        const html = await readFile('tests/html/route.html', 'utf-8')
        const template = new Template(readFile)
        const actual = await template.render(html)
        assert.equal(template.context.route, '/route')
    })
})