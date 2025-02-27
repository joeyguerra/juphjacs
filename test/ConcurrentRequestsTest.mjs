import { FetchRequest, FetchResponse } from '../src/FetchApi.mjs'
import { createServer } from 'node:http'
import test from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { readFile } from 'node:fs/promises'
import { SiteGenerator } from '../src/SiteGenerator.mjs'
import { MarkdownPage } from '../src/MarkdownPage.mjs'

const __dirname = new URL('.', import.meta.url).pathname

function getFileFromUrl(req) {
    const url = new URL(req.url, `http://${req.headers.host}`)
    const filePath = join(__dirname, url.pathname)
    return filePath
}

await test('Concurrent Requests', async t => {
    await t.test('Each request should be isolated from each other', async () => {
        const siteGenerator = new SiteGenerator(__dirname, join(__dirname, 'html'), join(__dirname, 'site'))
        const server = createServer({
            IncomingMessage: FetchRequest,
            ServerResponse: FetchResponse
        })

        server.on('request', async (req, res) => {
            const sut = await siteGenerator.getPage(getFileFromUrl(req), __dirname)
            try {
                await sut.get(req, res)
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

        const tasks = [
            fetch(`http://localhost:${port}/html/cookie.html?id=1`, {
                headers: {
                    Cookie: 'theme=light'
                }
            }),
            fetch(`http://localhost:${port}/html/cookie.html?id=3`, {
                headers: {
                    Cookie: 'theme=dark'
                }
            }),
            fetch(`http://localhost:${port}/html/cookie.html?id=7`, {
                headers: {
                    Cookie: 'theme=custom'
                }
            })
        ]

        const expected = [
            {
                theme: 'theme: light',
                id: 'id: 1'
            },
            { 
                theme: 'theme: dark',
                id: 'id: 3'
            },
            {
                theme: 'theme: custom',
                id: 'id: 7'
            }
        ]

        const responses = await Promise.all(tasks)
        const actual = await Promise.all(responses.map(response => response.text()))
        for (const text of actual) {
            const expect = expected.shift()
            assert.match(text, new RegExp(expect.theme))
            assert.match(text, new RegExp(expect.id))
        }

        await new Promise((resolve, reject) => {
            server.close(resolve)
        })

    })

})
