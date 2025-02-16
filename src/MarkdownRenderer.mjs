import { TemplateLiteralRenderer } from './TemplateLiteralRenderer.mjs'
class MarkdownRenderer extends TemplateLiteralRenderer {
    constructor (resolve, readFile, markdown) {
        super(resolve, readFile)
        this.markdown = markdown
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