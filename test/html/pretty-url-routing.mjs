
import { Page } from '../../src/domain/pages/Page.mjs'
import { TemplateEngine } from '../../src/infrastructure/templates/TemplateEngine.mjs'
import { UriToStaticFileRoute } from '../../src/infrastructure/routing/UriToStaticFileRoute.mjs'

class PrettyUrlRoutingPage extends Page {
    constructor (rootFolder, filePath, template, context = {}) {
        super(rootFolder, filePath, template, context)
        this.title = 'Test Pretty URL Routing'
        this.layout = 'test/fixtures/pages/layout.html'
        this.route = new UriToStaticFileRoute('/pretty-url-routing', filePath)
    }
}

export default async (rootFolder, filePath, template, context) => {
    return new PrettyUrlRoutingPage(rootFolder, filePath, template, context)
}
