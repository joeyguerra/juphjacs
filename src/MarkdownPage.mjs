import { readFile } from 'node:fs/promises'
import { Page, EVENTS } from './Page.mjs'
import { MarkdownRenderer } from './MarkdownRenderer.mjs'
import { UriToStaticFileRoute } from './UriToStaticFileRoute.mjs'

class MarkdownPage extends Page {
    constructor (filePath, pagesFolder, template) {
        super(pagesFolder, filePath, template)
        this.renderer = new MarkdownRenderer()
    }

    async get(req, res) {
        await this.render()
        res.setHeader('Content-Type', 'text/html')
        res.end(this.content)
    }

    async render() {
        const content = await readFile(this.filePath, 'utf-8')
        process.emit(EVENTS.PRE_TEMPLATE_RENDER, this.filePath, this)
        
        this.content = await this.renderer.render(content, this)
        if (this.layout) {
            const layout = new Page(this.pagesFolder, this.layout, this.template)
            layout.renderer = this.renderer
            await layout.render()
            this.content = layout.content
        }
        const htmlFilePath = this.filePath.replace('.md', '.html')
        this.route = new UriToStaticFileRoute(htmlFilePath.replace(this.pagesFolder, ''), htmlFilePath)
        process.emit(EVENTS.TEMPLATE_RENDERED, this.route.filePath, this)
        
        return this.content
    }
}

export default async (filePath, pagesFolder, template) => {
    return new MarkdownPage(filePath, pagesFolder, template)
}

export {
    MarkdownPage
}