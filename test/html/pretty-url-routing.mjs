
import { Page } from '../../src/domain/pages/Page.mjs'
import { TemplateEngine } from '../../src/infrastructure/templates/TemplateEngine.mjs'
import { UriToStaticFileRoute } from '../../src/infrastructure/routing/UriToStaticFileRoute.mjs'

class PrettyUrlRoutingPage extends Page {
    constructor (rootFolder, filePath, template, delegate = { broadcast: async () => {} }) {
        super(rootFolder, filePath, template, delegate)
        this.title = 'Test Pretty URL Routing'
        this.layout = 'test/fixtures/pages/layout.html'
        this.route = new UriToStaticFileRoute('/pretty-url-routing', filePath)
    }
}

export default async (rootFolder, filePath, template, delegate) => {
    return new PrettyUrlRoutingPage(rootFolder, filePath, template, delegate)
}
