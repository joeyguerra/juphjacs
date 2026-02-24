import { describe, it } from 'node:test'
import assert from 'node:assert'
import { TemplateEngine } from '../src/infrastructure/templates/TemplateEngine.mjs'
import { createSignedTemplateManifest } from '../src/infrastructure/templates/TemplateManifest.mjs'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { generateKeyPairSync } from 'node:crypto'

describe('TemplateEngine', () => {
    it('should render template literals with context', async () => {
        const engine = new TemplateEngine({ allowInlineTemplates: true })
        const template = '<h1>${title}</h1><p>${content}</p>'
        const context = { title: 'Hello', content: 'World' }
        
        const result = await engine.render(template, context)
        
        assert.strictEqual(result, '<h1>Hello</h1><p>World</p>')
    })

    it('should escape client-side template literals in script tags', async () => {
        const engine = new TemplateEngine({ allowInlineTemplates: true })
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
        const engine = new TemplateEngine({ allowInlineTemplates: true })
        const template = '<div>${outer ? `<span>${inner}</span>` : \'\'}</div>'
        const context = { outer: true, inner: 'Nested' }
        
        const result = await engine.render(template, context)
        
        assert.ok(result.includes('<span>Nested</span>'))
    })

    it('should handle expressions in templates', async () => {
        const engine = new TemplateEngine({ allowInlineTemplates: true })
        const template = '<div>${items.map(i => `<li>${i}</li>`).join(\'\')}</div>'
        const context = { items: ['One', 'Two', 'Three'] }
        
        const result = await engine.render(template, context)
        
        assert.ok(result.includes('<li>One</li>'))
        assert.ok(result.includes('<li>Two</li>'))
        assert.ok(result.includes('<li>Three</li>'))
    })

    it('should handle async rendering', async () => {
        const engine = new TemplateEngine({ allowInlineTemplates: true })
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
        const engine = new TemplateEngine({ allowInlineTemplates: true })
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
        const engine = new TemplateEngine({ allowInlineTemplates: true })
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
        const engine = new TemplateEngine({ allowInlineTemplates: true })
        const template = '<div>${typeof title !== \'undefined\' ? title : \'Default\'}</div>'
        const context = {}
        
        const result = await engine.render(template, context)
        
        assert.ok(result.includes('Default'))
    })

    it('should handle nullish coalescing for undefined variables', async () => {
        const engine = new TemplateEngine({ allowInlineTemplates: true })
        const template = '<img src="${image ?? \'default.jpg\'}" alt="${alt ?? \'No alt text\'}">'
        const context = { image: 'photo.jpg' }  // alt is undefined
        
        const result = await engine.render(template, context)
        
        assert.ok(result.includes('src="photo.jpg"'))
        assert.ok(result.includes('alt="No alt text"'))
    })

    it('should handle optional chaining with nullish coalescing', async () => {
        const engine = new TemplateEngine({ allowInlineTemplates: true })
        const template = '<div>${user?.name ?? \'Guest\'}</div>'
        const context = {}  // user is undefined
        
        const result = await engine.render(template, context)
        
        assert.ok(result.includes('Guest'))
    })

    it('should verify template hashes with a signed manifest', async () => {
        const rootDir = await mkdtemp(join(tmpdir(), 'template-manifest-'))
        const templatePath = join(rootDir, 'index.html')
        const manifestPath = join(rootDir, 'template-manifest.json')
        const publicKeyPath = join(rootDir, 'template-public.pem')

        try {
            await mkdir(rootDir, { recursive: true })
            await writeFile(templatePath, '<h1>${title}</h1>')

            const { privateKey, publicKey } = generateKeyPairSync('ed25519', {
                privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
                publicKeyEncoding: { type: 'spki', format: 'pem' }
            })

            const manifest = await createSignedTemplateManifest({
                trustedRoots: [rootDir],
                privateKeyPem: privateKey
            })

            await writeFile(manifestPath, JSON.stringify(manifest, null, 2))
            await writeFile(publicKeyPath, publicKey)

            const engine = new TemplateEngine({
                trustedRoots: [rootDir],
                signedManifestPath: manifestPath,
                publicKeyPath,
                requireSignedManifest: true
            })

            const template = await readFile(templatePath, 'utf-8')
            const result = await engine.render(template, { title: 'Signed OK' }, {
                templatePath,
                verificationContent: template
            })

            assert.match(result, /Signed OK/)
        } finally {
            await rm(rootDir, { recursive: true, force: true })
        }
    })

    it('should reject template content that does not match signed manifest hash', async () => {
        const rootDir = await mkdtemp(join(tmpdir(), 'template-manifest-'))
        const templatePath = join(rootDir, 'index.html')
        const manifestPath = join(rootDir, 'template-manifest.json')
        const publicKeyPath = join(rootDir, 'template-public.pem')

        try {
            await mkdir(rootDir, { recursive: true })
            await writeFile(templatePath, '<h1>${title}</h1>')

            const { privateKey, publicKey } = generateKeyPairSync('ed25519', {
                privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
                publicKeyEncoding: { type: 'spki', format: 'pem' }
            })

            const manifest = await createSignedTemplateManifest({
                trustedRoots: [rootDir],
                privateKeyPem: privateKey
            })

            await writeFile(manifestPath, JSON.stringify(manifest, null, 2))
            await writeFile(publicKeyPath, publicKey)

            const engine = new TemplateEngine({
                trustedRoots: [rootDir],
                signedManifestPath: manifestPath,
                publicKeyPath,
                requireSignedManifest: true
            })

            await assert.rejects(
                engine.render('<h1>${title}</h1><!--tampered-->', { title: 'bad' }, {
                    templatePath,
                    verificationContent: '<h1>${title}</h1><!--tampered-->'
                }),
                /hash mismatch/i
            )
        } finally {
            await rm(rootDir, { recursive: true, force: true })
        }
    })
})
