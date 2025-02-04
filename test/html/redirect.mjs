export default {
    title: 'Redirect',
    layout: './test/html/layout.html',
    route: '/redirect',
    param: null,
    async get(request, response) {
        return new Response('Test cookie', {
            status: 302,
            headers: {
                'Location': 'http://localhost/cookie',
                'Set-Cookie': 'theme=dark; Path=/; HttpOnly'
            }
        })
    }
}