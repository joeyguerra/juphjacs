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
import EventEmitter from 'node:events'

const EVENTS = {
    STATIC_SITE_GENERATED: 'static site generated',
}

class SiteGenerator extends EventEmitter {
    constructor(rootFolder, pagesFolder, siteFolder, filesToCopyOver, foldersToCopyOver) {
        super()
        this.routes = new Set()
        this.layouts = new Map()
        this.localImports = new Map()
        this.rootFolder = rootFolder
        this.pagesFolder = pagesFolder
        this.siteFolder = siteFolder
        this.filesToCopyOver = filesToCopyOver
        this.foldersToCopyOver = foldersToCopyOver
        this.pages = new Map()
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
                this.emit('error', e)
            }
        }
    }
    
    async copyFileFrom(file, destination) {
        try {
            await cp(file, destination, { recursive: true })
        } catch (e) {
            this.emit('error', e)
        }
    }
    
    async generateStaticSite(req, res) {
        try{await mkdir(this.siteFolder)}catch(e){}

        await this.copyFileFrom(join(this.rootFolder, 'node_modules/morphdom/dist/morphdom-esm.js'), join(this.siteFolder, 'morphdom', 'morphdom-esm.js'))
        
        for await (let file of this.filesToCopyOver) {
            await this.copyFileFrom(join(this.pagesFolder, file), join(this.siteFolder, file))
        }

        for await (let folder of this.foldersToCopyOver) {
            try{
                await mkdir(join(this.pagesFolder, folder), { recursive: true })
            } catch (e) {
                this.emit('warn', e)
            }
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
        req.url = `http://newFileName/${relative(this.siteFolder, newFileName)}`
        req.urlParsed = new URL(req.url, `http://${req.headers?.host ?? 'localhost'}`)

        const page = await Page.get(file, this.rootFolder)
        await page.render()
        const keyName = resolve(this.rootFolder, page.layout)
        let key = this.layouts.get(keyName)
        if (!key) {
            this.layouts.set(keyName, new Set())
            key = this.layouts.get(keyName)
        }
        key.add(resolve(this.rootFolder, file))

        const importRegex = /import\s+{[^}]+}\s+from\s+['"]([^'"]+\.mjs)['"]/g
        if (page.content.includes('import') || page.content.includes('require')) {
            let match = null
            while ((match = importRegex.exec(page.content)) !== null) {
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
        if (page.content.includes('<link')) {
            let match = null
            while ((match = cssRegex.exec(page.content)) !== null) {
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
        if (page.content.includes('<script')) {    
            let match = null
            while ((match = scriptRegex.exec(page.content)) !== null) {    
                let keyName = resolve(this.pagesFolder, 'js', match[1].replace(/^\//, ''))
                let key = this.localImports.get(keyName)
                if (!key) {
                    this.localImports.set(keyName, new Set())
                    key = this.localImports.get(keyName)
                }
                key.add(resolve(this.rootFolder, file))
            }
        }
        this.pages.set(newFileName.replace(this.siteFolder, ''), page)
        await writeFile(newFileName, page.content)
        return page
    }
}

export { 
    SiteGenerator,
    EVENTS
}