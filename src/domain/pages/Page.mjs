import { UriToStaticFileRoute } from '../../infrastructure/routing/UriToStaticFileRoute.mjs'
import { readFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { TemplateEngine } from '../../infrastructure/templates/TemplateEngine.mjs'
import { AssetType } from '../../policy/AssetPolicy.mjs'

/** @enum {string} */
const EVENTS = {
    TEMPLATE_RENDERED: 'template rendered',
    PRE_TEMPLATE_RENDER: 'pre template render'
}

class Page {
    constructor(pagesFolder, filePath, template, context = {}) {
        this.pagesFolder = pagesFolder
        this.filePath = filePath
        
        /** @type {AssetType} */
        this.fileType = resolve(filePath).endsWith('.md') ? AssetType.MARKDOWN : AssetType.HTML
        this.template = template
        this.sourceTemplate = template
        this.context = context
        this.content = null
        this.contentType = 'text/html'
        const templateSecurity = this.context?.templateSecurity || {}
        const trustedRoots = templateSecurity.trustedRoots?.length
            ? templateSecurity.trustedRoots
            : [this.pagesFolder]
        this.renderer = new TemplateEngine({
            trustedRoots,
            allowInlineTemplates: false,
            signedManifestPath: templateSecurity.signedManifestPath,
            publicKey: templateSecurity.publicKey,
            publicKeyPath: templateSecurity.publicKeyPath,
            requireSignedManifest: templateSecurity.requireSignedManifest === true,
            executionTimeoutMs: templateSecurity.executionTimeoutMs,
            workerMemoryLimitMb: templateSecurity.workerMemoryLimitMb,
            maxTemplateSizeBytes: templateSecurity.maxTemplateSizeBytes
        })
        this.route = new UriToStaticFileRoute(this.filePath.replace(this.pagesFolder, '').replace(/\\/g, '/'), this.filePath)
        this.uri = null
        this.layout = null
    }

    async include(filePath) {
        filePath = join(this.pagesFolder, filePath)
        const template = await readFile(filePath, 'utf-8')
        const module = await import(filePath.replace(/\.(html|xml)$/, '.mjs'))
        const page = await module.default(this.pagesFolder, filePath, template, this.context)
        Object.assign(page, this)
        return await this.renderer.render(template, this, { templatePath: filePath })
    }

    async includeIf(filePath, condition) {
        if (condition) {
            return await this.include(filePath)
        }
        return ''
    }

    async render(context = {}) {
        context = this.clearBodyFromPreviousRenders(context)

        process.emit(EVENTS.PRE_TEMPLATE_RENDER, this.filePath, this)

        // Set context properties to this Page instance so that the API for interacting with the Page is 'easy'.
        Object.keys(context).reduce((acc, key) => {
            acc[key] = context[key]
            return acc
        }, this)

        try {
            const renderOptions = {
                templatePath: this.filePath,
                verificationContent: this.sourceTemplate
            }
            this.content = await this.renderer.render(this.template, this, renderOptions)
        } catch (e) {
            throw e
        }

        if (this.layout) {
            this.layout = resolve(this.layout)
            const layoutHtml = await readFile(this.layout, 'utf-8')
            let layoutModule = {}
            try {
                layoutModule = await (await import(this.layout.replace(/\.(html|xml)$/, '.mjs'))).default(this.pagesFolder, this.layout, layoutHtml, this.context)
            } catch (e) {
                // Layout module is optional
            }
            this.content = await (new TemplateEngine({
                trustedRoots: this.renderer.trustedRoots,
                allowInlineTemplates: false,
                signedManifestPath: this.renderer.signedManifestPath,
                publicKey: this.renderer.publicKey,
                publicKeyPath: this.renderer.publicKeyPath,
                requireSignedManifest: this.renderer.requireSignedManifest,
                executionTimeoutMs: this.renderer.executionTimeoutMs,
                workerMemoryLimitMb: this.renderer.workerMemoryLimitMb,
                maxTemplateSizeBytes: this.renderer.maxTemplateSizeBytes
            })).render(layoutHtml, { body: this.content, ...layoutModule, ...this }, {
                templatePath: this.layout,
                verificationContent: layoutHtml
            })
        }

        if (typeof (this.route) === 'string' || this.route instanceof RegExp) {
            this.route = new UriToStaticFileRoute(this.route, this.filePath)
        }

        if (this.filePath.endsWith('.md')) {
            this.route.filePath = this.filePath.replace('.md', '.html')
            this.route.regex = new RegExp(this.route.regex.source.replace('.md', '.html'))
        }

        process.emit(EVENTS.TEMPLATE_RENDERED, this.route.filePath, this)

        return this
    }

    clearBodyFromPreviousRenders(context) {
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
