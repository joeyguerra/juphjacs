



import { Page } from '../../../src/Page.mjs'
import { MarkdownRenderer } from '../../../src/MarkdownRenderer.mjs'

class PostPage extends Page {
    constructor (rootFolder, filePath, template) {
        super(rootFolder, filePath, template, new MarkdownRenderer())
        this.title = '3rd post'
        this.layout = './pages/blog/layout.html'
        this.excerpt = 'JUst creating a new one.'
        this.published = new Date('2024-02-07')
        this.tags = ['agile', 'scale']
        this.image = '/imgs/6958430407_12683c821f_w.jpg'
        this.shouldPublish = true
    
    }
}

export default async (rootFolder, filePath, template) => {
    return new PostPage(rootFolder, filePath, template)
}
