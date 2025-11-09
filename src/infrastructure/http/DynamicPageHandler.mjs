class DynamicPageHandler {
    constructor(options = {}) {
        this.pagesFolder = options.pagesFolder
        this.findPageByRoute = options.findPageByRoute
        this.context = options.context || {}
    }

    async handle(req, res) {
        // Parse URL - req.url might be relative or absolute
        const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
        const route = url.pathname
        
        // Find the page from repository
        const page = await this.findPageByRoute(route)
        
        if (!page) {
            return false
        }
        
        // Get the HTTP method name in lowercase
        const method = req.method.toLowerCase()
        
        // Check if page has the method
        if (typeof page[method] !== 'function') {
            return false
        }
        
        // Call the page method
        await page[method](req, res)
        
        return true
    }
}

export { DynamicPageHandler }
