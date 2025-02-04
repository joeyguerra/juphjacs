export default {
    title: 'Route',
    layout: './test/html/layout.html',
    route: '/route',
    param: null,
    async get(request) {
        const id = request.url.split('/').pop()
        await this.render(Object.assign({}, this.context, { param: id }))
        return new Response(this.output)
    },
    async post(request) {
        const formData = await request.formData()
        const param = formData.get('param')
        await this.render(Object.assign({}, this.context, { param }))
        return new Response(this.output)
    },
    async put(request) {
        const param = (await request.json()).param
        await this.render(Object.assign({}, this.context, { param }))
        return new Response(this.output)
    }
}