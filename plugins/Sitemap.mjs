
import { EVENTS } from '../src/Page.mjs'

const links = new Set()

class Link {
    constructor(url, title) {
        this.url = url
        this.title = title
    }
}

export default async () => {
    process.on(EVENTS.PRE_TEMPLATE_RENDER, async (filePath, page) => {
        if (filePath.includes('sitemap.xml')) {
            page.links = Array.from(links)
        }
    })

    process.on(EVENTS.TEMPLATE_RENDERED, async (filePath, page) => {
        if (!filePath.includes('sitemap.xml')) {
            const link = new Link(page.route.filePath, page.title)
            links.add(link)
        }
    })
}