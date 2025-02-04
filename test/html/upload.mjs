export default {
    upload: {},
    async post (request, response) {
        const formData = await request.formData()
        const upload = formData.get('file')
        upload.content = await upload.text()
        await this.render({ upload })
        return new Response(this.output)
    }
}