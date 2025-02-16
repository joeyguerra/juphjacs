class UriToStaticFileRoute {
    constructor(regex, filePath) {
        this.regex = regex && regex.test ? regex : new RegExp(regex)
        this.filePath = filePath
    }
    test(uri) {
        return this.regex.test(uri)
    }
}
export { UriToStaticFileRoute }