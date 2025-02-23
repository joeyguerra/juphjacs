
import { Page } from '../../src/Page.mjs'
import { TemplateLiteralRenderer } from '../../src/TemplateLiteralRenderer.mjs'

class CookiePage extends Page {
    constructor (rootFolder, filePath, template) {
        super(rootFolder, filePath, template, new TemplateLiteralRenderer())
        this.title = 'Cookie Page'
        this.layout = './test/html/layout.html'
        this.cookie = null
    }
    async get (req, res) {
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

export default async (rootFolder, filePath, template) => {
    return new CookiePage(rootFolder, filePath, template)
}
