import { UriToStaticFileRoute } from './UriToStaticFileRoute.mjs'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

class Page {
    constructor (rootFolder, filePath, template, rendererFactory, readFile) {
        this.rootFolder = rootFolder
        this.filePath = filePath
        this.template = template
        this.output = null
        this.rendererFactory = rendererFactory
        this.contentType = 'text/html'
        this.readFile = readFile
        this.renderer = null
    }
    include (filePath) {
        const data = readFileSync(filePath, 'utf-8')
        return this.renderer.render(data, this)
    }
    includeIf (filePath, condition) {
        if (condition) {
            return this.include(filePath)
        }
        return ''
    }
    async render (context) {
        const { renderer, context: defaultContext} = await this.rendererFactory.get(this.filePath)
        this.renderer = renderer

        if (!this.renderer) {
            return null
        }

        // If there is a default context, merge it with the context passed in
        if (defaultContext) {
            context = Object.assign({}, defaultContext, context)
        }
        
        context = this.clearBodyFromPreviousRenders(context)
        
        // Set context properties to this Page instance so that the API for interacting with the Page is "easy".
        Object.keys(context).reduce((acc, key) => {
            acc[key] = context[key]
            return acc
        }, this)

        this.output = this.renderer.render(this.template, this)
        if (this.layout) {
            this.layout = resolve(this.layout)
            const layoutHtml = await this.readFile(this.layout, 'utf-8')
            this.output = this.renderer.render(layoutHtml, { body: this.output, ...this })
        }

        if (this.route && this.route.test && !(this.route instanceof UriToStaticFileRoute)) {
            this.route = new UriToStaticFileRoute(this.route, this.filePath)
        }

        if (!this.route) {
            this.route = new UriToStaticFileRoute(this.filePath.replace(this.rootFolder, '').replace(/\\/g, '/'), this.filePath)
        }

        if (typeof(this.route) === 'string') {
            this.route = new UriToStaticFileRoute(this.route, this.filePath)
        }

        if (this.filePath.endsWith('.md')) {
            this.route.filePath = this.filePath.replace('.md', '.html')
        }

        return this
    }

    clearBodyFromPreviousRenders (context) {
        if (context?.body) {
            delete context.body
        }
        return context
    }
}

export { 
    Page
}