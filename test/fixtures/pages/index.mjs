
import { Page } from '../../../src/domain/pages/Page.mjs'
import { TemplateEngine } from '../../../src/infrastructure/templates/TemplateEngine.mjs'

class IndexPage extends Page {
    constructor (rootFolder, filePath, template, context = {}) {
        super(rootFolder, filePath, template, context)
        this.title = 'Hot <s>Tea</s> DOM Reloading Machinations'
        this.layout = 'test/fixtures/pages/layout.html'
        this.things = ['Tea', 'Coffee', 'Chocolate']
    }
    
    async get (req, res) {
        await this.render()
        res.end(this.content)
    }
}

export default async (rootFolder, filePath, template, context) => {
    return new IndexPage(rootFolder, filePath, template, context)
}
