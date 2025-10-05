
import { Page } from '../index.mjs'

class LoginPage extends Page {
    constructor (pagesFolder, filePath, template, delegate) {
        super(pagesFolder, filePath, template, delegate)
        this.title = 'Login'
        this.layout = './pages/layout.html'
        this.error = null
        this.generatedCsrf = '123456'
    }
    
    async get (req, res) {
        await this.render()
        res.setHeader('Content-Type', 'text/html')
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
        res.setHeader('Content-Type', 'text/html')
        await res.end(this.content)
    }

}

export default async (pagesFolder, filePath, template, delegate) => {
    return new LoginPage(pagesFolder, filePath, template, delegate)
}
