import { Page } from '../../src/domain/pages/Page.mjs'
import { TemplateEngine } from '../../src/infrastructure/templates/TemplateEngine.mjs'

class RedirectPage extends Page {
    constructor (rootFolder, filePath, template, context = {}) {
        super(rootFolder, filePath, template, context)
        this.title = 'Redirect page'
        this.layout = './test/html/layout.html'
    }
    async get (req, res) {
        await this.render()
        res.statusCode = 302
        res.setHeader('Set-Cookie', 'theme=light; Path=/; HttpOnly')
        res.setHeader('Location', 'http://localhost/cookie')
        res.end('Redirect')
    }
}
export default async (rootFolder, filePath, template, context) => {
    return new RedirectPage(rootFolder, filePath, template, context)
}
