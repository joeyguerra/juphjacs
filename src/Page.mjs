import { UriToStaticFileRoute } from './UriToStaticFileRoute.mjs'
import { readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { TemplateLiteralRenderer } from './TemplateLiteralRenderer.mjs'

class Page {
    constructor (rootFolder, filePath, template, renderer) {
        this.rootFolder = rootFolder
        this.filePath = filePath
        this.template = template
        this.content = null
        this.contentType = 'text/html'
        this.renderer = renderer
    }

    static async get(url, rootFolder) {
        let filePath =  join(rootFolder, url.pathname)
        let template = ''
        let fileExists = true

        try {
            template = await readFile(filePath, 'utf-8')
        } catch (e) {
            console.warn('getting html file', e.message)
            fileExists = false
        }

        if (!fileExists) {
            try {
                filePath = filePath.replace(/\.(html|xml)$/, '.md')
                template = await readFile(filePath, 'utf-8')
                fileExists = true
            } catch (e) {
                console.warn('getting markdown file', e.message)
            }
        }

        let module = null
        try {
            module = await import(filePath.replace(/\.(html|xml|md)$/, '.mjs'))
        } catch (e) {
            console.warn(e, `${e.message} for ${filePath.replace(/\.(html|xml|md)$/, '.mjs')}`)
        }
        if (!module) return null
        return await module?.default(rootFolder, filePath, template)
    }

    async include (filePath) {
        filePath = join(this.rootFolder, filePath)
        const template = await readFile(filePath, 'utf-8')
        const module = await import(filePath.replace(/\.(html|xml)$/, '.mjs'))
        const page = await module.default(this.rootFolder, filePath, template)
        Object.assign(page, this)
        return await this.renderer.render(template, this)
    }
    async includeIf (filePath, condition) {
        if (condition) {
            return await this.include(filePath)
        }
        return ''
    }
    async render (context = {}) {
        context = this.clearBodyFromPreviousRenders(context)
        
        // Set context properties to this Page instance so that the API for interacting with the Page is "easy".
        Object.keys(context).reduce((acc, key) => {
            acc[key] = context[key]
            return acc
        }, this)

        this.content = await this.renderer.render(this.template, this)
        if (this.layout) {
            this.layout = resolve(this.layout)
            const layoutHtml = await readFile(this.layout, 'utf-8')
            this.content = await (new TemplateLiteralRenderer()).render(layoutHtml, { body: this.content, ...this })
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
            this.route.regex = new RegExp(this.route.regex.source.replace('.md', '.html'))
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