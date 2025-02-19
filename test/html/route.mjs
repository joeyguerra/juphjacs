import { Page } from '../../src/Page.mjs'
import { TemplateLiteralRenderer } from '../../src/TemplateLiteralRenderer.mjs'

class RoutePage extends Page {
    constructor (rootFolder, filePath, template) {
        super(rootFolder, filePath, template, new TemplateLiteralRenderer())
        this.title = 'Routing page'
        this.layout = './test/html/layout.html'
    }

    async get(req, res) {
        const id = req.url.split('/').pop()
        this.param = id
        await this.render()
        res.setHeader('Content-Type', 'text/html')
        res.end(this.content)
    }
    async post(req, res) {
        const buffers = []
        for await (const chunk of req) {
            buffers.push(chunk)
        }
        const data = Buffer.concat(buffers).toString()
        const formData = new URLSearchParams(data)
        const param = formData.get('param')
        await this.render(Object.assign({}, this.context, { param }))
        res.setHeader('Content-Type', 'text/html')
        res.end(this.content)
    }

    async put(req, res) {
        const param = (await req.json()).param
        await this.render({ param })
        res.setHeader('Content-Type', 'text/html')
        res.statusCode = 201
        res.end(this.content)
    }

    async delete(req, res) {
        res.statusCode = 202
        res.end(`${req.method} ${(await req.json()).param}`)
    }
}

export default async (rootFolder, filePath, template) => {
    return new RoutePage(rootFolder, filePath, template)
}