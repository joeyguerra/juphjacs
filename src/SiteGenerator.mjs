import { fileURLToPath } from 'node:url'
import { dirname, extname, join, relative, resolve } from 'node:path'
import { opendir, mkdir, readFile, writeFile, cp } from 'node:fs/promises'
import MarkdownIt from 'markdown-it'
import { TemplateLiteralRenderer } from './TemplateLiteralRenderer.mjs'
import { MarkdownRenderer } from './MarkdownRenderer.mjs'
import { XmlRenderer } from './XmlRenderer.mjs'
import { TemplateRendererFactory } from './TemplateRendererFactory.mjs'
import { Page } from './Page.mjs'
import { RequestParams } from './RequestParams.mjs'
import { UriToStaticFileRoute } from './UriToStaticFileRoute.mjs'

const EVENTS = {
    TEMPLATE_RENDERED: 'template rendered',
    STATIC_SITE_GENERATED: 'static site generated',
    PRE_TEMPLATE_RENDER: 'pre template render'
}

class SiteGenerator {
    constructor(rootFolder, pagesFolder, siteFolder, filesToCopyOver, foldersToCopyOver) {
        this.routes = new Set()
        this.layouts = new Map()
        this.localImports = new Map()
        this.rootFolder = rootFolder
        this.pagesFolder = pagesFolder
        this.siteFolder = siteFolder
        this.filesToCopyOver = filesToCopyOver
        this.foldersToCopyOver = foldersToCopyOver
    }

    async * readAllFiles (folder) {
        const dir = await opendir(folder);
        for await (const dirent of dir) {
            const entryPath = join(folder, dirent.name);
            if (dirent.isDirectory()) {
                yield* this.readAllFiles(entryPath)
            } else {
                yield entryPath
            }
        }
    }
    async copyFoldersFrom(source, destination) {
        const dir = await opendir(source)
        for await (let folder of dir) {
            try {
                await this.copyFileFrom(join(folder.parentPath, folder.name), join(destination, folder.name))
            } catch (e) {
                logger.error({error: e, message: 'error copying folders from'}, 'copyFoldersFrom')
            }
        }
    }
    
    async copyFileFrom(file, destination) {
        try {
            await cp(file, destination, { recursive: true })
        } catch (e) {
            logger.error(e, 'error - copyFileFrom')
        }
    }
    
    async generateStaticSite(req, res) {
        try{await mkdir(this.siteFolder)}catch(e){}

        await this.copyFileFrom(join(this.rootFolder, 'node_modules/morphdom/dist/morphdom-esm.js'), join(this.siteFolder, 'morphdom', 'morphdom-esm.js'))
        
        for await (let file of this.filesToCopyOver) {
            await this.copyFileFrom(join(this.pagesFolder, file), join(this.siteFolder, file))
        }

        for await (let folder of this.foldersToCopyOver) {
            await this.copyFoldersFrom(join(this.pagesFolder, folder), join(this.siteFolder, folder))
        }

        for await (const file of this.readAllFiles(this.pagesFolder)) {
            let ext = extname(file)
            await this.genFile(file, req, res)
        }
        process.emit(EVENTS.STATIC_SITE_GENERATED, this.routes, this.layouts)
    }

    async genFile(file, req, res) {
        // TODO: This strategy is not robust. It might need to be improved.
        if (file.includes('layout')) return
        let ext = extname(file)
        if (!['.md', '.html', '.xml'].includes(ext)) return
        let newFileName = file.replace('.md', '.html').replace(this.pagesFolder, this.siteFolder)
        await mkdir(dirname(newFileName), { recursive: true })

        req.url = `http://localhost/${relative(this.siteFolder, newFileName)}`
        req.urlParsed = new URL(req.url)
        req.params = new RequestParams(new URL(req.url), null)

        const page = await this.renderPage(file, { req, res })
        const importRegex = /import\s+{[^}]+}\s+from\s+['"]([^'"]+\.mjs)['"]/g
        if (page.output.includes('import') || page.output.includes('require')) {
            let match = null
            while ((match = importRegex.exec(page.output)) !== null) {
                let keyName = resolve(this.pagesFolder, match[1].replace(/^\//, ''))
                let key = this.localImports.get(keyName)
                if (!key) {
                    this.localImports.set(keyName, new Set())
                    key = this.localImports.get(keyName)
                }
                key.add(resolve(this.rootFolder, file))
            }
        }

        const cssRegex = /<link[^>]+href="(?!http|https)([^"]+\.css)"[^>]*>/g
        if (page.output.includes('<link')) {
            let match = null
            while ((match = cssRegex.exec(page.output)) !== null) {
                let keyName = resolve(this.pagesFolder, 'css', match[1].replace(/^\//, ''))
                let key = this.localImports.get(keyName)
                if (!key) {
                    this.localImports.set(keyName, new Set())
                    key = this.localImports.get(keyName)
                }
                key.add(resolve(this.rootFolder, file))
            }
        }

        const scriptRegex = /<script[^>]+src="(?!http|https)([^"]+)"[^>]*><\/script>/g
        if (page.output.includes('<script')) {    
            let match = null
            while ((match = scriptRegex.exec(page.output)) !== null) {    
                let keyName = resolve(this.pagesFolder, 'js', match[1].replace(/^\//, ''))
                let key = this.localImports.get(keyName)
                if (!key) {
                    this.localImports.set(keyName, new Set())
                    key = this.localImports.get(keyName)
                }
                key.add(resolve(this.rootFolder, file))
            }
        }
        await writeFile(newFileName, page.output)
        return page
    }

    async renderPage(filePath, initialContext = {}) {
        let ext = extname(filePath)
        const rootFolder = dirname(filePath)
        let content = await readFile(filePath, 'utf-8')
        const templateRendererFactory = new TemplateRendererFactory(extname, [
            new MarkdownRenderer(resolve, readFile, new MarkdownIt({
                html: true,
                linkify: true,
                typographer: true
            })),
            new TemplateLiteralRenderer(resolve, readFile),
            new XmlRenderer(resolve, readFile)
        ])
        const page = new Page(rootFolder, filePath, content, templateRendererFactory)
        process.emit(EVENTS.PRE_TEMPLATE_RENDER, filePath, initialContext, content)
        const template = await page.render(initialContext)
        if (page.route) {
            this.routes.add(new UriToStaticFileRoute(page.route, resolve(this.rootFolder, filePath)))
        }
        if (page.layout) {
            let keyName = resolve(this.rootFolder, page.layout)
            let key = this.layouts.get(keyName)
            if (!key) {
                this.layouts.set(keyName, new Set())
                key = this.layouts.get(keyName)
            }
            key.add(resolve(this.rootFolder, filePath))
        }
        if (page.init ) {
            page.init()
        }
        process.emit(EVENTS.TEMPLATE_RENDERED, filePath, page.context, page.output)
        return page
    }
}

export { 
    SiteGenerator,
    EVENTS
}