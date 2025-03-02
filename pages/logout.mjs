
import { Page } from '../src/Page.mjs'
import { TemplateLiteralRenderer } from '../src/TemplateLiteralRenderer.mjs'

class LogoutPage extends Page {
    constructor (rootFolder, filePath, template) {
        super(rootFolder, filePath, template, new TemplateLiteralRenderer())
        this.title = 'Logout'
        this.layout = './pages/layout.html'
        this.error = null
        this.generatedCsrf = '123456'
    }
    
    async get (req, res) {
        res.setHeader('Set-Cookie', 'session=; Max-Age=0')
        const content = await this.render()
        res.end(content)
    }
}

export default async (rootFolder, filePath, template) => {
    return new LogoutPage(rootFolder, filePath, template)
}

