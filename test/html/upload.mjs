import { Page } from '../../src/Page.mjs'
import { TemplateLiteralRenderer } from '../../src/TemplateLiteralRenderer.mjs'

class UploadPage extends Page {
    constructor (rootFolder, filePath, template) {
        super(rootFolder, filePath, template, new TemplateLiteralRenderer())
        this.title = 'Upload page'
        this.layout = './test/html/layout.html'
        this.upload = null
    }
    async post (req, res) {
        const formData = await req.formData()
        this.upload = formData.files.file
        await this.render()
        res.setHeader('Content-Type', 'text/html')
        res.statusCode = 201
        res.end(this.content)
    }
}
export default async (rootFolder, filePath, template) => {
    return new UploadPage(rootFolder, filePath, template)
}
