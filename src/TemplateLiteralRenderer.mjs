class TemplateLiteralRenderer {
    constructor () {}

    accepts (filePath) {
        return filePath.endsWith('.html')
    }

    async render(content, context = {}) {
        let body = this.escapeScriptBackticks(content)
        try {
            const asyncTemplate = new Function('context', `with (context) { return (async () => \`${body}\`)() }`)
            body = await asyncTemplate(context)
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