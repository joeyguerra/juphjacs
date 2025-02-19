
import { Page } from '../src/Page.mjs'
import { TemplateLiteralRenderer } from '../src/TemplateLiteralRenderer.mjs'

class LoginPage extends Page {
    constructor (rootFolder, filePath, template) {
        super(rootFolder, filePath, template, new TemplateLiteralRenderer())
        this.title = 'Login'
        this.layout = './pages/layout.html'
        this.error = null
        this.generatedCsrf = '123456'
    }
    
    async get (req, res) {
        await this.render()
        res.end(this.content)
    }

    async post(req, res) {
        const { username, password, remember, csrf } = await req.json()

        if (username === 'admin' && password === 'admin'
            && csrf === this.generatedCsrf) {
            res.statusCode = 302
            res.setHeader('Set-Cookie', 'session=admin')
            res.setHeader('Location', '/admin.html')
            res.end(this.content)
            return
        }
        this.error = 'Invalid credentials'
        await this.render()
        await res.end(this.content)
    }

}

export default async (rootFolder, filePath, template) => {
    return new LoginPage(rootFolder, filePath, template)
}
