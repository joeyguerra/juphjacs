
import { Page } from '../../src/Page.mjs'
import { TemplateLiteralRenderer } from '../../src/TemplateLiteralRenderer.mjs'

class BlogIndexPage extends Page {
    constructor (rootFolder, filePath, template) {
        super(rootFolder, filePath, template, new TemplateLiteralRenderer())
        this.title = 'The Blog'
        this.layout = './pages/blog/layout.html'
        this.postsSet = new Set()
    }
    
    async get (req, res) {
        const content = await this.render()
        res.end(content)
    }
}

export default async (rootFolder, filePath, template) => {
    return new BlogIndexPage(rootFolder, filePath, template)
}
