class TemplateRendererFactory {
    constructor (getExtension, templates) {
        this.getExtension = getExtension
        this.templates = templates
    }

    async get (filePath) {
        const template = this.templates.find(template => template.accepts(filePath))
        if (!template) {
            return null
        }

        try {
            const mjsFile = filePath.split('.').slice(0, -1) + '.mjs'
            const context = (await import(mjsFile)).default
            return { template, context }
        } catch (e) {
            // console.error('factory', e)
        }

        return { template, context: null }
    }
}

export {
    TemplateRendererFactory
}