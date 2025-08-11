import test from 'node:test'
import assert from 'node:assert/strict'
import { MarkdownRenderer } from '../src/MarkdownRenderer.mjs'

const __dirname = new URL('.', import.meta.url).pathname

await test('MarkdownRenderer', async t => {
    await t.test('Should render markdown with JSON front matter table to HTML', async t => {
        const renderer = new MarkdownRenderer()
        const markdown = `---
{
    "title": "Test Table",
    "description": "A simple markdown table test"
}
---
| Header 1 | Header 2 |
|----------|----------|
| Row 1   | Row 1   |
| Row 2   | Row 2   |
`
        const expected = `<table>
<thead>
<tr>
<th>Header 1</th>
<th>Header 2</th>
</tr>
</thead>
<tbody>
<tr>
<td>Row 1</td>
<td>Row 1</td>
</tr>
<tr>
<td>Row 2</td>
<td>Row 2</td>
</tr>
</tbody>
</table>
`
        const result = await renderer.render(markdown)
        assert.strictEqual(result, expected)
    })

    await t.test('Should not render markdown without front matter', async t => {
        const renderer = new MarkdownRenderer()
        const markdown = `
| Header 1 | Header 2 |
|----------|----------|
| Row 1   | Row 1   |
| Row 2   | Row 2   |
`
        const expected = `<table>
<thead>
<tr>
<th>Header 1</th>
<th>Header 2</th>
</tr>
</thead>
<tbody>
<tr>
<td>Row 1</td>
<td>Row 1</td>
</tr>
<tr>
<td>Row 2</td>
<td>Row 2</td>
</tr>
</tbody>
</table>
`
        const result = await renderer.render(markdown)
        assert.strictEqual(result, expected)
    })
})
