class TemplateRendererFactory {
    constructor (getExtension, renderers) {
        this.getExtension = getExtension
        this.renderers = renderers
    }

    async get (filePath) {
        const renderer = this.renderers.find(template => template.accepts(filePath))
        if (!renderer) {
            return null
        }

        try {
            const mjsFile = filePath.split('.').slice(0, -1) + '.mjs'
            const context = (await import(mjsFile)).default
            return { renderer, context }
        } catch (e) {
            // console.error('factory', e)
        }

        return { renderer, context: null }
    }
}

export {
    TemplateRendererFactory
}