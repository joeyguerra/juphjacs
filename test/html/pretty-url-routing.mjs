
import { Page } from '../../src/Page.mjs'
import { TemplateLiteralRenderer } from '../../src/TemplateLiteralRenderer.mjs'
import { UriToStaticFileRoute } from '../../src/UriToStaticFileRoute.mjs'

class PrettyUrlRoutingPage extends Page {
    constructor (rootFolder, filePath, template) {
        super(rootFolder, filePath, template, new TemplateLiteralRenderer())
        this.title = 'Test Pretty URL Routing'
        this.layout = 'test/fixtures/pages/layout.html'
        this.route = new UriToStaticFileRoute('/pretty-url-routing', filePath)
    }
}

export default async (rootFolder, filePath, template) => {
    return new PrettyUrlRoutingPage(rootFolder, filePath, template)
}
