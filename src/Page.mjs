class Page {
    constructor (rootFolder, filePath, template, rendererFactory) {
        this.rootFolder = rootFolder
        this.filePath = filePath
        this.layout = null
        this.route = null
        this.template = template
        this.output = null
        this.rendererFactory = rendererFactory
        this.context = null
    }
    async render (context) {
        const { template, context: defaultContext} = await this.rendererFactory.get(this.filePath)
        
        if (!template) {
            return null
        }

        if (defaultContext) {
            context = Object.assign({}, defaultContext, context)
        }

        context = this.clearBodyFromPreviousRenders(context)

        this.output = await template.render(this.template, context)

        Array.from(['get', 'post', 'put', 'delete', 'head', 'options', 'trace']).forEach(method => {
            if (!template.context[method]) return
            if (typeof template.context[method] === 'function') {
                this[method] = template.context[method].bind(this)
            }
        })
        this.context = template.context
        this.layout = template.context.layout
        this.title = template.context.title ?? 'Unkown Page Title'
        this.route = template.context.route ?? this.filePath.replace(this.rootFolder, '').replace(/\\/g, '/')
        if (typeof this.route === 'string' && this.route.endsWith('.md')) {
            this.route = this.route.replace('.md', '.html')
        }
        return this
    }

    clearBodyFromPreviousRenders (context) {
        if (context.body) {
            delete context.body
        }
        return context
    }
}

export { 
    Page
}