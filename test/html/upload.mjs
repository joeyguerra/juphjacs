import { Page } from '../../src/domain/pages/Page.mjs'
import { TemplateEngine } from '../../src/infrastructure/templates/TemplateEngine.mjs'

class UploadPage extends Page {
    constructor (rootFolder, filePath, template, context = {}) {
        super(rootFolder, filePath, template, context)
        this.title = 'Upload page'
        this.layout = './test/html/layout.html'
        this.upload = null
    }
    async post (req, res) {
        const formData = await req.formData()
        this.upload = formData.get('file')
        await this.render()
        res.setHeader('Content-Type', 'text/html')
        res.statusCode = 201
        res.end(this.content)
    }
}
export default async (rootFolder, filePath, template, context) => {
    return new UploadPage(rootFolder, filePath, template, context)
}
