export default {
    title: 'Redirect',
    layout: './test/html/layout.html',
    route: '/redirect',
    param: null,
    async get(req, res) {
        res.setHeader('Set-Cookie', 'theme=light; Path=/; HttpOnly')
        res.setHeader('Location', 'http://localhost/cookie')
        res.statusCode = 302
        res.end('Test Cookie')
    }
}