import { Page } from '../../src/Page.mjs'
import { TemplateLiteralRenderer } from '../../src/TemplateLiteralRenderer.mjs'

class RedirectPage extends Page {
    constructor (rootFolder, filePath, template) {
        super(rootFolder, filePath, template, new TemplateLiteralRenderer())
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
export default async (rootFolder, filePath, template) => {
    return new RedirectPage(rootFolder, filePath, template)
}
