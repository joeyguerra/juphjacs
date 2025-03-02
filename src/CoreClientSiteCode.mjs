import { join } from 'node:path'
import { createReadStream } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'


class CoreClientSiteCode {
    #fileMap = new Map()
    constructor(pathName, root, req, logger) {
        this.pathName = pathName
        this.root = root
        this.req = req
        this.filePath = null
        this.logger = logger

        const moduleDir = dirname(fileURLToPath(import.meta.url))
        const isRunningInModule = moduleDir.includes('node_modules/juphjacs')
        const baseDir = isRunningInModule ? moduleDir : process.cwd()
        this.#fileMap = new Map([
            ['/js/morphdom-esm.js', join(this.root, 'node_modules/morphdom/dist/morphdom-esm.js')],
            ['/js/HotReloader.mjs', join(baseDir.replace(/\/src$/, ''), 'src/HotReloader.mjs')]
        ]) 
        this.filePath = this.#fileMap.get(this.pathName)

        if (this.filePath) {
            this.stream = createReadStream(this.filePath)
            this.setupStreamHandlers()
        }
    }

    setupStreamHandlers() {
        this.stream.on('finish', () => {
            this.req.destroy()
        })
        this.stream.on('error', e => {
            this.logger.error(`Error in CoreClientSiteCode: ${e.message}`)
            this.req.destroy()
        })
    }
    
    pipe(res) {
        if (!this.filePath) return null
        res.setHeader('Content-Type', 'text/javascript')
        res.statusCode = 200
        return this.stream.pipe(res)
    }
}

export { CoreClientSiteCode }