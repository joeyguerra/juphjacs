class TemplateLiteralRenderer {
    constructor (resolve, readFile) {
        this.resolve = resolve
        this.readFile = readFile
    }

    accepts (filePath) {
        return filePath.endsWith('.html')
    }

    render(content, context = {}) {
        let body = this.escapeScriptBackticks(content)
        try {
            const template = new Function('context', `with (context) { return \`${body}\` }`)
            body = template(context)
        } catch (e) {
            throw e
        } finally {
            body = this.restoreScriptBackticks(body)
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