export default {
    cookie: null,
    async get (request, response) {
        let cookie = {}
        const headerCookie = request.headers.get('Cookie')
        if (headerCookie) {
            cookie = headerCookie.split(';').reduce((acc, item) => {
                const [key, value] = item.split('=').map(part => part.trim())
                acc[key] = value
                return acc
            }, {})
        }
        await this.render(Object.assign({}, this.context, { cookie }))
        return new Response(this.output)
    }
}