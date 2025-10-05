import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert'
import { ConfigLoader } from '../src/application/config/ConfigLoader.mjs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mkdir, writeFile, rm } from 'node:fs/promises'

describe('ConfigLoader', () => {
    let testDir
    let configPath

    beforeEach(async () => {
        testDir = join(tmpdir(), `juphjacs-config-test-${Date.now()}`)
        await mkdir(testDir, { recursive: true })
        configPath = join(testDir, 'site.config.mjs')
    })

    afterEach(async () => {
        try {
            await rm(testDir, { recursive: true, force: true })
        } catch (e) {
            // Ignore cleanup errors
        }
    })

    it('should load a basic configuration file', async () => {
        const configContent = `
export default {
    siteName: 'My Site',
    sourceFolder: './pages',
    buildFolder: './_site'
}
`
        await writeFile(configPath, configContent)
        
        const loader = new ConfigLoader(testDir)
        const config = await loader.load()
        
        assert.strictEqual(config.siteName, 'My Site')
        // Paths should be resolved to absolute
        assert.ok(config.sourceFolder.includes('pages'))
        assert.ok(config.buildFolder.includes('_site'))
    })

    it('should apply default values for missing properties', async () => {
        const configContent = `
export default {
    siteName: 'My Site'
}
`
        await writeFile(configPath, configContent)
        
        const loader = new ConfigLoader(testDir)
        const config = await loader.load()
        
        assert.strictEqual(config.siteName, 'My Site')
        // Default paths are resolved to absolute
        assert.ok(config.sourceFolder.includes('pages'))
        assert.ok(config.buildFolder.includes('_site'))
        assert.deepStrictEqual(config.resources, ['css', 'js', 'images'])
    })

    it('should load plugin configurations', async () => {
        const configContent = `
export default {
    siteName: 'My Site',
    plugins: [
        {
            name: 'blog',
            enabled: true,
            config: {
                postsFolder: 'blog'
            }
        },
        {
            name: 'sitemap',
            enabled: false
        }
    ]
}
`
        await writeFile(configPath, configContent)
        
        const loader = new ConfigLoader(testDir)
        const config = await loader.load()
        
        assert.strictEqual(config.plugins.length, 2)
        assert.strictEqual(config.plugins[0].name, 'blog')
        assert.strictEqual(config.plugins[0].enabled, true)
        assert.strictEqual(config.plugins[0].config.postsFolder, 'blog')
    })

    it('should validate required fields', async () => {
        const configContent = `
export default {
    siteName: '' // Empty site name should fail
}
`
        await writeFile(configPath, configContent)
        
        const loader = new ConfigLoader(testDir)
        
        await assert.rejects(
            async () => await loader.load(),
            /siteName is required/
        )
    })

    it('should use default configuration when file does not exist', async () => {
        const loader = new ConfigLoader(testDir)
        const config = await loader.load()
        
        assert.strictEqual(config.siteName, 'My Site')
        assert.ok(config.sourceFolder.includes('pages'))
        assert.ok(config.buildFolder.includes('_site'))
    })

    it('should resolve relative paths to absolute paths', async () => {
        const configContent = `
export default {
    siteName: 'My Site',
    sourceFolder: './pages',
    buildFolder: './_site'
}
`
        await writeFile(configPath, configContent)
        
        const loader = new ConfigLoader(testDir)
        const config = await loader.load()
        
        assert.ok(config.sourceFolder.startsWith('/') || config.sourceFolder.match(/^[A-Z]:\\/))
        assert.ok(config.buildFolder.startsWith('/') || config.buildFolder.match(/^[A-Z]:\\/))
    })

    it('should support custom file extensions', async () => {
        const configContent = `
export default {
    siteName: 'My Site',
    fileExtensions: {
        exclude: ['.html', '.xml', '.md', '.mjs'],
        include: ['.html', '.xml', '.md']
    }
}
`
        await writeFile(configPath, configContent)
        
        const loader = new ConfigLoader(testDir)
        const config = await loader.load()
        
        assert.deepStrictEqual(config.fileExtensions.exclude, ['.html', '.xml', '.md', '.mjs'])
        assert.deepStrictEqual(config.fileExtensions.include, ['.html', '.xml', '.md'])
    })

    it('should support port and host configuration', async () => {
        const configContent = `
export default {
    siteName: 'My Site',
    server: {
        port: 8080,
        host: '0.0.0.0'
    }
}
`
        await writeFile(configPath, configContent)
        
        const loader = new ConfigLoader(testDir)
        const config = await loader.load()
        
        assert.strictEqual(config.server.port, 8080)
        assert.strictEqual(config.server.host, '0.0.0.0')
    })
})
