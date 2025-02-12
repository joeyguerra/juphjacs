export default {
    title: 'Logout',
    layout: 'pages/layout.html',
    route: '/logout',
    async get (req, res) {
        res.setHeader('Set-Cookie', 'session=; Max-Age=0')
        await res.render(this)
    }
}