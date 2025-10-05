import { Page } from '../../src/domain/pages/Page.mjs'
import { TemplateEngine } from '../../src/infrastructure/templates/TemplateEngine.mjs'

class IndexPage extends Page {
    constructor (rootFolder, filePath, template, delegate = { broadcast: async () => {} }) {
        super(rootFolder, filePath, template, delegate)
        this.title = 'Main page'
        this.layout = './test/html/layout.html'
    }
    async get (req, res) {
        await this.render()
        res.end(this.content)
    }
}
export default async (rootFolder, filePath, template, delegate) => {
    return new IndexPage(rootFolder, filePath, template, delegate)
}