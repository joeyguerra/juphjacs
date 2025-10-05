import { minimatch } from 'minimatch'

class FileFilter {
    constructor(config = {}) {
        this.config = {
            ignore: [],
            include: [],
            layoutPatterns: ['**/layout.html', '**/_layout.html'],
            ...config
        }

        // Default ignore patterns
        this.defaultIgnorePatterns = [
            '**/node_modules/**',
            '**/.git/**',
            '**/.DS_Store',
            '**/.env',
            '**/.env.*',
            '**/.vscode/**',
            '**/.idea/**',
            '**/_site/**',
            '**/dist/**',
            '**/build/**',
            '**/package-lock.json',
            '**/yarn.lock',
            '**/pnpm-lock.yaml',
            '**/*.log',
            '**/npm-debug.log*'
        ]

        // Combine default and custom ignore patterns
        this.ignorePatterns = [...this.defaultIgnorePatterns, ...this.config.ignore]
        this.includePatterns = this.config.include
        this.layoutPatterns = this.config.layoutPatterns
    }

    shouldProcess(filePath) {
        const normalizedPath = filePath.replace(/\\/g, '/')

        // If include patterns are specified, file must match at least one
        if (this.includePatterns.length > 0) {
            const included = this.includePatterns.some(pattern =>
                minimatch(normalizedPath, pattern)
            )
            if (!included) return false
        }

        // Check if file matches any ignore pattern
        const ignored = this.ignorePatterns.some(pattern =>
            minimatch(normalizedPath, pattern)
        )

        return !ignored
    }

    getFileType(filePath) {
        const ext = filePath.split('.').pop().toLowerCase()

        const typeMap = {
            html: 'html',
            htm: 'html',
            md: 'markdown',
            markdown: 'markdown',
            js: 'javascript',
            mjs: 'javascript',
            cjs: 'javascript',
            css: 'css',
            xml: 'xml',
            rss: 'xml',
            atom: 'xml',
            png: 'asset',
            jpg: 'asset',
            jpeg: 'asset',
            gif: 'asset',
            svg: 'asset',
            webp: 'asset',
            ico: 'asset',
            woff: 'asset',
            woff2: 'asset',
            ttf: 'asset',
            eot: 'asset',
            otf: 'asset',
            mp4: 'asset',
            webm: 'asset',
            mp3: 'asset',
            wav: 'asset',
            pdf: 'asset',
            zip: 'asset',
            json: 'data'
        }

        return typeMap[ext] || 'unknown'
    }

    needsTemplateRendering(filePath) {
        const type = this.getFileType(filePath)
        return type === 'html' || type === 'markdown'
    }

    needsMarkdownProcessing(filePath) {
        const type = this.getFileType(filePath)
        return type === 'markdown'
    }

    shouldCopyAsIs(filePath) {
        const type = this.getFileType(filePath)
        return type === 'asset' || type === 'data'
    }

    isLayoutFile(filePath) {
        const normalizedPath = filePath.replace(/\\/g, '/')
        
        return this.layoutPatterns.some(pattern =>
            minimatch(normalizedPath, pattern)
        )
    }
}

export { FileFilter }
