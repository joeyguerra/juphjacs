class Page {
    constructor (rootFolder, filePath, template, rendererFactory, readFile) {
        this.rootFolder = rootFolder
        this.filePath = filePath
        this.template = template
        this.output = null
        this.rendererFactory = rendererFactory
        this.contentType = 'text/html'
        this.readFile = readFile
    }

    include (context, filePath) {
        this.readFile(filePath, 'utf-8')
        .then(data => {
            return this.rendererFactory.get(filePath).then(async ({ template, context: defaultContext }) => {
                if (defaultContext) {
                    context = Object.assign({}, context, defaultContext)
                }
                return await template.render(data, context)
            })
        }).catch(console.error)
    }

    async render (context) {
        const { template, context: defaultContext} = await this.rendererFactory.get(this.filePath)
        
        if (!template) {
            return null
        }

        if (defaultContext) {
            context = Object.assign({}, context, defaultContext)
        }
        
        context = this.clearBodyFromPreviousRenders(context)
        context.include = this.include.bind(this, context)
        this.output = await template.render(this.template, context)

        Array.from(['get', 'post', 'put', 'delete', 'head', 'options', 'trace']).forEach(method => {
            if (!template.context[method]) return
            if (typeof template.context[method] === 'function') {
                this[method] = template.context[method].bind(this)
            }
        })
        Object.keys(template.context).reduce((acc, key) => {
            if (acc[key]) {
                if(typeof(acc[key]) === 'function') {
                    acc[key] = acc[key].bind(acc)
                }
                return acc
            }

            if (typeof(template.context[key]) === 'function') {
                acc[key] = template.context[key].bind(acc)
                return acc
            }
            acc[key] = template.context[key]
            return acc
        }, this)

        if (!this.route) {
            this.route = this.filePath.replace(this.rootFolder, '').replace(/\\/g, '/')
        }

        if (typeof this.route === 'string' && this.route.endsWith('.md')) {
            this.route = this.route.replace('.md', '.html')
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