export default {
    cookie: null,
    async get (req, res) {
        let cookie = {}
        const headerCookie = req.headers.Cookie
        if (headerCookie) {
            cookie = headerCookie.split(';').reduce((acc, item) => {
                const [key, value] = item.split('=').map(part => part.trim())
                acc[key] = value
                return acc
            }, {})
        }
        await this.render(Object.assign({}, this.context, { cookie }))
        res.setHeader('Content-Type', 'text/html')
        res.end(this.output)
    }
}