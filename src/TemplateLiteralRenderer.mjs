class TemplateLiteralRenderer {
    constructor (resolve, readFile) {
        this.context = {}
        this.resolve = resolve
        this.readFile = readFile
    }

    accepts (filePath) {
        return filePath.endsWith('.html')
    }

    async render(content, initialContext = {}, isLayout = false) {
        let body = this.escapeScriptBackticks(content)
        this.context = Object.assign({}, initialContext)
        try {
            const template = new Function('context', `with (context) { return \`${body}\` }`)
            body = template(this.context)
        } catch (e) {
            throw e
        } finally {
            body = this.restoreScriptBackticks(body)
        }
        if (!isLayout && this.context.layout) {
            this.context.layout = this.resolve(this.context.layout)
            const layoutHtml = await this.readFile(this.context.layout, 'utf-8')
            const layoutContext = Object.assign({}, this.context)
            body = this.render(layoutHtml, { body, ...layoutContext }, true)
        }
        return body
    }

    escapeScriptBackticks(html) {
        return html.replace(/<script\s*([^>]*)>([\s\S]*?)<\/script>/g, (match, attributes, content) => {
            return `<script ${attributes}>${content.replace(/`/g, '\\`').replace(/\$/g, '$DOLLAR_SIGN')}</script>`
        })
    }
      
    restoreScriptBackticks(html) {
        return html.replace(/<script\s*([^>]*)>([\s\S]*?)<\/script>/g, (match, attributes, content) => {
          return `<script ${attributes}>${content.replace(/\\`/g, '`').replace(/\$DOLLAR_SIGN/g, '$')}</script>`
        })
      }
    }

export {
    TemplateLiteralRenderer
}