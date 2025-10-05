import { Page } from '../../src/domain/pages/Page.mjs'
import { TemplateEngine } from '../../src/infrastructure/templates/TemplateEngine.mjs'

class SitemapPage extends Page {
    constructor (rootFolder, filePath, template, delegate = { broadcast: async () => {} }) {
        super(rootFolder, filePath, template, delegate)
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
export default async (rootFolder, filePath, template, delegate) => {
    return new SitemapPage(rootFolder, filePath, template, delegate)
}
