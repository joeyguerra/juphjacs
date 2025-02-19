import { Page } from '../../src/Page.mjs'
import { TemplateLiteralRenderer } from '../../src/TemplateLiteralRenderer.mjs'

class ComponentPage extends Page {
    constructor (rootFolder, filePath, template) {
        super(rootFolder, filePath, template, new TemplateLiteralRenderer())
        this.title = 'A Component'
        this.component = {
            name: 'Component'
        }
    }
}
export default (rootFolder, filePath, template) => {
    return new ComponentPage(rootFolder, filePath, template)
}
