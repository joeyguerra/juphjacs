
import { Page } from '../src/Page.mjs'
import { TemplateLiteralRenderer } from '../src/TemplateLiteralRenderer.mjs'

class AdminPage extends Page {
    constructor (rootFolder, filePath, template) {
        super(rootFolder, filePath, template, new TemplateLiteralRenderer())
        this.title = 'Admin Page'
        this.layout = './pages/layout.html'
    }
}

export default async (rootFolder, filePath, template) => {
    return new AdminPage(rootFolder, filePath, template)
}
