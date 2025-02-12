import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { TemplateLiteralRenderer } from '../src/TemplateLiteralRenderer.mjs'

export default {
    title: 'Login',
    layout: 'pages/layout.html',
    route: '/login',
    error: null,
    errorMessage: '',
    generatedCsrf: '123456',
    async get (req, res) {
        await res.render(this)
    },
    async post(req, res) {
        const { username, password, remember, csrf } = req.body
        if (username === 'admin' && password === 'admin'
            && csrf === this.generatedCsrf) {
            res.statusCode = 302
            res.setHeader('Set-Cookie', 'session=admin')
            res.setHeader('Location', '/admin')
            res.end(this.output)
            return
        }
        const data = await readFile('./pages/error.html', 'utf-8')
        this.error = 'Invalid credentials'
        this.errorMessage = await (new TemplateLiteralRenderer(resolve, readFile)).render(data, { error: this.error })
        await res.render(this)
    }
}