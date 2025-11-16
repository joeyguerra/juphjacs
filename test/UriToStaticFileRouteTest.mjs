import { describe, it } from 'node:test'
import assert from 'node:assert'
import { UriToStaticFileRoute } from '../src/infrastructure/routing/UriToStaticFileRoute.mjs'

describe('UriToStaticFileRoute', () => {
    describe('directory routes with index.html', () => {
        it('should match directory path without trailing slash', () => {
            const route = new UriToStaticFileRoute('/guide-successful-software/index.html', '/pages/guide-successful-software/index.html')
            
            assert.ok(route.test('/guide-successful-software'), 'Should match /guide-successful-software')
        })

        it('should match directory path with trailing slash', () => {
            const route = new UriToStaticFileRoute('/guide-successful-software/index.html', '/pages/guide-successful-software/index.html')
            
            assert.ok(route.test('/guide-successful-software/'), 'Should match /guide-successful-software/')
        })

        it('should match explicit index.html path', () => {
            const route = new UriToStaticFileRoute('/guide-successful-software/index.html', '/pages/guide-successful-software/index.html')
            
            assert.ok(route.test('/guide-successful-software/index.html'), 'Should match /guide-successful-software/index.html')
        })

        it('should match root index.html with just /', () => {
            const route = new UriToStaticFileRoute('/index.html', '/pages/index.html')
            
            assert.ok(route.test('/'), 'Should match /')
        })

        it('should match root index.html with /index.html', () => {
            const route = new UriToStaticFileRoute('/index.html', '/pages/index.html')
            
            assert.ok(route.test('/index.html'), 'Should match /index.html')
        })

        it('should not match different paths', () => {
            const route = new UriToStaticFileRoute('/guide-successful-software/index.html', '/pages/guide-successful-software/index.html')
            
            assert.strictEqual(route.test('/other-page'), false, 'Should not match different path')
            assert.strictEqual(route.test('/guide-successful-software/other.html'), false, 'Should not match different file in same directory')
        })
    })

    describe('non-index HTML files', () => {
        it('should match exact file path', () => {
            const route = new UriToStaticFileRoute('/about.html', '/pages/about.html')
            
            assert.ok(route.test('/about.html'), 'Should match /about.html')
        })

        it('should not match path without .html extension', () => {
            const route = new UriToStaticFileRoute('/about.html', '/pages/about.html')
            
            assert.strictEqual(route.test('/about'), false, 'Should not match /about without extension')
        })

        it('should not match path with trailing slash', () => {
            const route = new UriToStaticFileRoute('/about.html', '/pages/about.html')
            
            assert.strictEqual(route.test('/about/'), false, 'Should not match /about/ with trailing slash')
        })

        it('should match nested non-index file', () => {
            const route = new UriToStaticFileRoute('/blog/archive.html', '/pages/blog/archive.html')
            
            assert.ok(route.test('/blog/archive.html'), 'Should match /blog/archive.html')
        })

        it('should not match directory path for non-index file', () => {
            const route = new UriToStaticFileRoute('/blog/archive.html', '/pages/blog/archive.html')
            
            assert.strictEqual(route.test('/blog/archive'), false, 'Should not match /blog/archive without extension')
            assert.strictEqual(route.test('/blog/archive/'), false, 'Should not match /blog/archive/ with trailing slash')
        })
    })

    describe('string to regex conversion', () => {
        it('should convert simple string path to regex', () => {
            const route = new UriToStaticFileRoute('/test.html', '/pages/test.html')
            
            assert.ok(route.regex instanceof RegExp, 'Should create RegExp instance')
            assert.ok(route.test('/test.html'), 'Should match the path')
        })

        it('should handle paths without leading slash', () => {
            const route = new UriToStaticFileRoute('test.html', '/pages/test.html')
            
            assert.ok(route.test('/test.html'), 'Should match /test.html even if constructed without leading slash')
        })

        it('should accept RegExp directly', () => {
            const regex = /^\/custom-route/
            const route = new UriToStaticFileRoute(regex, '/pages/custom.html')
            
            assert.strictEqual(route.regex, regex, 'Should use provided RegExp')
            assert.ok(route.test('/custom-route'), 'Should match using custom regex')
        })
    })

    describe('match method', () => {
        it('should return match array for matching path', () => {
            const route = new UriToStaticFileRoute('/about.html', '/pages/about.html')
            
            const match = route.match('/about.html')
            assert.ok(Array.isArray(match), 'Should return array')
            assert.strictEqual(match[0], '/about.html', 'Should contain matched path')
        })

        it('should return null for non-matching path', () => {
            const route = new UriToStaticFileRoute('/about.html', '/pages/about.html')
            
            const match = route.match('/contact.html')
            assert.strictEqual(match, null, 'Should return null for non-match')
        })
    })

    describe('edge cases', () => {
        it('should handle paths with special characters', () => {
            const route = new UriToStaticFileRoute('/my-awesome-page.html', '/pages/my-awesome-page.html')
            
            assert.ok(route.test('/my-awesome-page.html'), 'Should match path with hyphens')
        })

        it('should handle deeply nested paths', () => {
            const route = new UriToStaticFileRoute('/docs/api/reference/index.html', '/pages/docs/api/reference/index.html')
            
            assert.ok(route.test('/docs/api/reference/index.html'), 'Should match deeply nested explicit path')
            assert.ok(route.test('/docs/api/reference/'), 'Should match directory with trailing slash')
            assert.ok(route.test('/docs/api/reference'), 'Should match directory without trailing slash')
        })

        it('should be case-sensitive by default', () => {
            const route = new UriToStaticFileRoute('/About.html', '/pages/About.html')
            
            assert.ok(route.test('/About.html'), 'Should match exact case')
            assert.strictEqual(route.test('/about.html'), false, 'Should not match different case')
        })
    })
})
