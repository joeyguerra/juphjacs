import { readFile } from 'node:fs/promises'
import { Page, EVENTS } from './Page.mjs'
import { MarkdownRenderer } from './MarkdownRenderer.mjs'
import { UriToStaticFileRoute } from './UriToStaticFileRoute.mjs'

class MarkdownPage extends Page {
    constructor (filePath, pagesFolder, delegate) {
        super(pagesFolder, filePath, delegate)
        this.renderer = new MarkdownRenderer()
    }

    async get(req, res) {
        const content = await this.render()
        res.setHeader('Content-Type', 'text/html')
        res.end(content)
    }

    async render() {
        let content = await readFile(this.filePath, 'utf-8')
        process.emit(EVENTS.PRE_TEMPLATE_RENDER, this.filePath, this)
        
        content = await this.renderer.render(content, this)
        if (this.layout) {
            const layout = new Page(this.pagesFolder, this.layout, this.delegate)
            layout.renderer = this.renderer
            const context = Object.keys(this).reduce((acc, key) => {
                acc[key] = this[key]
                return acc
            }, {body: content})
            content = await layout.render(context)
        }
        const htmlFilePath = this.filePath.replace('.md', '.html')
        this.route = new UriToStaticFileRoute(htmlFilePath.replace(this.pagesFolder, ''), htmlFilePath)
        process.emit(EVENTS.TEMPLATE_RENDERED, this.route.filePath, this)
        return content
    }
}

export default async (filePath, pagesFolder, template) => {
    return new MarkdownPage(filePath, pagesFolder, template)
}

export {
    MarkdownPage
}