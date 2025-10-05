import { describe, it } from 'node:test'
import assert from 'node:assert'
import { FileFilter } from '../src/infrastructure/FileFilter.mjs'

describe('FileFilter', () => {
    describe('default filters', () => {
        it('should skip node_modules directory', () => {
            const filter = new FileFilter()
            
            assert.strictEqual(filter.shouldProcess('/project/node_modules/package/file.js'), false)
            assert.strictEqual(filter.shouldProcess('/project/src/node_modules/file.js'), false)
        })

        it('should skip hidden files and directories', () => {
            const filter = new FileFilter()
            
            assert.strictEqual(filter.shouldProcess('/project/.git/config'), false)
            assert.strictEqual(filter.shouldProcess('/project/src/.DS_Store'), false)
            assert.strictEqual(filter.shouldProcess('/project/.env'), false)
            assert.strictEqual(filter.shouldProcess('/project/.vscode/settings.json'), false)
        })

        it('should skip build output directories', () => {
            const filter = new FileFilter()
            
            assert.strictEqual(filter.shouldProcess('/project/_site/index.html'), false)
            assert.strictEqual(filter.shouldProcess('/project/dist/bundle.js'), false)
            assert.strictEqual(filter.shouldProcess('/project/build/output.js'), false)
        })

        it('should skip common lock and log files', () => {
            const filter = new FileFilter()
            
            assert.strictEqual(filter.shouldProcess('/project/package-lock.json'), false)
            assert.strictEqual(filter.shouldProcess('/project/yarn.lock'), false)
            assert.strictEqual(filter.shouldProcess('/project/npm-debug.log'), false)
            assert.strictEqual(filter.shouldProcess('/project/error.log'), false)
        })

        it('should allow processable files', () => {
            const filter = new FileFilter()
            
            assert.strictEqual(filter.shouldProcess('/project/pages/index.html'), true)
            assert.strictEqual(filter.shouldProcess('/project/pages/about.md'), true)
            assert.strictEqual(filter.shouldProcess('/project/src/app.mjs'), true)
            assert.strictEqual(filter.shouldProcess('/project/styles/main.css'), true)
        })
    })

    describe('file type detection', () => {
        it('should identify HTML files', () => {
            const filter = new FileFilter()
            
            assert.strictEqual(filter.getFileType('/pages/index.html'), 'html')
            assert.strictEqual(filter.getFileType('/pages/about.htm'), 'html')
        })

        it('should identify Markdown files', () => {
            const filter = new FileFilter()
            
            assert.strictEqual(filter.getFileType('/blog/post.md'), 'markdown')
            assert.strictEqual(filter.getFileType('/docs/readme.markdown'), 'markdown')
        })

        it('should identify JavaScript/Module files', () => {
            const filter = new FileFilter()
            
            assert.strictEqual(filter.getFileType('/src/app.js'), 'javascript')
            assert.strictEqual(filter.getFileType('/src/module.mjs'), 'javascript')
            assert.strictEqual(filter.getFileType('/src/component.cjs'), 'javascript')
        })

        it('should identify CSS files', () => {
            const filter = new FileFilter()
            
            assert.strictEqual(filter.getFileType('/styles/main.css'), 'css')
        })

        it('should identify static assets', () => {
            const filter = new FileFilter()
            
            assert.strictEqual(filter.getFileType('/images/logo.png'), 'asset')
            assert.strictEqual(filter.getFileType('/images/photo.jpg'), 'asset')
            assert.strictEqual(filter.getFileType('/images/icon.svg'), 'asset')
            assert.strictEqual(filter.getFileType('/fonts/roboto.woff2'), 'asset')
        })

        it('should identify XML files', () => {
            const filter = new FileFilter()
            
            assert.strictEqual(filter.getFileType('/sitemap.xml'), 'xml')
            assert.strictEqual(filter.getFileType('/feed.rss'), 'xml')
        })

        it('should return unknown for unrecognized types', () => {
            const filter = new FileFilter()
            
            assert.strictEqual(filter.getFileType('/data/file.xyz'), 'unknown')
        })
    })

    describe('custom filters', () => {
        it('should accept custom ignore patterns', () => {
            const filter = new FileFilter({
                ignore: ['**/temp/**', '**/*.tmp']
            })
            
            assert.strictEqual(filter.shouldProcess('/project/temp/file.txt'), false)
            assert.strictEqual(filter.shouldProcess('/project/data/cache.tmp'), false)
            assert.strictEqual(filter.shouldProcess('/project/data/file.txt'), true)
        })

        it('should accept custom include patterns', () => {
            const filter = new FileFilter({
                include: ['**/*.html', '**/*.md']
            })
            
            assert.strictEqual(filter.shouldProcess('/project/pages/index.html'), true)
            assert.strictEqual(filter.shouldProcess('/project/blog/post.md'), true)
            assert.strictEqual(filter.shouldProcess('/project/src/app.js'), false)
        })

        it('should combine default and custom filters', () => {
            const filter = new FileFilter({
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
            const filter = new FileFilter()
            
            assert.strictEqual(filter.needsTemplateRendering('/pages/index.html'), true)
            assert.strictEqual(filter.needsTemplateRendering('/blog/post.md'), true)
            assert.strictEqual(filter.needsTemplateRendering('/styles/main.css'), false)
            assert.strictEqual(filter.needsTemplateRendering('/images/logo.png'), false)
        })

        it('should determine if file needs markdown processing', () => {
            const filter = new FileFilter()
            
            assert.strictEqual(filter.needsMarkdownProcessing('/blog/post.md'), true)
            assert.strictEqual(filter.needsMarkdownProcessing('/docs/readme.markdown'), true)
            assert.strictEqual(filter.needsMarkdownProcessing('/pages/index.html'), false)
        })

        it('should determine if file should be copied as-is', () => {
            const filter = new FileFilter()
            
            assert.strictEqual(filter.shouldCopyAsIs('/images/logo.png'), true)
            assert.strictEqual(filter.shouldCopyAsIs('/fonts/font.woff2'), true)
            assert.strictEqual(filter.shouldCopyAsIs('/data/file.json'), true)
            assert.strictEqual(filter.shouldCopyAsIs('/pages/index.html'), false)
            assert.strictEqual(filter.shouldCopyAsIs('/blog/post.md'), false)
        })
    })

    describe('layout file detection', () => {
        it('should identify layout files', () => {
            const filter = new FileFilter()
            
            assert.strictEqual(filter.isLayoutFile('/pages/layout.html'), true)
            assert.strictEqual(filter.isLayoutFile('/blog/layout.html'), true)
            assert.strictEqual(filter.isLayoutFile('/pages/_layout.html'), true)
        })

        it('should not treat regular files as layouts', () => {
            const filter = new FileFilter()
            
            assert.strictEqual(filter.isLayoutFile('/pages/index.html'), false)
            assert.strictEqual(filter.isLayoutFile('/pages/about.html'), false)
        })

        it('should support custom layout patterns', () => {
            const filter = new FileFilter({
                layoutPatterns: ['**/template.html', '**/_*.html']
            })
            
            assert.strictEqual(filter.isLayoutFile('/pages/template.html'), true)
            assert.strictEqual(filter.isLayoutFile('/pages/_partial.html'), true)
            assert.strictEqual(filter.isLayoutFile('/pages/layout.html'), false)
        })
    })
})
