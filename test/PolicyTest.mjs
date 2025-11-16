import { describe, it } from 'node:test'
import assert from 'node:assert'
import { AssetPolicy, AssetType, HmrStrategy } from '../src/policy/AssetPolicy.mjs'
import { PathPolicy } from '../src/policy/PathPolicy.mjs'

describe('Policies', () => {
    describe('default filters', () => {
        it('should skip node_modules directory', () => {
            const filter = new PathPolicy()
            
            assert.strictEqual(filter.shouldProcess('/project/node_modules/package/file.js'), false)
            assert.strictEqual(filter.shouldProcess('/project/src/node_modules/file.js'), false)
        })

        it('should skip hidden files and directories', () => {
            const filter = new PathPolicy()
            
            assert.strictEqual(filter.shouldProcess('/project/.git/config'), false)
            assert.strictEqual(filter.shouldProcess('/project/src/.DS_Store'), false)
            assert.strictEqual(filter.shouldProcess('/project/.env'), false)
            assert.strictEqual(filter.shouldProcess('/project/.vscode/settings.json'), false)
        })

        it('should skip build output directories', () => {
            const filter = new PathPolicy()
            
            assert.strictEqual(filter.shouldProcess('/project/_site/index.html'), false)
            assert.strictEqual(filter.shouldProcess('/project/dist/bundle.js'), false)
            assert.strictEqual(filter.shouldProcess('/project/build/output.js'), false)
        })

        it('should skip common lock and log files', () => {
            const filter = new PathPolicy()
            
            assert.strictEqual(filter.shouldProcess('/project/package-lock.json'), false)
            assert.strictEqual(filter.shouldProcess('/project/yarn.lock'), false)
            assert.strictEqual(filter.shouldProcess('/project/npm-debug.log'), false)
            assert.strictEqual(filter.shouldProcess('/project/error.log'), false)
        })

        it('should allow processable files', () => {
            const filter = new PathPolicy()
            
            assert.strictEqual(filter.shouldProcess('/project/pages/index.html'), true)
            assert.strictEqual(filter.shouldProcess('/project/pages/about.md'), true)
            assert.strictEqual(filter.shouldProcess('/project/src/app.mjs'), true)
            assert.strictEqual(filter.shouldProcess('/project/styles/main.css'), true)
        })
    })

    describe('file type detection', () => {
        it('should identify HTML files', () => {
            const filter = new AssetPolicy()
            
            assert.strictEqual(filter.getAssetType('/pages/index.html'), AssetType.HTML)
            assert.strictEqual(filter.getAssetType('/pages/about.htm'), AssetType.HTML)
        })

        it('should identify Markdown files', () => {
            const filter = new AssetPolicy()
            
            assert.strictEqual(filter.getAssetType('/blog/post.md'), AssetType.MARKDOWN)
            assert.strictEqual(filter.getAssetType('/docs/readme.markdown'), AssetType.MARKDOWN)
        })

        it('should identify JavaScript/Module files', () => {
            const filter = new AssetPolicy()
            
            assert.strictEqual(filter.getAssetType('/src/app.js'), AssetType.JS)
            assert.strictEqual(filter.getAssetType('/src/module.mjs'), AssetType.JS)
            assert.strictEqual(filter.getAssetType('/src/component.cjs'), AssetType.JS)
        })

        it('should identify CSS files', () => {
            const filter = new AssetPolicy()
            
            assert.strictEqual(filter.getAssetType('/styles/main.css'), AssetType.CSS)
        })

        it('should identify static assets', () => {
            const filter = new AssetPolicy()
            
            assert.strictEqual(filter.getAssetType('/images/logo.png'), AssetType.ASSET)
            assert.strictEqual(filter.getAssetType('/images/photo.jpg'), AssetType.ASSET)
            assert.strictEqual(filter.getAssetType('/images/icon.svg'), AssetType.ASSET)
            assert.strictEqual(filter.getAssetType('/fonts/roboto.woff2'), AssetType.ASSET)
        })

        it('should identify XML files', () => {
            const filter = new AssetPolicy()
            
            assert.strictEqual(filter.getAssetType('/sitemap.xml'), AssetType.XML)
            assert.strictEqual(filter.getAssetType('/feed.rss'), AssetType.XML)
        })

        it('should return unknown for unrecognized types', () => {
            const filter = new AssetPolicy()
            
            assert.strictEqual(filter.getAssetType('/data/file.xyz'), AssetType.UNKNOWN)
        })
    })

    describe('custom filters', () => {
        it('should accept custom ignore patterns', () => {
            const filter = new PathPolicy({
                ignore: ['**/temp/**', '**/*.tmp']
            })
            
            assert.strictEqual(filter.shouldProcess('/project/temp/file.txt'), false)
            assert.strictEqual(filter.shouldProcess('/project/data/cache.tmp'), false)
            assert.strictEqual(filter.shouldProcess('/project/data/file.txt'), true)
        })

        it('should accept custom include patterns', () => {
            const filter = new PathPolicy({
                include: ['**/*.html', '**/*.md']
            })
            
            assert.strictEqual(filter.shouldProcess('/project/pages/index.html'), true)
            assert.strictEqual(filter.shouldProcess('/project/blog/post.md'), true)
            assert.strictEqual(filter.shouldProcess('/project/src/app.js'), false)
        })

        it('should combine default and custom filters', () => {
            const filter = new PathPolicy({
                ignore: ['**/private/**']
            })
            
            // Default filters still work
            assert.strictEqual(filter.shouldProcess('/project/node_modules/pkg/file.js'), false)
            // Custom filter works
            assert.strictEqual(filter.shouldProcess('/project/private/secret.txt'), false)
            // Normal files still pass
            assert.strictEqual(filter.shouldProcess('/project/pages/index.html'), true)
        })
    })

    describe('processing rules', () => {
        it('should determine if file needs template rendering', () => {
            const filter = new AssetPolicy()
            
            assert.strictEqual(filter.needsTemplateRendering('/pages/index.html'), true)
            assert.strictEqual(filter.needsTemplateRendering('/blog/post.md'), true)
            assert.strictEqual(filter.needsTemplateRendering('/styles/main.css'), false)
            assert.strictEqual(filter.needsTemplateRendering('/images/logo.png'), false)
        })

        it('should determine if file needs markdown processing', () => {
            const filter = new AssetPolicy()
            
            assert.strictEqual(filter.needsMarkdownProcessing('/blog/post.md'), true)
            assert.strictEqual(filter.needsMarkdownProcessing('/docs/readme.markdown'), true)
            assert.strictEqual(filter.needsMarkdownProcessing('/pages/index.html'), false)
        })

        it('should determine if file should be copied as-is', () => {
            const filter = new AssetPolicy()
            
            assert.strictEqual(filter.shouldCopyAsIs('/images/logo.png'), true)
            assert.strictEqual(filter.shouldCopyAsIs('/fonts/font.woff2'), true)
            assert.strictEqual(filter.shouldCopyAsIs('/data/file.json'), true)
            assert.strictEqual(filter.shouldCopyAsIs('/pages/index.html'), false)
            assert.strictEqual(filter.shouldCopyAsIs('/blog/post.md'), false)
        })
    })

    describe('layout file detection', () => {
        it('should identify layout files', () => {
            const filter = new PathPolicy()
            
            assert.strictEqual(filter.isLayoutFile('/pages/layout.html'), true)
            assert.strictEqual(filter.isLayoutFile('/blog/layout.html'), true)
            assert.strictEqual(filter.isLayoutFile('/pages/_layout.html'), true)
        })

        it('should not treat regular files as layouts', () => {
            const filter = new PathPolicy()
            
            assert.strictEqual(filter.isLayoutFile('/pages/index.html'), false)
            assert.strictEqual(filter.isLayoutFile('/pages/about.html'), false)
        })

        it('should support custom layout patterns', () => {
            const filter = new PathPolicy({
                layoutPatterns: ['**/template.html', '**/_*.html']
            })
            
            assert.strictEqual(filter.isLayoutFile('/pages/template.html'), true)
            assert.strictEqual(filter.isLayoutFile('/pages/_partial.html'), true)
            assert.strictEqual(filter.isLayoutFile('/pages/layout.html'), false)
        })
    })

    describe('HMR strategy detection', () => {
        it('should return CSS_ONLY strategy for CSS files', () => {
            const filter = new AssetPolicy()
            
            assert.strictEqual(filter.getHmrStrategy('/styles/main.css'), HmrStrategy.CSS_ONLY)
        })

        it('should return FULL_RELOAD strategy for JavaScript files', () => {
            const filter = new AssetPolicy()
            
            assert.strictEqual(filter.getHmrStrategy('/src/app.js'), HmrStrategy.FULL_RELOAD)
            assert.strictEqual(filter.getHmrStrategy('/src/module.mjs'), HmrStrategy.FULL_RELOAD)
            assert.strictEqual(filter.getHmrStrategy('/src/component.cjs'), HmrStrategy.FULL_RELOAD)
        })

        it('should return DOM_MORPH strategy for HTML files', () => {
            const filter = new AssetPolicy()
            
            assert.strictEqual(filter.getHmrStrategy('/pages/index.html'), HmrStrategy.DOM_MORPH)
            assert.strictEqual(filter.getHmrStrategy('/pages/about.htm'), HmrStrategy.DOM_MORPH)
        })

        it('should return DOM_MORPH strategy for Markdown files', () => {
            const filter = new AssetPolicy()
            
            assert.strictEqual(filter.getHmrStrategy('/blog/post.md'), HmrStrategy.DOM_MORPH)
            assert.strictEqual(filter.getHmrStrategy('/docs/readme.markdown'), HmrStrategy.DOM_MORPH)
        })

        it('should return NONE strategy for static assets', () => {
            const filter = new AssetPolicy()
            
            assert.strictEqual(filter.getHmrStrategy('/images/logo.png'), HmrStrategy.NONE)
            assert.strictEqual(filter.getHmrStrategy('/fonts/font.woff2'), HmrStrategy.NONE)
            assert.strictEqual(filter.getHmrStrategy('/data/file.json'), HmrStrategy.NONE)
        })

        it('should return NONE strategy for unknown file types', () => {
            const filter = new AssetPolicy()
            
            assert.strictEqual(filter.getHmrStrategy('/data/file.xyz'), HmrStrategy.NONE)
        })
    })

    describe('meta detection', () => {
        it('should return meta for CSS files', () => {
            const filter = new AssetPolicy()
            const meta = filter.getMeta('/styles/main.css')
            assert.deepStrictEqual(meta, { assetType: AssetType.CSS, hmrStrategy: HmrStrategy.CSS_ONLY })
        })

        it('should return meta for JavaScript files', () => {
            const filter = new AssetPolicy()
            const metaJs = filter.getMeta('/src/app.js')
            const metaMjs = filter.getMeta('/src/module.mjs')
            assert.deepStrictEqual(metaJs, { assetType: AssetType.JS, hmrStrategy: HmrStrategy.FULL_RELOAD })
            assert.deepStrictEqual(metaMjs, { assetType: AssetType.JS, hmrStrategy: HmrStrategy.FULL_RELOAD })
        })

        it('should return meta for HTML files', () => {
            const filter = new AssetPolicy()
            const meta = filter.getMeta('/pages/index.html')
            assert.deepStrictEqual(meta, { assetType: AssetType.HTML, hmrStrategy: HmrStrategy.DOM_MORPH })
        })

        it('should return meta for Markdown files', () => {
            const filter = new AssetPolicy()
            const meta = filter.getMeta('/blog/post.md')
            assert.deepStrictEqual(meta, { assetType: AssetType.MARKDOWN, hmrStrategy: HmrStrategy.DOM_MORPH })
        })

        it('should return meta for assets', () => {
            const filter = new AssetPolicy()
            const meta = filter.getMeta('/images/logo.png')
            assert.deepStrictEqual(meta, { assetType: AssetType.ASSET, hmrStrategy: HmrStrategy.NONE })
        })

        it('should return meta for unknown files', () => {
            const filter = new AssetPolicy()
            const meta = filter.getMeta('/data/file.xyz')
            assert.deepStrictEqual(meta, { assetType: AssetType.UNKNOWN, hmrStrategy: HmrStrategy.NONE })
        })
    })
})
