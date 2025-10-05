
import { Page } from '../index.mjs'

class ErrorPage extends Page {
    constructor (pagesFolder, filePath, template, delegate) {
        super(pagesFolder, filePath, template, delegate)
        this.title = 'Error'
        this.layout = './pages/blog/layout.html'
        this.error = null
    }
}

export default async (pagesFolder, filePath, template, delegate) => {
    return new ErrorPage(pagesFolder, filePath, template, delegate)
}
