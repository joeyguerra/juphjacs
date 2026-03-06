import test from 'node:test'
import assert from 'node:assert/strict'
import { JuphjacWebServer } from '../src/application/WebServer.mjs'

await test('JuphjacWebServer.handleFileChange copies resource JS files without treating them as page rebuild failures', async () => {
    const server = new JuphjacWebServer({ logLevel: 'error' })
    const calls = []

    server.logger = {
        info: () => {},
        debug: () => {},
        warn: () => calls.push('warn'),
        error: () => calls.push('error')
    }

    server.pathPolicy = {
        shouldProcess: () => true
    }

    server.assetPolicy = {
        getMeta: () => ({ assetType: 'js', hmrStrategy: 'full-reload' })
    }

    server.siteGenerator = {
        copyResourceFile: async (filePath) => ({
            filePath,
            relativePath: 'js/app.js'
        }),
        buildFile: async () => {
            calls.push('buildFile')
            return null
        }
    }

    server.websocketServer = {
        broadcast: (event, payload) => calls.push({ event, payload }),
        broadcastCssReload: () => calls.push('css'),
        sendFileChangedToPath: () => calls.push('file-changed')
    }

    await server.handleFileChange('change', '/tmp/project/pages/js/app.js')

    assert.deepEqual(calls, [
        {
            event: 'reload',
            payload: {
                filePath: '/tmp/project/pages/js/app.js',
                assetType: 'js'
            }
        }
    ])
})
