
import { Page } from '../index.mjs'

class AdminPage extends Page {
    constructor (pagesFolder, filePath, template, delegate) {
        super(pagesFolder, filePath, template, delegate)
        this.title = 'Admin Page'
        this.layout = './pages/layout.html'
    }
}

export default async (pagesFolder, filePath, template, delegate) => {
    return new AdminPage(pagesFolder, filePath, template, delegate)
}
