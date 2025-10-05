import { describe, it } from 'node:test'
import assert from 'node:assert'
import { MarkdownParser } from '../src/infrastructure/markdown/MarkdownParser.mjs'

describe('MarkdownParser', () => {
    it('should parse markdown without frontmatter', async () => {
        const parser = new MarkdownParser()
        const markdown = '# Hello World\n\nThis is a test.'
        
        const result = await parser.parse(markdown)
        
        assert.ok(result.html.includes('<h1>Hello World</h1>'))
        assert.ok(result.html.includes('<p>This is a test.</p>'))
        assert.deepStrictEqual(result.frontmatter, {})
    })

    it('should parse markdown with YAML frontmatter', async () => {
        const parser = new MarkdownParser()
        const markdown = `---
title: 'My Post'
dateString: '2024-01-01'
published: '2025-09-01'
tags:
  - test
  - markdown
---

# Content

This is the content.`
        
        const result = await parser.parse(markdown)
        
        assert.strictEqual(result.frontmatter.title, 'My Post')
        assert.strictEqual(result.frontmatter.dateString, '2024-01-01')
        assert.strictEqual(result.frontmatter.published, '2025-09-01')
        assert.deepStrictEqual(result.frontmatter.tags, ['test', 'markdown'])
        assert.ok(result.html.includes('<h1>Content</h1>'))
    })

    it('should handle empty frontmatter', async () => {
        const parser = new MarkdownParser()
        const markdown = `---
---

# Content`
        
        const result = await parser.parse(markdown)
        
        assert.deepStrictEqual(result.frontmatter, {})
        assert.ok(result.html.includes('<h1>Content</h1>'))
    })

    it('should handle markdown without closing frontmatter delimiter', async () => {
        const parser = new MarkdownParser()
        const markdown = `---
title: Test

# Content`
        
        const result = await parser.parse(markdown)
        
        // Should treat as regular markdown since frontmatter is incomplete
        assert.deepStrictEqual(result.frontmatter, {})
        assert.ok(result.html.includes('<h1>Content</h1>'))
    })

    it('should preserve frontmatter values with quotes', async () => {
        const parser = new MarkdownParser()
        const markdown = `---
title: "It's a test"
excerpt: 'Another "test"'
---

Content`
        
        const result = await parser.parse(markdown)
        
        assert.strictEqual(result.frontmatter.title, "It's a test")
        assert.strictEqual(result.frontmatter.excerpt, 'Another "test"')
    })

    it('should handle complex nested YAML', async () => {
        const parser = new MarkdownParser()
        const markdown = `---
meta:
  author: John Doe
  social:
    twitter: '@johndoe'
    github: 'johndoe'
tags: [one, two, three]
---

Content`
        
        const result = await parser.parse(markdown)
        
        assert.strictEqual(result.frontmatter.meta.author, 'John Doe')
        assert.strictEqual(result.frontmatter.meta.social.twitter, '@johndoe')
        assert.deepStrictEqual(result.frontmatter.tags, ['one', 'two', 'three'])
    })

    it('should support custom markdown-it options', async () => {
        const parser = new MarkdownParser({ breaks: true })
        const markdown = 'Line 1\nLine 2'
        
        const result = await parser.parse(markdown)
        
        // With breaks: true, single line breaks should create <br>
        assert.ok(result.html.includes('<br>'))
    })
})
