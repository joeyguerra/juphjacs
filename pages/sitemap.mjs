import { Page } from '../src/Page.mjs'
import { TemplateLiteralRenderer } from '../src/TemplateLiteralRenderer.mjs'

class SitemapPage extends Page {
    constructor (rootFolder, filePath, template) {
        super(rootFolder, filePath, template, new TemplateLiteralRenderer())
        this.title = 'Site Map'
        this.links = []
    }

    async get (req, res) {
        const content = await this.render()
        res.setHeader('Content-Type', 'text/xml')
        res.statusCode = 200
        res.end(content)
    }
}

export {
    SitemapPage
}

export default async (rootFolder, filePath, template) => {
    return new SitemapPage(rootFolder, filePath, template)
}
