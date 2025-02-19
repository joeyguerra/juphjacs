import test from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { opendir, rm, mkdir } from 'node:fs/promises'
import { IncomingMessage, ServerResponse } from 'node:http'
import { SiteGenerator } from '../src/SiteGenerator.mjs'

const __dirname = new URL('.', import.meta.url).pathname

await test('SiteGenerator', async t => {
    await t.test('should generate a site', async t => {
        const rootFolder = join(__dirname, 'fixtures')
        const pagesFolder = join(rootFolder, 'pages')
        const siteFolder = join(rootFolder, 'site')
        await mkdir(siteFolder, { recursive: true })
        const filesToCopyOver = [{ from: join(pagesFolder, 'index.html'), to: join(siteFolder, 'index.html') }]
        const foldersToCopyOver = ['css', 'images']
        const generator = new SiteGenerator(rootFolder, pagesFolder, siteFolder, filesToCopyOver, foldersToCopyOver)
        const req = new IncomingMessage()
        const res = new ServerResponse(req)
        await generator.generateStaticSite(req, res)
        const files = []
        for await (let file of await generator.readAllFiles(siteFolder)) {
            files.push(file)
        }
        assert.ok(files.some(file => file.includes('index.html')))
        assert.ok(files.some(file => file.includes('css')))
        assert.ok(files.some(file => file.includes('images')))
        await rm(siteFolder, { recursive: true, force: true })
    })
})

