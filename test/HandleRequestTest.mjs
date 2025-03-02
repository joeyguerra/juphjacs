import test from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { opendir, rm, mkdir } from 'node:fs/promises'
import { IncomingMessage, ServerResponse } from 'node:http'
import { handleRequest } from '../index.mjs'
import { SiteGenerator } from '../src/SiteGenerator.mjs'

const __dirname = new URL('.', import.meta.url).pathname

await test('Handle Requests', async t => {
    await t.test('should return a page with a pretty url', async t => {
        const rootFolder = join(__dirname)
        const pagesFolder = join(__dirname, 'html')
        const siteFolder = join(rootFolder, 'site-for-pretty-url')
        await mkdir(siteFolder, { recursive: true })
        const siteGenerator = new SiteGenerator(__dirname, pagesFolder, siteFolder)
        await siteGenerator.generateStaticSite(null)
        
        const req = new IncomingMessage()
        req.method = 'GET'
        req.url = '/pretty-url-routing'
        const res = new ServerResponse(req)
        await handleRequest(req, res, siteGenerator)
        assert.equal(res.statusCode, 200)
        assert.equal(res.statusMessage, 'OK')
        await rm(siteFolder, { recursive: true, force: true })
    })
})
