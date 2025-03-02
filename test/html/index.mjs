import { Page } from '../../src/Page.mjs'
import { TemplateLiteralRenderer } from '../../src/TemplateLiteralRenderer.mjs'

class IndexPage extends Page {
    constructor (rootFolder, filePath, template) {
        super(rootFolder, filePath, template, new TemplateLiteralRenderer())
        this.title = 'Main page'
        this.layout = './test/html/layout.html'
    }
    async get (req, res) {
        const content = await this.render()
        res.end(content)
    }
}
export default async (rootFolder, filePath, template) => {
    return new IndexPage(rootFolder, filePath, template)
}