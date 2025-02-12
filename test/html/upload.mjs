export default {
    upload: {},
    async post (req, res) {
        const formData = await req.formData()
        const upload = formData.get('file')
        const buffer = await upload.arrayBuffer();
        upload.content = Buffer.from(buffer).toString('utf-8');
        await this.render({ upload })
        res.setHeader('Content-Type', 'text/html')
        res.end(this.output)
    }
}