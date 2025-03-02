import { readFile } from 'node:fs/promises'
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

    async render(content, initialContext = {}) {
        let body = content
        if (content.startsWith('---')) {
            const parts = content.split('---')
            const frontMatter = parts[1].trim()
            const fn = new Function(`return ${frontMatter}`)
            Object.assign(initialContext, fn())
            body = parts[2]
        }
        const data = this.markdown.render(body)
        return super.render(data, initialContext)
    }
}

export {
    MarkdownRenderer
}