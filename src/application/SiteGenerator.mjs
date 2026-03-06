import { dirname, extname, join, relative, resolve, sep } from 'node:path'
import { opendir, mkdir, readFile, writeFile, cp, stat, rename, unlink } from 'node:fs/promises'
import EventEmitter from 'node:events'
import { pathToFileURL } from 'node:url'
import { Page } from '../domain/pages/Page.mjs'
import { MarkdownParser } from '../infrastructure/markdown/MarkdownParser.mjs'
import { TemplateEngine } from '../infrastructure/templates/TemplateEngine.mjs'

const EVENTS = {
    BUILD_START: 'build:start',
    BUILD_COMPLETE: 'build:complete',
    BUILD_ERROR: 'build:error',
    PAGE_PROCESSED: 'page:processed',
    PAGE_SKIPPED: 'page:skipped',
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
                const renderedPage = await this.renderPage(page)
                if (!renderedPage) {
                    continue
                }
                await this.pluginManager.executeHook('onPageRendered', renderedPage)
            }
            
            // Build complete
            await this.pluginManager.executeHook('onBuildComplete', {
                config: this.config,
                repository: this.repository,
                pages: transformedPages || pages
            })
            
            this.emit(EVENTS.BUILD_COMPLETE)
        } catch (error) {
            this.emitBuildError({ stage: 'build', error })
            throw error
        }
    }

    async buildFile(filePath) {
        try {
            const buildTargetPath = await this.resolveBuildTargetPath(filePath)
            if (!buildTargetPath) {
                return null
            }

            const page = await this.loadPage(buildTargetPath)
            if (!page) return null
            // Get all pages from repository for plugin processing
            const allPages = this.repository.all()
            
            // Run plugin hooks to ensure context (like blog posts) is available
            await this.pluginManager.executeHook('onContentLoaded', allPages)
            await this.pluginManager.executeHook('onPagePreRendered', page)
            const renderedPage = await this.renderPage(page)
            if (!renderedPage) {
                return null
            }
            await this.pluginManager.executeHook('onPageRendered', renderedPage)
            
            return renderedPage
        } catch (error) {
            this.emitBuildError({ stage: 'build:file', filePath, error })
            return null
        }
    }

    async copyResourceFile(filePath) {
        const relativePath = relative(this.config.sourceFolder, filePath)
        if (!relativePath || relativePath.startsWith(`..${sep}`) || relativePath === '..') {
            return null
        }

        const resourceFolder = this.config.resources?.find(folder => {
            return relativePath === folder || relativePath.startsWith(`${folder}${sep}`)
        })
        if (!resourceFolder) {
            return null
        }

        const destinationPath = join(this.config.buildFolder, relativePath)

        try {
            await mkdir(dirname(destinationPath), { recursive: true })
            await cp(filePath, destinationPath)
            return {
                filePath,
                destinationPath,
                relativePath,
                resourceFolder
            }
        } catch (error) {
            this.emitBuildError({ stage: 'copy:resource:file', filePath, resourceFolder, error })
            return null
        }
    }

    async resolveBuildTargetPath(filePath) {
        const ext = extname(filePath).toLowerCase()
        const templateExtensions = ['.html', '.xml', '.md']

        if (templateExtensions.includes(ext)) {
            return filePath
        }

        if (ext !== '.mjs') {
            return null
        }

        const basePath = filePath.slice(0, -ext.length)
        const candidates = templateExtensions.map((templateExt) => `${basePath}${templateExt}`)

        for (const candidate of candidates) {
            try {
                const stats = await stat(candidate)
                if (!stats.isDirectory()) {
                    return candidate
                }
            } catch {
                // Candidate template does not exist; continue searching.
            }
        }

        return null
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
                    this.emitBuildError({ stage: 'copy:resource', resourceFolder, error })
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
                this.emitBuildError({ stage: 'copy:dist', entry, error })
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
                    const moduleUrl = pathToFileURL(mjsPath)
                    moduleUrl.searchParams.set('t', `${Math.floor(stats.mtimeMs)}`)
                    const module = await import(moduleUrl.href)
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
            this.emitBuildError({ stage: 'load:page', filePath, error })
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
            
            // Write rendered content atomically to preserve last-known-good output on failure
            await this.writeFileAtomic(outputPath, page.content)
            
            this.emit(EVENTS.PAGE_PROCESSED, page)
            
            return page
        } catch (error) {
            if (error.code === 'TEMPLATE_TOO_LARGE') {
                this.emit(EVENTS.PAGE_SKIPPED, {
                    page: page.filePath,
                    reason: error.message,
                    code: error.code
                })
                return null
            }
            this.emitBuildError({ stage: 'render:page', page: page.filePath, error })
            this.emit(EVENTS.PAGE_SKIPPED, {
                page: page.filePath,
                reason: error.message
            })
            return null
        }
    }

    async writeFileAtomic(outputPath, content) {
        const tempPath = `${outputPath}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`
        try {
            await writeFile(tempPath, content)
            await rename(tempPath, outputPath)
        } catch (error) {
            try {
                await unlink(tempPath)
            } catch {
                // Ignore cleanup errors for temp files.
            }
            throw error
        }
    }

    emitBuildError(payload) {
        this.emit(EVENTS.BUILD_ERROR, payload)
        if (this.listenerCount(EVENTS.ERROR) > 0) {
            this.emit(EVENTS.ERROR, payload)
        }
    }
}

export { SiteGenerator, EVENTS }
