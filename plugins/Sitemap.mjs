
import { Plugin } from '../src/application/plugins/Plugin.mjs'
import { sep } from 'node:path'

class SitemapEntry {
    constructor({ title, url }) {
        this.title = title
        this.url = url
    }
}

class Sitemap extends Plugin {
    constructor(config = {}) {
        super('Sitemap')
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
            if (link && page.published) {
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
            url: this.config.hostname.replace(/\/+$/, '') + '/' + page.uri?.replace(/^\/+/, '')
        })
    }

    getSortedLinks() {
        return Array.from(this.links).sort((a, b) => {
            const dateA = a.published instanceof Date ? a.published : new Date(a.published)
            const dateB = b.published instanceof Date ? b.published : new Date(b.published)
            return dateB - dateA // Descending order (newest first)
        })
    }
}

export default Sitemap
