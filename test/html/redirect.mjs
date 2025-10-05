import { Page } from '../../src/domain/pages/Page.mjs'
import { TemplateEngine } from '../../src/infrastructure/templates/TemplateEngine.mjs'

class RedirectPage extends Page {
    constructor (rootFolder, filePath, template, delegate = { broadcast: async () => {} }) {
        super(rootFolder, filePath, template, delegate)
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
export default async (rootFolder, filePath, template, delegate) => {
    return new RedirectPage(rootFolder, filePath, template, delegate)
}
