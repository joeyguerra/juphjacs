export default {
    title: 'Route',
    layout: './test/html/layout.html',
    route: '/route',
    param: null,
    async get(req, res) {
        const id = req.url.split('/').pop()
        await this.render(Object.assign({}, this.context, { param: id }))
        res.setHeader('Content-Type', 'text/html')
        res.end(this.output)
    },
    async post(req, res) {
        const formData = await req.formData()
        const param = formData.get('param')
        await this.render(Object.assign({}, this.context, { param }))
        res.setHeader('Content-Type', 'text/html')
        res.end(this.output)
    },
    async put(req, res) {
        const param = (await req.json()).param
        await this.render(Object.assign({}, this.context, { param }))
        res.setHeader('Content-Type', 'text/html')
        res.end(this.output)
    }
}