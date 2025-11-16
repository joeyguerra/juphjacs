class UriToStaticFileRoute {
    constructor(regex, filePath) {
        if (typeof(regex) === 'string') {
            this.originalPath = regex
            regex = regex.replace(/^\//, '')
            regex = new RegExp(`^/${regex}`)
        } else {
            this.originalPath = null
        }
        this.regex = regex instanceof RegExp ? regex : new RegExp(regex)
        this.filePath = filePath
        this.isIndexHtml = this.originalPath?.endsWith('/index.html') || this.originalPath === '/index.html'
    }

    test(uri) {
        // First try exact regex match
        if (this.regex.test(uri)) {
            return true
        }

        // If this route is for an index.html file, also match directory-style URLs
        if (this.isIndexHtml && this.originalPath) {
            // Handle root index.html: "/" should match "/index.html"
            if (this.originalPath === '/index.html' && uri === '/') {
                return true
            }

            // For non-root index.html files like "/guide-successful-software/index.html"
            // Extract the directory path by removing "/index.html"
            const dirPath = this.originalPath.replace(/\/index\.html$/, '')
            
            if (dirPath) {
                // Match directory with trailing slash: "/guide-successful-software/"
                if (uri === dirPath + '/') {
                    return true
                }
                // Match directory without trailing slash: "/guide-successful-software"
                if (uri === dirPath) {
                    return true
                }
            }
        }

        return false
    }

    match(uri) {
        return this.regex.exec(uri)
    }
}

export { UriToStaticFileRoute }
