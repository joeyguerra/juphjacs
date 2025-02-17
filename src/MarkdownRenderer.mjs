import { TemplateLiteralRenderer } from './TemplateLiteralRenderer.mjs'
import MarkdownIt from 'markdown-it'

class MarkdownRenderer extends TemplateLiteralRenderer {
    constructor (markdown) {
        super()
        this.markdown = new MarkdownIt({
            html: true,
            linkify: true,
            typographer: true
        })
    }

    accepts (filePath) {
        return filePath.endsWith('.md')
    }

    render(content, initialContext = {}) {
        let data = this.markdown.render(content)
        let html = super.render(data, initialContext)
        return html
    }
}

export {
    MarkdownRenderer
}