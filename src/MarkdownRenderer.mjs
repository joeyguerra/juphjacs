import { TemplateLiteralRenderer } from './TemplateLiteralRenderer.mjs'
class MarkdownRenderer extends TemplateLiteralRenderer {
    constructor (resolve, readFile, markdown) {
        super(resolve, readFile)
        this.markdown = markdown
    }

    accepts (filePath) {
        return filePath.endsWith('.md')
    }

    async render(content, initialContext = {}, isLayout = false) {
        let data = !isLayout ? this.markdown.render(content) : content
        let html = await super.render(data, initialContext, isLayout)
        return html
    }
}

export {
    MarkdownRenderer
}