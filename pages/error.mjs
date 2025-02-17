
import { Page } from '../src/Page.mjs'
import { TemplateLiteralRenderer } from '../src/TemplateLiteralRenderer.mjs'

class ErrorPage extends Page {
    constructor (rootFolder, filePath, template) {
        super(rootFolder, filePath, template, new TemplateLiteralRenderer())
        this.title = 'Error'
        this.layout = './pages/blog/layout.html'
        this.error = null
    }
}

export default async (rootFolder, filePath, template) => {
    return new ErrorPage(rootFolder, filePath, template)
}
