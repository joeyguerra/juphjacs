import { join } from 'node:path'
import { createReadStream } from 'node:fs'

class CoreClientSiteCode {
    #fileMap = new Map()
    constructor(pathName, root, req) {
        this.pathName = pathName
        this.root = root
        this.req = req
        this.filePath = null
        this.#fileMap = new Map([
            ['/js/morphdom-esm.js', join(this.root, 'node_modules/morphdom/dist/morphdom-esm.js')],
            ['/js/HotReloader.mjs', join(this.root, 'src/HotReloader.mjs')]
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
            logger.error(`Error in CoreClientSiteCode: ${e.message}`)
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