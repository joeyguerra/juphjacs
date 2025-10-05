import { Page } from '../../src/domain/pages/Page.mjs'
import { TemplateEngine } from '../../src/infrastructure/templates/TemplateEngine.mjs'

class ComponentPage extends Page {
    constructor (rootFolder, filePath, template, delegate = { broadcast: async () => {} }) {
        super(rootFolder, filePath, template, delegate)
        this.title = 'A Component'
        this.component = {
            name: 'Component'
        }
    }
}
export default (rootFolder, filePath, template, delegate) => {
    return new ComponentPage(rootFolder, filePath, template, delegate)
}
