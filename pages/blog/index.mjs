
import { Page } from '../../index.mjs'

export class BlogIndexPage extends Page {
    constructor (pagesFolder, filePath, template, delegate) {
        super(pagesFolder, filePath, template, delegate)
        this.title = 'The Blog'
        this.layout = './pages/blog/layout.html'
        this.posts = new Set()
    }
    
    async get (req, res) {
        await this.render()
        res.setHeader('Content-Type', 'text/html')
        res.end(this.content)
    }
}

export default async (pagesFolder, filePath, template, delegate) => {
    return new BlogIndexPage(pagesFolder, filePath, template, delegate)
}
