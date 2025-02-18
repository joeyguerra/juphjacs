import { UriToStaticFileRoute } from './UriToStaticFileRoute.mjs'
import { readFileSync } from 'node:fs'
import { readFile, access } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { TemplateLiteralRenderer } from './TemplateLiteralRenderer.mjs'

const EVENTS = {
    TEMPLATE_RENDERED: 'template rendered',
    PRE_TEMPLATE_RENDER: 'pre template render'
}

class Page {
    constructor (rootFolder, filePath, template, renderer) {
        this.rootFolder = rootFolder
        this.filePath = filePath
        this.template = template
        this.content = null
        this.contentType = 'text/html'
        this.renderer = renderer
    }

    static async get(filePath, rootFolder) {
        let template = ''

        try {
            template = await readFile(filePath, 'utf-8')
        } catch (e) {
            console.warn('getting html file', e.message)
        }

        let module = null
        try {
            await access(filePath.replace(/\.(html|xml|md)$/, '.mjs'))
            module = await import(filePath.replace(/\.(html|xml|md)$/, '.mjs'))
        } catch (e) {
            if (e.code === 'ENOENT') return null
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
        
        process.emit(EVENTS.PRE_TEMPLATE_RENDER, this.filePath, this)

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
        process.emit(EVENTS.TEMPLATE_RENDERED, this.route.filePath, this)

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
    Page,
    EVENTS
}