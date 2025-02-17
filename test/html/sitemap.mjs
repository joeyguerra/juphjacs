import { Page } from '../../src/Page.mjs'
import { TemplateLiteralRenderer } from '../../src/TemplateLiteralRenderer.mjs'

class SitemapPage extends Page {
    constructor (rootFolder, filePath, template) {
        super(rootFolder, filePath, template, new TemplateLiteralRenderer())
        this.title = 'Site Map'
        this.urls = [
            'https://example.com/',
            'https://example.com/first',
            'https://example.com/second',
            'https://example.com/third',
        ]
    }

    async get (req, res) {
        await this.render()
        res.setHeader('Content-Type', 'text/xml')
        res.statusCode = 200
        res.end(this.content)
    }
}
export default async (rootFolder, filePath, template) => {
    return new SitemapPage(rootFolder, filePath, template)
}
