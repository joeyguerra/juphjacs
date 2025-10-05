import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert'
import { SiteGenerator } from '../src/application/SiteGenerator.mjs'
import { PluginManager } from '../src/application/plugins/PluginManager.mjs'
import { Plugin } from '../src/application/plugins/Plugin.mjs'
import { PageRepository } from '../src/domain/pages/PageRepository.mjs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mkdir, writeFile, rm, readFile } from 'node:fs/promises'

describe('SiteGenerator (Refactored)', () => {
    let testDir
    let sourceDir
    let buildDir
    let generator
    let pluginManager
    let repository

    beforeEach(async () => {
        testDir = join(tmpdir(), `juphjacs-sitegen-test-${Date.now()}`)
        sourceDir = join(testDir, 'pages')
        buildDir = join(testDir, '_site')
        
        await mkdir(sourceDir, { recursive: true })
        await mkdir(buildDir, { recursive: true })

        pluginManager = new PluginManager()
        repository = new PageRepository(sourceDir)
        
        const config = {
            siteName: 'Test Site',
            sourceFolder: sourceDir,
            buildFolder: buildDir,
            resources: ['css', 'js']
        }

        generator = new SiteGenerator(config, pluginManager, repository)
    })

    afterEach(async () => {
        try {
            await rm(testDir, { recursive: true, force: true })
        } catch (e) {
            // Ignore cleanup errors
        }
    })

    describe('initialization', () => {
        it('should initialize with config, plugin manager, and repository', () => {
            assert.ok(generator.config)
            assert.ok(generator.pluginManager)
            assert.ok(generator.repository)
            assert.strictEqual(generator.config.siteName, 'Test Site')
        })

        it('should call plugin onInit hooks during initialization', async () => {
            let initCalled = false
            
            class TestPlugin extends Plugin {
                async onInit() {
                    initCalled = true
                }
            }

            pluginManager.register(new TestPlugin('test'))
            await generator.initialize()
            
            assert.strictEqual(initCalled, true)
        })
    })

    describe('build process', () => {
        it('should build a simple HTML page', async () => {
            const htmlContent = '<html><body><h1>Test</h1></body></html>'
            await writeFile(join(sourceDir, 'index.html'), htmlContent)

            await generator.build()

            const outputPath = join(buildDir, 'index.html')
            const output = await readFile(outputPath, 'utf-8')
            assert.ok(output.includes('<h1>Test</h1>'))
        })

        it('should trigger plugin lifecycle hooks in correct order', async () => {
            const hookOrder = []

            class OrderTestPlugin extends Plugin {
                async onInit() {
                    hookOrder.push('init')
                }
                async onContentLoaded(pages) {
                    hookOrder.push('contentLoaded')
                    return pages
                }
                async onPageRendered(page) {
                    hookOrder.push('pageRendered')
                }
                async onBuildComplete(site) {
                    hookOrder.push('buildComplete')
                }
            }

            pluginManager.register(new OrderTestPlugin('order'))
            
            await writeFile(join(sourceDir, 'test.html'), '<h1>Test</h1>')
            await generator.initialize()
            await generator.build()

            assert.deepStrictEqual(hookOrder, ['init', 'contentLoaded', 'pageRendered', 'buildComplete'])
        })

        it('should store pages in repository', async () => {
            await writeFile(join(sourceDir, 'page1.html'), '<h1>Page 1</h1>')
            await writeFile(join(sourceDir, 'page2.html'), '<h1>Page 2</h1>')

            await generator.build()

            const pages = repository.all()
            assert.strictEqual(pages.length, 2)
        })

        it('should allow plugins to filter pages', async () => {
            class FilterPlugin extends Plugin {
                async onContentLoaded(pages) {
                    return pages.filter(p => !p.filePath.includes('draft'))
                }
            }

            pluginManager.register(new FilterPlugin('filter'))

            await writeFile(join(sourceDir, 'published.html'), '<h1>Published</h1>')
            await writeFile(join(sourceDir, 'draft.html'), '<h1>Draft</h1>')

            await generator.initialize()
            await generator.build()

            const outputExists = async (filename) => {
                try {
                    await readFile(join(buildDir, filename))
                    return true
                } catch {
                    return false
                }
            }

            assert.strictEqual(await outputExists('published.html'), true)
            assert.strictEqual(await outputExists('draft.html'), false)
        })
    })

    describe('markdown processing', () => {
        it('should process markdown files with frontmatter', async () => {
            const markdown = `---
title: 'Test Post'
published: true
---

# Hello World

This is a test.`

            await writeFile(join(sourceDir, 'post.md'), markdown)
            await generator.build()

            const output = await readFile(join(buildDir, 'post.html'), 'utf-8')
            assert.ok(output.includes('<h1>Hello World</h1>'))
            assert.ok(output.includes('<p>This is a test.</p>'))
        })

        it('should make frontmatter data available to templates', async () => {
            const markdown = `---
title: 'My Title'
---

Content here`

            await writeFile(join(sourceDir, 'page.md'), markdown)
            await generator.build()

            const page = repository.findByFilePath(join(sourceDir, 'page.md'))
            assert.strictEqual(page.title, 'My Title')
        })
    })

    describe('template rendering', () => {
        it('should render template literals with context', async () => {
            // Test with a simpler approach - markdown with frontmatter
            const markdown = `---
title: 'Dynamic Title'
content: 'Dynamic Content'
---

# \${title}

\${content}`

            await writeFile(join(sourceDir, 'dynamic.md'), markdown)

            await generator.build()

            const output = await readFile(join(buildDir, 'dynamic.html'), 'utf-8')
            assert.ok(output.includes('Dynamic Title'))
            assert.ok(output.includes('Dynamic Content'))
        })

        it('should support layouts', async () => {
            const layout = '<html><head><title>${title}</title></head><body>${body}</body></html>'
            const page = `---
layout: '${join(sourceDir, 'layout.html')}'
title: 'Page Title'
---

# Content`

            await writeFile(join(sourceDir, 'layout.html'), layout)
            await writeFile(join(sourceDir, 'page.md'), page)

            await generator.build()

            const output = await readFile(join(buildDir, 'page.html'), 'utf-8')
            assert.ok(output.includes('<title>Page Title</title>'))
            assert.ok(output.includes('<h1>Content</h1>'))
        })
    })

    describe('resource copying', () => {
        it('should copy resource folders to build directory', async () => {
            await mkdir(join(sourceDir, 'css'), { recursive: true })
            await writeFile(join(sourceDir, 'css', 'style.css'), 'body { color: red; }')

            await generator.build()

            const cssContent = await readFile(join(buildDir, 'css', 'style.css'), 'utf-8')
            assert.strictEqual(cssContent, 'body { color: red; }')
        })
    })

    describe('error handling', () => {
        it('should handle plugin errors gracefully', async () => {
            class FailingPlugin extends Plugin {
                async onInit() {
                    throw new Error('Plugin init failed')
                }
            }

            pluginManager.register(new FailingPlugin('failing'))

            await assert.rejects(
                async () => await generator.initialize(),
                /Plugin init failed/
            )
        })

        it('should not emit error if variable is undefined', async () => {
            // Create a page with an undefined variable in template
            await writeFile(join(sourceDir, 'bad.html'), '<h1>${undefinedVar ?? ""}</h1>')
            await generator.build()

            // Error should not have been emitted
            const output = await readFile(join(buildDir, 'bad.html'), 'utf-8')
            assert.ok(output.includes('<h1></h1>'))
        })
    })

    describe('incremental builds', () => {
        it('should rebuild only changed files', async () => {
            await writeFile(join(sourceDir, 'page1.html'), '<h1>Page 1</h1>')
            await writeFile(join(sourceDir, 'page2.html'), '<h1>Page 2</h1>')

            await generator.build()

            // Track which pages are rebuilt
            const rebuiltPages = []
            
            class TrackingPlugin extends Plugin {
                async onPageRendered(page) {
                    rebuiltPages.push(page.filePath)
                }
            }

            pluginManager.register(new TrackingPlugin('tracking'))

            // Only update page1
            await writeFile(join(sourceDir, 'page1.html'), '<h1>Page 1 Updated</h1>')

            await generator.buildFile(join(sourceDir, 'page1.html'))

            assert.strictEqual(rebuiltPages.length, 1)
            assert.ok(rebuiltPages[0].includes('page1.html'))
        })
    })

    describe('page discovery', () => {
        it('should discover all pages in source directory', async () => {
            await mkdir(join(sourceDir, 'blog'), { recursive: true })
            await writeFile(join(sourceDir, 'index.html'), '<h1>Home</h1>')
            await writeFile(join(sourceDir, 'about.html'), '<h1>About</h1>')
            await writeFile(join(sourceDir, 'blog', 'post1.md'), '# Post 1')

            await generator.build()

            const pages = repository.all()
            assert.strictEqual(pages.length, 3)
        })

        it('should skip layout files', async () => {
            await writeFile(join(sourceDir, 'layout.html'), '<html>\${body}</html>')
            await writeFile(join(sourceDir, 'page.html'), '<h1>Page</h1>')

            await generator.build()

            const pages = repository.all()
            // Should only have page.html, not layout.html
            assert.strictEqual(pages.filter(p => p.filePath.includes('layout')).length, 0)
        })
    })
})
