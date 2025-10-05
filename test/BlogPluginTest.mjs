import { describe, it } from 'node:test'
import assert from 'node:assert'
import { BlogPlugin } from '../src/application/plugins/BlogPlugin.mjs'
import { UriToStaticFileRoute } from '../src/infrastructure/routing/UriToStaticFileRoute.mjs'
import route from './html/route.mjs'

describe('BlogPlugin', () => {
    describe('initialization', () => {
        it('should extend Plugin base class', () => {
            const plugin = new BlogPlugin()
            assert.strictEqual(plugin.name, 'BlogPlugin')
            assert.strictEqual(typeof plugin.onInit, 'function')
            assert.strictEqual(typeof plugin.onContentLoaded, 'function')
            assert.strictEqual(typeof plugin.onPageRendered, 'function')
        })

        it('should initialize with empty posts collection', () => {
            const plugin = new BlogPlugin()
            assert.strictEqual(plugin.posts.size, 0)
        })

        it('should accept configuration options', () => {
            const plugin = new BlogPlugin({
                blogPath: '/articles',
                dateFormat: 'yyyy-MM-dd'
            })
            assert.strictEqual(plugin.config.blogPath, '/articles')
            assert.strictEqual(plugin.config.dateFormat, 'yyyy-MM-dd')
        })
    })

    describe('onContentLoaded hook', () => {
        it('should collect blog posts from pages', async () => {
            const plugin = new BlogPlugin()
            
            const pages = [
                {
                    filePath: '/pages/blog/2024/first-post.md',
                    route: new UriToStaticFileRoute('/blog/2024/first-post.html', '/pages/blog/2024/first-post.md'),
                    metadata: {
                        title: 'First Post',
                        published: new Date('2024-01-15'),
                        excerpt: 'This is the first post',
                        shouldPublish: true,
                        tags: ['javascript', 'node']
                    },
                    content: '# First Post'
                },
                {
                    filePath: '/pages/blog/2024/second-post.md',
                    route: new UriToStaticFileRoute('/blog/2024/second-post.html', '/pages/blog/2024/second-post.md'),
                    metadata: {
                        title: 'Second Post',
                        published: new Date('2024-02-20'),
                        excerpt: 'This is the second post',
                        shouldPublish: false,
                        tags: ['testing']
                    },
                    content: '# Second Post'
                },
                {
                    filePath: '/pages/about.html',
                    route: new UriToStaticFileRoute('/about.html', '/pages/about.html'),
                    metadata: { title: 'About' },
                    content: '<h1>About</h1>'
                }
            ]

            await plugin.onContentLoaded(pages)
            
            assert.strictEqual(plugin.posts.size, 1) // Only published posts
            const post = Array.from(plugin.posts)[0]
            assert.strictEqual(post.title, 'First Post')
            assert.strictEqual(post.slug, 'first-post')
        })

        it('should extract year and slug from file path', async () => {
            const plugin = new BlogPlugin()
            
            const pages = [
                {
                    filePath: '/pages/blog/2025/my-awesome-post.md',
                    route: new UriToStaticFileRoute('/blog/2025/my-awesome-post.html', '/pages/blog/2025/my-awesome-post.md'),
                    metadata: {
                        title: 'My Awesome Post',
                        shouldPublish: true
                    },
                    content: 'content'
                }
            ]

            await plugin.onContentLoaded(pages)
            
            const post = Array.from(plugin.posts)[0]
            assert.strictEqual(post.year, '2025')
            assert.strictEqual(post.slug, 'my-awesome-post')
            assert.strictEqual(post.link, '/blog/2025/my-awesome-post.html')
        })

        it('should only collect posts with shouldPublish=true', async () => {
            const plugin = new BlogPlugin()
            
            const pages = [
                {
                    filePath: '/pages/blog/2024/draft.md',
                    route: new UriToStaticFileRoute('/blog/2024/draft.html', '/pages/blog/2024/draft.md'),
                    metadata: { title: 'Draft', shouldPublish: false },
                    content: 'draft'
                },
                {
                    filePath: '/pages/blog/2024/published.md',
                    route: new UriToStaticFileRoute('/blog/2024/published.html', '/pages/blog/2024/published.md'),
                    metadata: { title: 'Published', shouldPublish: true },
                    content: 'published'
                }
            ]

            await plugin.onContentLoaded(pages)
            
            assert.strictEqual(plugin.posts.size, 1)
            const post = Array.from(plugin.posts)[0]
            assert.strictEqual(post.title, 'Published')
        })

        it('should sort posts by date descending', async () => {
            const plugin = new BlogPlugin()
            
            const pages = [
                {
                    filePath: '/pages/blog/2023/old-post.md',
                    route: new UriToStaticFileRoute('/blog/2023/old-post.html', '/pages/blog/2023/old-post.md'),
                    metadata: {
                        title: 'Old Post',
                        published: new Date('2023-01-01'),
                        shouldPublish: true
                    },
                    content: 'old'
                },
                {
                    filePath: '/pages/blog/2025/new-post.md',
                    route: new UriToStaticFileRoute('/blog/2025/new-post.html', '/pages/blog/2025/new-post.md'),
                    metadata: {
                        title: 'New Post',
                        published: new Date('2025-12-31'),
                        shouldPublish: true
                    },
                    content: 'new'
                }
            ]

            await plugin.onContentLoaded(pages)
            
            const sortedPosts = plugin.getSortedPosts()
            assert.strictEqual(sortedPosts[0].title, 'New Post')
            assert.strictEqual(sortedPosts[1].title, 'Old Post')
        })
    })

    describe('onPagePreRendered hook', () => {
        it('should inject posts into blog index page context', async () => {
            const plugin = new BlogPlugin()
            
            // First collect some posts
            const pages = [
                {
                    filePath: '/pages/blog/2024/post.md',
                    route: new UriToStaticFileRoute('/blog/2024/post.html', '/pages/blog/2024/post.md'),
                    metadata: {
                        title: 'Test Post',
                        shouldPublish: true
                    },
                    content: 'test'
                },
                {
                    filePath: '/pages/blog/index.html',
                    route: new UriToStaticFileRoute('/blog/index.html', '/pages/blog/index.html'),
                    metadata: { title: 'Blog' },
                    content: '<h1>Blog</h1>'
                }
            ]
            await plugin.onContentLoaded(pages)
            for await (const page of pages) {
                await plugin.onPagePreRendered(page)
            }

            assert.ok(pages[1].posts)
            assert.strictEqual(pages[1].posts.length, 1)
            assert.strictEqual(pages[1].posts[0].title, 'Test Post')
        })

        it('should not inject posts into non-blog-index pages', async () => {
            const plugin = new BlogPlugin()
            
            const aboutPage = {
                filePath: '/pages/about.html',
                route: new UriToStaticFileRoute('/about.html', '/pages/about.html'),
                metadata: { title: 'About' },
                content: '<h1>About</h1>'
            }

            const result = await plugin.onPagePreRendered(aboutPage)

            assert.ok(!result.posts)
        })

        it('should support custom blog index path', async () => {
            const plugin = new BlogPlugin({ blogIndexPath: '/articles/index.html' })
            
            const pages = [
                {
                    filePath: '/pages/articles/2024/post.md',
                    route: new UriToStaticFileRoute('/articles/2024/post.html', '/pages/articles/2024/post.md'),
                    metadata: {
                        title: 'Article',
                        shouldPublish: true
                    },
                    content: 'content'
                }
            ]
            await plugin.onContentLoaded(pages)

            const indexPage = {
                filePath: '/pages/articles/index.html',
                route: new UriToStaticFileRoute('/articles/index.html', '/pages/articles/index.html'),
                metadata: { title: 'Articles' },
                content: '<h1>Articles</h1>'
            }

            const result = await plugin.onPagePreRendered(indexPage)

            assert.ok(result.posts)
            assert.strictEqual(result.posts.length, 1)
        })
    })

    describe('post filtering', () => {
        it('should filter posts by tag', async () => {
            const plugin = new BlogPlugin()
            
            const pages = [
                {
                    filePath: '/pages/blog/2024/post1.md',
                    route: new UriToStaticFileRoute('/blog/2024/post1.html', '/pages/blog/2024/post1.md'),
                    metadata: {
                        title: 'Post 1',
                        tags: ['javascript', 'node'],
                        shouldPublish: true
                    },
                    content: 'content'
                },
                {
                    filePath: '/pages/blog/2024/post2.md',
                    route: new UriToStaticFileRoute('/blog/2024/post2.html', '/pages/blog/2024/post2.md'),
                    metadata: {
                        title: 'Post 2',
                        tags: ['python'],
                        shouldPublish: true
                    },
                    content: 'content'
                }
            ]
            await plugin.onContentLoaded(pages)

            const filtered = plugin.getPostsByTag('javascript')
            assert.strictEqual(filtered.length, 1)
            assert.strictEqual(filtered[0].title, 'Post 1')
        })

        it('should filter posts by year', async () => {
            const plugin = new BlogPlugin()
            
            const pages = [
                {
                    filePath: '/pages/blog/2024/old.md',
                    route: new UriToStaticFileRoute('/blog/2024/old.html', '/pages/blog/2024/old.md'),
                    metadata: { title: 'Old', shouldPublish: true },
                    content: 'old'
                },
                {
                    filePath: '/pages/blog/2025/new.md',
                    route: new UriToStaticFileRoute('/blog/2025/new.html', '/pages/blog/2025/new.md'),
                    metadata: { title: 'New', shouldPublish: true },
                    content: 'new'
                }
            ]
            await plugin.onContentLoaded(pages)

            const filtered = plugin.getPostsByYear('2025')
            assert.strictEqual(filtered.length, 1)
            assert.strictEqual(filtered[0].title, 'New')
        })
    })
})
