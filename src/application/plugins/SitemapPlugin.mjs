
import { Plugin } from './Plugin.mjs'
import { sep } from 'node:path'

class SitemapEntry {
    constructor({ title, url, published = new Date() }) {
        this.title = title
        this.url = url
        this.published = published
    }
}

class SitemapPlugin extends Plugin {
    constructor(config = {}) {
        super('SitemapPlugin')
        const defaults = {
            hostname: 'http://localhost:3000',
            changefreq: 'monthly',
            priority: 0.5
        }
        this.config = { ...defaults, ...config }
        this.links = new Set()
    }

    async onContentLoaded(pages) {
        this.links.clear()
        for (const page of pages) {
            const link = this.createLinkFromPage(page)
            // published is a date
            // Only include pages with a published date prior than today
            if (link && (!page.published || new Date(page.published) <= new Date())) {
                this.links.add(link)
            }
        }
        return pages
    }

    async onPagePreRendered(page) {
        if (this.isIndexPage(page)) {
            page.links = this.getSortedLinks()
        }
        return page
    }

    isIndexPage(page) {
        return page.uri?.includes('sitemap.xml')
    }

    createLinkFromPage(page) {
        if (!page.uri || !page.title) {
            return null
        }
        return new SitemapEntry({
            title: page.title,
            url: this.config.hostname.replace(/\/+$/, '') + '/' + page.uri?.replace(/^\/+/, ''),
            published: page.published instanceof Date ? page.published : new Date(page.published)
        })
    }

    getSortedLinks() {
        return Array.from(this.links).sort((a, b) => {
            return new Date(b.published) - new Date(a.published)
        })
    }
}

export { SitemapPlugin }