
import { Page } from '../../../src/Page.mjs'
import { TemplateLiteralRenderer } from '../../../src/TemplateLiteralRenderer.mjs'

class IndexPage extends Page {
    constructor (rootFolder, filePath, template) {
        super(rootFolder, filePath, template, new TemplateLiteralRenderer())
        this.title = 'Hot <s>Tea</s> DOM Reloading Machinations'
        this.layout = 'test/fixtures/pages/layout.html'
        this.things = ['Tea', 'Coffee', 'Chocolate']
    }
    
    async get (req, res) {
        const content = await this.render()
        res.end(content)
    }
}

export default async (rootFolder, filePath, template) => {
    return new IndexPage(rootFolder, filePath, template)
}
