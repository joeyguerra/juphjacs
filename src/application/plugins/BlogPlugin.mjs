import { Plugin } from './Plugin.mjs'
import { join } from 'node:path'

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
                // Only add post if it was created successfully and should be published
                if (post && post.published && (post.published instanceof Date ? post.published : new Date(post.published)) < new Date()) {
                    this.posts.add(post)
                }
            }
        }
        this.posts = new Set(this.getSortedPosts())

        return pages
    }

    async onPagePreRendered(page) {
        if (this.isBlogIndexPage(page)) {
            page.posts = this.getSortedPosts()
        }
        return page
    }

    /**
     * Declare that when a blog post changes, the blog index page needs rebuild
     * @param {{filePath:string, page:Object, repository:Object, site:{sourceFolder:string}}} change
     * @returns {Promise<string[]>}
     */
    async onFileChanged(change) {
        try {
            const { filePath, site } = change
            // If a blog post changed, mark the blog index as affected
            if (this.isBlogPost({ filePath })) {
                const indexAbs = join(site.sourceFolder, this.config.blogIndexPath)
                return [indexAbs]
            }
        } catch {}
        return []
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
        // Skip posts that shouldn't be published
        // published is a date
        if (!page.published) {
            return null
        }
        // Check if published is a valid date
        if (isNaN(new Date(page.published).getTime())) {
            return null
        }
        // Published date is in the future
        if (new Date(page.published) > new Date()) {
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
            title: page.title || slug,
            published: page.published,
            excerpt: page.excerpt || '',
            slug,
            link: uri,
            tags: page.tags || [],
            image: page.image,
            year
        })
    }

    getSortedPosts() {
        return Array.from(this.posts).sort((a, b) => {
            return new Date(b.published) - new Date(a.published)
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
