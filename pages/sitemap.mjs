import { Page } from '../index.mjs'

class SitemapPage extends Page {
    constructor (pagesFolder, filePath, template, delegate) {
        super(pagesFolder, filePath, template, delegate)
        this.title = 'Site Map'
        this.links = []
    }

    async get (req, res) {
        await this.render()
        res.setHeader('Content-Type', 'text/xml')
        res.statusCode = 200
        res.end(this.content)
    }
}

export {
    SitemapPage
}

export default async (pagesFolder, filePath, template, delegate) => {
    return new SitemapPage(pagesFolder, filePath, template, delegate)
}
