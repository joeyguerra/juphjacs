class UriToStaticFileRoute {
    constructor(regex, filePath, renderTemplate) {
        this.regex = regex
        this.filePath = filePath
        this.renderTemplate = renderTemplate
    }
    match(uri) {
        return this.regex.test(uri)
    }
}
export { UriToStaticFileRoute }