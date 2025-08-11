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
        let data = ''
        if (content.startsWith('---\n')) {
            const parts = content.split('---\n')
            const frontMatter = parts[1].trim()
            const restOfContent = parts.slice(2).join('---\n').trim()
            const fn = new Function(`return ${frontMatter}`)
            Object.assign(initialContext, fn())
            data = this.markdown.render(restOfContent)
        } else {
            data = this.markdown.render(content)
        }
        return super.render(data, initialContext)
    }
}

export {
    MarkdownRenderer
}