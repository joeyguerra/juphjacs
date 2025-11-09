import { Page } from '../../src/domain/pages/Page.mjs'
import { TemplateEngine } from '../../src/infrastructure/templates/TemplateEngine.mjs'

class ComponentPage extends Page {
    constructor (rootFolder, filePath, template, context = {}) {
        super(rootFolder, filePath, template, context)
        this.title = 'A Component'
        this.component = {
            name: 'Component'
        }
    }
}
export default (rootFolder, filePath, template, context) => {
    return new ComponentPage(rootFolder, filePath, template, context)
}
