
import { Page } from '../index.mjs'

class LogoutPage extends Page {
    constructor (pagesFolder, filePath, template, delegate) {
        super(pagesFolder, filePath, template, delegate)
        this.title = 'Logout'
        this.layout = './pages/layout.html'
        this.error = null
        this.generatedCsrf = '123456'
    }
    
    async get (req, res) {
        res.setHeader('Set-Cookie', 'session=; Max-Age=0')
        await this.render()
        res.setHeader('Content-Type', 'text/html')
        res.end(this.content)
    }
}

export default async (pagesFolder, filePath, template, delegate) => {
    return new LogoutPage(pagesFolder, filePath, template, delegate)
}

