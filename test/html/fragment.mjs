
import { Page } from '../../src/Page.mjs'
import { TemplateLiteralRenderer } from '../../src/TemplateLiteralRenderer.mjs'

class FragmentPage extends Page {
    constructor (rootFolder, filePath, template) {
        super(rootFolder, filePath, template, new TemplateLiteralRenderer())
        this.title = 'Page that includes a fragment'
        this.layout = './test/html/layout.html'
        this.component = {
            name: null
        }
    }

    async get (req, res) {
        const content = await this.render({
            component: {
                name: 'This is the component name'
            }
        })
        res.end(content)
    }
}
export default async (rootFolder, filePath, template) => {
    return new FragmentPage(rootFolder, filePath, template)
}
