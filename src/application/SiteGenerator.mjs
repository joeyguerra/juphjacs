import { dirname, extname, join, resolve } from 'node:path'
import { opendir, mkdir, readFile, writeFile, cp, stat } from 'node:fs/promises'
import EventEmitter from 'node:events'
import { Page } from '../domain/pages/Page.mjs'
import { MarkdownParser } from '../infrastructure/markdown/MarkdownParser.mjs'
import { TemplateEngine } from '../infrastructure/templates/TemplateEngine.mjs'

const EVENTS = {
    BUILD_START: 'build:start',
    BUILD_COMPLETE: 'build:complete',
    PAGE_PROCESSED: 'page:processed',
    ERROR: 'error'
}

class SiteGenerator extends EventEmitter {
    constructor(config, pluginManager, repository) {
        super()
        this.config = config
        this.pluginManager = pluginManager
        this.repository = repository
        this.markdownParser = new MarkdownParser()
        this.templateEngine = new TemplateEngine()
        this.layouts = new Map()
        this.isInitialized = false
    }

    async initialize() {
        if (this.isInitialized) return
        
        // Trigger plugin initialization
        await this.pluginManager.executeHook('onInit')
        
        this.isInitialized = true
    }

    async build() {
        try {
            this.emit(EVENTS.BUILD_START)
            
            // Ensure build directory exists
            await mkdir(this.config.buildFolder, { recursive: true })
            
            // Copy resource folders
            await this.copyResources()

            // Copy dist files and folders
            await this.copyDistFilesAndFolders()
            
            // Discover and load all pages
            const pages = await this.discoverPages()
            
            // Allow plugins to transform pages
            const transformedPages = await this.pluginManager.executeHook('onContentLoaded', pages)
            
            // Render each page
            for (const page of transformedPages || pages) {
                await this.pluginManager.executeHook('onPagePreRendered', page)
                await this.renderPage(page)
                await this.pluginManager.executeHook('onPageRendered', page)
            }
            
            // Build complete
            await this.pluginManager.executeHook('onBuildComplete', {
                config: this.config,
                repository: this.repository,
                pages: transformedPages || pages
            })
            
            this.emit(EVENTS.BUILD_COMPLETE)
        } catch (error) {
            this.emit(EVENTS.ERROR, error)
            throw error
        }
    }

    async buildFile(filePath) {
        try {
            const page = await this.loadPage(filePath)
            if (!page) return
            // Get all pages from repository for plugin processing
            const allPages = this.repository.all()
            
            // Run plugin hooks to ensure context (like blog posts) is available
            await this.pluginManager.executeHook('onContentLoaded', allPages)
            await this.pluginManager.executeHook('onPagePreRendered', page)
            await this.renderPage(page)
            await this.pluginManager.executeHook('onPageRendered', page)
            
            return page
        } catch (error) {
            this.emit(EVENTS.ERROR, { filePath, error })
            throw error
        }
    }

    async copyResources() {
        if (!this.config.resources) return
        
        for (const resourceFolder of this.config.resources) {
            const sourcePath = join(this.config.sourceFolder, resourceFolder)
            const destPath = join(this.config.buildFolder, resourceFolder)
            
            try {
                await mkdir(destPath, { recursive: true })
                await cp(sourcePath, destPath, { recursive: true })
            } catch (error) {
                if (error.code !== 'ENOENT') {
                    this.emit(EVENTS.ERROR, { resourceFolder, error })
                }
            }
        }
    }

    async copyDistFilesAndFolders() {
        if (!this.config.dist) return
        
        for (const entry of this.config.dist) {
            const fromPath = resolve(entry.from)
            const toPath = resolve(this.config.buildFolder, entry.to)
            const toDir = dirname(toPath)
            
            try {
                await mkdir(toDir, { recursive: true })
                await cp(fromPath, toPath, { recursive: true })
            } catch (error) {
                this.emit(EVENTS.ERROR, { entry, error })
            }
        }
    }

    async *readAllFiles(folder) {
        try {
            const dir = await opendir(folder)
            for await (const dirent of dir) {
                const entryPath = join(folder, dirent.name)
                if (dirent.isDirectory()) {
                    yield* this.readAllFiles(entryPath)
                } else {
                    yield entryPath
                }
            }
        } catch (error) {
            // Directory doesn't exist or can't be read
        }
    }

    async discoverPages() {
        const pages = []
        
        for await (const filePath of this.readAllFiles(this.config.sourceFolder)) {
            // Skip layout files
            if (filePath.includes('layout')) continue
            
            const ext = extname(filePath)
            
            // Only process HTML, XML, and MD files
            if (!['.html', '.xml', '.md'].includes(ext)) continue
            
            const page = await this.loadPage(filePath)
            if (page) {
                pages.push(page)
            }
        }
        
        return pages
    }

    async loadPage(filePath) {
        try {
            const template = await readFile(filePath, 'utf-8')
            const ext = extname(filePath)
            
            // Try to load page controller (.mjs file)
            const mjsPath = filePath.replace(/\.(html|xml|md)$/, '.mjs')
            let page = null
            
            try {
                const stats = await stat(mjsPath)
                if (!stats.isDirectory()) {
                    const module = await import(`file://${mjsPath}`)
                    page = await module.default(this.config.sourceFolder, filePath, template, {
                        templateSecurity: this.config.templateSecurity
                    })
                }
            } catch (error) {
                // No controller, create basic page
                page = new Page(this.config.sourceFolder, filePath, template, {
                    templateSecurity: this.config.templateSecurity
                })
            }
            
            // Process markdown files
            if (ext === '.md') {
                const parsed = await this.markdownParser.parse(template)
                
                // Apply frontmatter to page
                Object.assign(page, parsed.frontmatter)
                
                // Update template to rendered HTML
                page.template = parsed.html
                page.sourceTemplate = template
            }
            
            // Store in repository
            this.repository.save(page)
            
            return page
        } catch (error) {
            this.emit(EVENTS.ERROR, { filePath, error })
            return null
        }
    }

    async renderPage(page) {
        try {
            // Render the page
            await page.render()
            
            // Determine output path
            let outputPath = page.filePath
                .replace(this.config.sourceFolder, this.config.buildFolder)
                .replace('.md', '.html')
            
            // Ensure output directory exists
            await mkdir(dirname(outputPath), { recursive: true })
            
            // Write rendered content
            await writeFile(outputPath, page.content)
            
            this.emit(EVENTS.PAGE_PROCESSED, page)
            
            return page
        } catch (error) {
            this.emit(EVENTS.ERROR, { page: page.filePath, error })
            throw error
        }
    }
}

export { SiteGenerator, EVENTS }
