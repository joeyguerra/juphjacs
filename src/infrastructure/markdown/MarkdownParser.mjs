import MarkdownIt from 'markdown-it'
import yaml from 'js-yaml'

class MarkdownParser {
    constructor(options = {}) {
        this.md = new MarkdownIt({
            html: true,
            linkify: true,
            typographer: true,
            ...options
        })
    }

    async parse(markdown) {
        const { frontmatter, content } = this.extractFrontmatter(markdown)
        const html = this.md.render(content)
        
        return {
            frontmatter,
            html,
            content
        }
    }

    extractFrontmatter(markdown) {
        const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n/
        const match = markdown.match(frontmatterRegex)
        
        if (!match) {
            return {
                frontmatter: {},
                content: markdown
            }
        }

        const frontmatterText = match[1]
        const content = markdown.slice(match[0].length)
        
        let frontmatter = {}
        
        try {
            frontmatter = yaml.load(frontmatterText) || {}
        } catch (e) {
            // If YAML parsing fails, return empty frontmatter
            console.warn('Failed to parse frontmatter:', e.message)
        }
        
        return {
            frontmatter,
            content
        }
    }
}

export { MarkdownParser }
