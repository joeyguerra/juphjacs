import { Page } from '../index.mjs'

class IndexPage extends Page {
    constructor (pagesFolder, filePath, template, delegate) {
        super(pagesFolder, filePath, template, delegate)
        this.title = 'Hot <s>Tea</s> DOM Reloading Machinations'
        this.layout = './pages/layout.html'
        this.things = ['Tea', 'Coffee', 'Chocolate']
    }
    
    async get (req, res) {
        await this.render()
        res.setHeader('Content-Type', 'text/html')
        res.end(this.content)
    }
}

export default async (pagesFolder, filePath, template, delegate) => {
    return new IndexPage(pagesFolder, filePath, template, delegate)
}
