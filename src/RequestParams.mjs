class RequestParams {
    constructor(url, regex) {
        this.params = new URLSearchParams(url.search)
        this.regex = regex
        if (this.regex) {
            this.matched = this.regex.exec(url.pathname)
            Object.keys(this.matched?.groups ?? {}).forEach(key => {
                this.params.set(key, this.matched.groups[key])
            })
        }
        this.params?.forEach((value, key) => {
            this[key] = value
        })
    }
    get(name) {
        return this.params.get(name)
    }
    getAll(name) {
        return this.params.getAll(name)
    }
}

export { RequestParams }