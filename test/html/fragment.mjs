
import { Page } from '../../src/domain/pages/Page.mjs'
import { TemplateEngine } from '../../src/infrastructure/templates/TemplateEngine.mjs'

class FragmentPage extends Page {
    constructor (rootFolder, filePath, template, delegate = { broadcast: async () => {} }) {
        super(rootFolder, filePath, template, delegate)
        this.title = 'Page that includes a fragment'
        this.layout = './test/html/layout.html'
        this.component = {
            name: null
        }
    }

    async get (req, res) {
        await this.render({
            component: {
                name: 'This is the component name'
            }
        })
        res.end(this.content)
    }
}
export default async (rootFolder, filePath, template, delegate) => {
    return new FragmentPage(rootFolder, filePath, template, delegate)
}
