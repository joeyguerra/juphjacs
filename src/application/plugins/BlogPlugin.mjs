import { Plugin } from './Plugin.mjs'
import { sep } from 'node:path'

class BlogPost {
    constructor({ title, published, excerpt, slug, link, tags = [], image, year }) {
        this.title = title
        this.published = published
        this.excerpt = excerpt
        this.slug = slug
        this.link = link
        this.tags = tags
        this.image = image
        this.year = year
    }
}

class BlogPlugin extends Plugin {
    constructor(config = {}) {
        super('BlogPlugin')
        
        // Set defaults
        const defaults = {
            blogPath: '/blog',
            blogIndexPath: null,  // Will be set based on blogPath
            dateFormat: 'iso'
        }
        
        this.config = { ...defaults, ...config }
        
        // If blogIndexPath is set but blogPath isn't, derive blogPath from blogIndexPath
        if (config.blogIndexPath && !config.blogPath) {
            // Extract /articles from /articles/index.html
            this.config.blogPath = config.blogIndexPath.replace('/index.html', '')
        }
        
        // If blogIndexPath wasn't explicitly set, derive it from blogPath
        if (!config.blogIndexPath) {
            this.config.blogIndexPath = `${this.config.blogPath}/index.html`
        }
        
        this.posts = new Set()
    }

    async onContentLoaded(pages) {
        // Clear posts for fresh build
        this.posts.clear()

        // Collect blog posts from pages
        for (const page of pages) {
            if (this.isBlogPost(page)) {
                const post = this.createPostFromPage(page)
                if (post && post.shouldPublish !== false) {
                    this.posts.add(post)
                }
            }
        }

        return pages
    }

    async onPagePreRendered(page) {
        if (this.isBlogIndexPage(page)) {
            page.posts = this.getSortedPosts()
        }
        return page
    }

    isBlogPost(page) {
        const normalizedPath = page.filePath.replace(/\\/g, '/')
        const blogPath = this.config.blogPath.replace(/\\/g, '/')
        // Match pattern like /blog/2024/post-name.md or /articles/2024/post-name.md
        const blogPostPattern = new RegExp(`${blogPath}/\\d{4}/[^/]+\\.md$`)
        return blogPostPattern.test(normalizedPath)
    }

    isBlogIndexPage(page) {
        const normalizedPath = page.filePath.replace(/\\/g, '/')
        const indexPattern = this.config.blogIndexPath.replace(/\\/g, '/')
        return normalizedPath.includes(indexPattern)
    }

    createPostFromPage(page) {
        const metadata = page.metadata || {}
        
        // Skip posts that shouldn't be published
        if (metadata.shouldPublish === false) {
            return null
        }

        // Extract year and slug from file path
        const normalizedPath = page.filePath.replace(/\\/g, '/')
        const blogPath = this.config.blogPath.replace(/\\/g, '/')
        const regex = new RegExp(`${blogPath}/(\\d{4})/([^/.]+)(?:\\.md)?$`)
        const match = regex.exec(normalizedPath)
        
        if (!match) return null

        const year = match[1]
        const slug = match[2]
        
        // Extract URI from route object or construct it
        const uri = `${blogPath}/${year}/${slug}.html`

        return new BlogPost({
            title: metadata.title || slug,
            published: metadata.published || new Date(year),
            excerpt: metadata.excerpt || '',
            slug,
            link: uri,
            tags: metadata.tags || [],
            image: metadata.image,
            year,
            shouldPublish: metadata.shouldPublish
        })
    }

    getSortedPosts() {
        return Array.from(this.posts).sort((a, b) => {
            const dateA = a.published instanceof Date ? a.published : new Date(a.published)
            const dateB = b.published instanceof Date ? b.published : new Date(b.published)
            return dateB - dateA // Descending order (newest first)
        })
    }

    getPostsByTag(tag) {
        return this.getSortedPosts().filter(post => 
            post.tags && post.tags.includes(tag)
        )
    }

    getPostsByYear(year) {
        return this.getSortedPosts().filter(post => post.year === year)
    }
}

export { BlogPlugin, BlogPost }
