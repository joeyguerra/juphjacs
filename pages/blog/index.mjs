
import { Page } from '../../index.mjs'

export class BlogIndexPage extends Page {
    constructor (pagesFolder, filePath, template, context) {
        super(pagesFolder, filePath, template, context)
        this.title = 'The Blog'
        this.layout = './pages/blog/layout.html'
        this.posts = new Set()
    }
    
    async get (req, res) {
        // The BlogPlugin should have populated its posts during build
        // Use the context to access plugin data
        const blogPlugin = this.context.getPluginByName('BlogPlugin')
        if (blogPlugin) {
            this.posts = blogPlugin.posts
        }
        await this.render()
        res.setHeader('Content-Type', 'text/html')
        res.end(this.content)
    }
}

export default async (pagesFolder, filePath, template, delegate) => {
    return new BlogIndexPage(pagesFolder, filePath, template, delegate)
}
