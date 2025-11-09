
import { Page } from '../../src/domain/pages/Page.mjs'
import { TemplateEngine } from '../../src/infrastructure/templates/TemplateEngine.mjs'

class CookiePage extends Page {
    constructor (rootFolder, filePath, template, context = {}) {
        super(rootFolder, filePath, template, context)
        this.title = 'Cookie Page'
        this.layout = './test/html/layout.html'
        this.cookie = null
        this.id = null
    }
    async get (req, res) {
        const url = new URL(req.url, 'http://localhost')
        this.id = url.searchParams.get('id')
        const headerCookie = req.headers.cookie
        if (headerCookie) {
            this.cookie = headerCookie.split(';').reduce((acc, item) => {
                const [key, value] = item.split('=').map(part => part.trim())
                acc[key] = value
                return acc
            }, {})
        }
        
        await this.render()
        res.setHeader('Content-Type', 'text/html')
        res.end(this.content)
    }
}

export default async (rootFolder, filePath, template, context) => {
    return new CookiePage(rootFolder, filePath, template, context)
}
