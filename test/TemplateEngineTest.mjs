import { describe, it } from 'node:test'
import assert from 'node:assert'
import { TemplateEngine } from '../src/infrastructure/templates/TemplateEngine.mjs'

describe('TemplateEngine', () => {
    it('should render template literals with context', async () => {
        const engine = new TemplateEngine()
        const template = '<h1>${title}</h1><p>${content}</p>'
        const context = { title: 'Hello', content: 'World' }
        
        const result = await engine.render(template, context)
        
        assert.strictEqual(result, '<h1>Hello</h1><p>World</p>')
    })

    it('should escape client-side template literals in script tags', async () => {
        const engine = new TemplateEngine()
        const template = `
<div>\${serverVar}</div>
<script>
const clientCode = \`Hello \${name}\`
</script>`
        const context = { serverVar: 'Server Value' }
        
        const result = await engine.render(template, context)
        
        assert.ok(result.includes('<div>Server Value</div>'))
        assert.ok(result.includes('`Hello ${name}`'))
        assert.ok(!result.includes('\\${'))
    })

    it('should handle nested template literals', async () => {
        const engine = new TemplateEngine()
        const template = '<div>${outer ? `<span>${inner}</span>` : \'\'}</div>'
        const context = { outer: true, inner: 'Nested' }
        
        const result = await engine.render(template, context)
        
        assert.ok(result.includes('<span>Nested</span>'))
    })

    it('should handle expressions in templates', async () => {
        const engine = new TemplateEngine()
        const template = '<div>${items.map(i => `<li>${i}</li>`).join(\'\')}</div>'
        const context = { items: ['One', 'Two', 'Three'] }
        
        const result = await engine.render(template, context)
        
        assert.ok(result.includes('<li>One</li>'))
        assert.ok(result.includes('<li>Two</li>'))
        assert.ok(result.includes('<li>Three</li>'))
    })

    it('should handle async rendering', async () => {
        const engine = new TemplateEngine()
        const template = '<div>${asyncData}</div>'
        
        // Pre-fetch async data
        const asyncData = await new Promise(resolve => {
            setTimeout(() => resolve('Async Data'), 10)
        })
        
        const context = { asyncData }
        
        const result = await engine.render(template, context)
        
        assert.ok(result.includes('Async Data'))
    })

    it('should preserve client-side backticks in multiple script tags', async () => {
        const engine = new TemplateEngine()
        const template = `
<div>\${title}</div>
<script>
const template1 = \`Client \${var1}\`
</script>
<div>\${content}</div>
<script>
const template2 = \`Another \${var2}\`
</script>`
        const context = { title: 'Title', content: 'Content' }
        
        const result = await engine.render(template, context)
        
        assert.ok(result.includes('<div>Title</div>'))
        assert.ok(result.includes('<div>Content</div>'))
        assert.ok(result.includes('`Client ${var1}`'))
        assert.ok(result.includes('`Another ${var2}`'))
    })

    it('should handle context with methods', async () => {
        const engine = new TemplateEngine()
        const template = '<div>${this.getMessage()}</div>'
        const context = {
            getMessage() {
                return 'Method Result'
            }
        }
        
        const result = await engine.render(template, context)
        
        assert.ok(result.includes('Method Result'))
    })

    it('should handle undefined variables with fallback', async () => {
        const engine = new TemplateEngine()
        const template = '<div>${typeof title !== \'undefined\' ? title : \'Default\'}</div>'
        const context = {}
        
        const result = await engine.render(template, context)
        
        assert.ok(result.includes('Default'))
    })
})
