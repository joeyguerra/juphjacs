import { Page } from '../../src/domain/pages/Page.mjs'
import { TemplateEngine } from '../../src/infrastructure/templates/TemplateEngine.mjs'

class IndexPage extends Page {
    constructor (rootFolder, filePath, template, context = {}) {
        super(rootFolder, filePath, template, context)
        this.title = 'Main page'
        this.layout = './test/html/layout.html'
    }
    async get (req, res) {
        await this.render()
        res.end(this.content)
    }
}
export default async (rootFolder, filePath, template, context) => {
    return new IndexPage(rootFolder, filePath, template, context)
}