import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert'
import { PageRepository } from '../src/domain/pages/PageRepository.mjs'
import { Page } from '../src/domain/pages/Page.mjs'
import { UriToStaticFileRoute } from '../src/infrastructure/routing/UriToStaticFileRoute.mjs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mkdir, writeFile, rm } from 'node:fs/promises'

describe('PageRepository', () => {
    let repository
    let testDir

    beforeEach(async () => {
        testDir = join(tmpdir(), `juphjacs-test-${Date.now()}`)
        await mkdir(testDir, { recursive: true })
        repository = new PageRepository(testDir)
    })

    it('should store and retrieve pages by key', async () => {
        const page = new Page(testDir, join(testDir, 'test.html'), '<h1>Test</h1>')
        page.uri = '/test.html'
        
        repository.save(page)
        
        const retrieved = repository.get('/test.html')
        assert.strictEqual(retrieved.uri, '/test.html')
        assert.strictEqual(retrieved.template, '<h1>Test</h1>')
    })

    it('should return all pages', async () => {
        const page1 = new Page(testDir, join(testDir, 'page1.html'), '<h1>Page 1</h1>')
        page1.uri = '/page1.html'
        const page2 = new Page(testDir, join(testDir, 'page2.html'), '<h1>Page 2</h1>')
        page2.uri = '/page2.html'
        
        repository.save(page1)
        repository.save(page2)
        
        const pages = repository.all()
        assert.strictEqual(pages.length, 2)
    })

    it('should filter pages by criteria', async () => {
        const page1 = new Page(testDir, join(testDir, 'published.html'), '<h1>Published</h1>')
        page1.uri = '/published.html'
        page1.published = '2025-09-01'
        
        const page2 = new Page(testDir, join(testDir, 'draft.html'), '<h1>Draft</h1>')
        page2.uri = '/draft.html'
        page2.published = null
        
        repository.save(page1)
        repository.save(page2)
        
        const published = repository.where({ published: '2025-09-01' })
        assert.strictEqual(published.length, 1)
        assert.strictEqual(published[0].uri, '/published.html')
    })

    it('should check if a page exists', () => {
        const page = new Page(testDir, join(testDir, 'test.html'), '<h1>Test</h1>')
        page.uri = '/test.html'
        
        assert.strictEqual(repository.has('/test.html'), false)
        repository.save(page)
        assert.strictEqual(repository.has('/test.html'), true)
    })

    it('should delete a page', () => {
        const page = new Page(testDir, join(testDir, 'test.html'), '<h1>Test</h1>')
        page.uri = '/test.html'
        
        repository.save(page)
        assert.strictEqual(repository.has('/test.html'), true)
        
        repository.delete('/test.html')
        assert.strictEqual(repository.has('/test.html'), false)
    })

    it('should find pages by file path', () => {
        const filePath = join(testDir, 'test.html')
        const page = new Page(testDir, filePath, '<h1>Test</h1>')
        page.uri = '/test.html'
        
        repository.save(page)
        
        const found = repository.findByFilePath(filePath)
        assert.strictEqual(found.uri, '/test.html')
    })

    it('should find pages matching a route', () => {
        const page1 = new Page(testDir, join(testDir, 'about.html'), '<h1>About</h1>')
        page1.uri = '/about.html'
        page1.route = { test: (path) => path === '/about.html' }
        
        const page2 = new Page(testDir, join(testDir, 'contact.html'), '<h1>Contact</h1>')
        page2.uri = '/contact.html'
        page2.route = { test: (path) => path === '/contact.html' }
        
        repository.save(page1)
        repository.save(page2)
        
        const found = repository.findByRoute('/about.html')
        assert.strictEqual(found.uri, '/about.html')
    })

    it('should find pages with directory paths and trailing slashes', () => {
        // Simulate a page at /guide-successful-software/index.html
        const guidePage = new Page(testDir, join(testDir, 'guide-successful-software', 'index.html'), '<h1>Guide</h1>')
        guidePage.uri = '/guide-successful-software/index.html'
        // Route should match both /guide-successful-software/ and /guide-successful-software
        guidePage.route = {
            test: (path) => {
                return path === '/guide-successful-software/' || 
                       path === '/guide-successful-software' ||
                       path === '/guide-successful-software/index.html'
            }
        }
        
        repository.save(guidePage)
        
        // Should find with trailing slash
        const foundWithSlash = repository.findByRoute('/guide-successful-software/')
        assert.strictEqual(foundWithSlash.uri, '/guide-successful-software/index.html')
        
        // Should find without trailing slash
        const foundWithoutSlash = repository.findByRoute('/guide-successful-software')
        assert.strictEqual(foundWithoutSlash.uri, '/guide-successful-software/index.html')
        
        // Should find with explicit index.html
        const foundWithIndex = repository.findByRoute('/guide-successful-software/index.html')
        assert.strictEqual(foundWithIndex.uri, '/guide-successful-software/index.html')
    })

    it('should match directory routes using UriToStaticFileRoute', () => {
        // Test actual UriToStaticFileRoute behavior for index.html pages
        const guidePage = new Page(testDir, join(testDir, 'guide-successful-software', 'index.html'), '<h1>Guide</h1>')
        guidePage.uri = '/guide-successful-software/index.html'
        
        // Create route as Page class does - just the file path
        const routePath = '/guide-successful-software/index.html'
        guidePage.route = new UriToStaticFileRoute(routePath, guidePage.filePath)
        
        repository.save(guidePage)
        
        // Test what matches with UriToStaticFileRoute implementation
        const exactMatch = repository.findByRoute('/guide-successful-software/index.html')
        assert.ok(exactMatch, 'Should match exact path /guide-successful-software/index.html')
        
        // UriToStaticFileRoute now handles directory paths automatically for index.html
        const dirSlash = repository.findByRoute('/guide-successful-software/')
        const dirNoSlash = repository.findByRoute('/guide-successful-software')
        
        assert.ok(dirSlash, 'Should match /guide-successful-software/ for index.html')
        assert.ok(dirNoSlash, 'Should match /guide-successful-software for index.html')
    })

    it('should clear all pages', () => {
        const page1 = new Page(testDir, join(testDir, 'page1.html'), '<h1>Page 1</h1>')
        page1.uri = '/page1.html'
        const page2 = new Page(testDir, join(testDir, 'page2.html'), '<h1>Page 2</h1>')
        page2.uri = '/page2.html'
        
        repository.save(page1)
        repository.save(page2)
        assert.strictEqual(repository.all().length, 2)
        
        repository.clear()
        assert.strictEqual(repository.all().length, 0)
    })
})
