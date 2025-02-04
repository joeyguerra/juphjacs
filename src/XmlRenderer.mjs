import { TemplateLiteralRenderer } from './TemplateLiteralRenderer.mjs'

class XmlRenderer extends TemplateLiteralRenderer {
    constructor (resolve, readFile) {
        super(resolve, readFile)
    }

    accepts (filePath) {
        return filePath.endsWith('.xml')
    }
}

export { XmlRenderer }