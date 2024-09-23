import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { Template, TemplateWithLayout } from '../src/Template.mjs'

await test('Template', async t => {
    await t.test('Properties in a context object are interpolated with string literal in a template.', async t => {
        const template = new Template('<h1>Hello ${name}</h1>')
        const html = await template.render({ name: 'world' })
        assert.equal(html, '<h1>Hello world</h1>')
    })
    await t.test('A partial html file can define a layout to be rendered within.', async t => {
        const layout = await readFile('tests/html/layout.html', 'utf-8')
        const html = await readFile('tests/html/index.html', 'utf-8')
        const expected = await readFile('tests/html/layout-expectation.html', 'utf-8')
        const template = new TemplateWithLayout(html, layout)
        const actual = await template.render({ title: 'Testing Page', name: 'world' })
        assert.equal(actual, expected)
    })
    await t.test('Javascript in <script server> tags is executed on the server and the exported module can be in string literals in the html file.', async t => {
        const html = await readFile('tests/html/script.html', 'utf-8')
        const expected = await readFile('tests/html/script-expectation.html', 'utf-8')
        const template = new Template(html)
        const actual = await template.render({ name: 'world' })
        assert.equal(actual, expected)
    })
    await t.test('Can import a node module and use it in a <script server> block', async t => {
        const html = await readFile('tests/html/import.html', 'utf-8')
        const expected = await readFile('tests/html/import-expectation.html', 'utf-8')
        const template = new Template(html)
        const actual = await template.render()
        assert.equal(actual, expected)
    })
})