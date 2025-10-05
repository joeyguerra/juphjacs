
import { Page } from '../../../src/domain/pages/Page.mjs'
import { TemplateEngine } from '../../../src/infrastructure/templates/TemplateEngine.mjs'

class IndexPage extends Page {
    constructor (rootFolder, filePath, template, delegate = { broadcast: async () => {} }) {
        super(rootFolder, filePath, template, delegate)
        this.title = 'Hot <s>Tea</s> DOM Reloading Machinations'
        this.layout = 'test/fixtures/pages/layout.html'
        this.things = ['Tea', 'Coffee', 'Chocolate']
    }
    
    async get (req, res) {
        await this.render()
        res.end(this.content)
    }
}

export default async (rootFolder, filePath, template, delegate) => {
    return new IndexPage(rootFolder, filePath, template, delegate)
}
