class UriToStaticFileRoute {
    constructor(regex, filePath) {
        if (typeof(regex) === 'string') {
            regex = regex.replace(/^\//, '')
            regex = new RegExp(`^/${regex}`)
        }
        this.regex = regex instanceof RegExp ? regex : new RegExp(regex)
        this.filePath = filePath
    }

    test(uri) {
        return this.regex.test(uri)
    }

    match(uri) {
        return this.regex.exec(uri)
    }
}

export { UriToStaticFileRoute }
