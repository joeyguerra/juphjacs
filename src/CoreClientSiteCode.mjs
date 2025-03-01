import { join } from 'node:path'
import { createReadStream } from 'node:fs'

class CoreClientSiteCode {
    constructor(pathName, root, req) {
        this.pathName = pathName
        this.filePath = null
        this.root = root
        if (this.pathName == '/js/morphdom-esm.js') {
            this.filePath = join(this.root, 'node_modules/morphdom/dist/morphdom-esm.js')
        } else if (this.pathName == '/js/HotReloader.mjs') {
            this.filePath = join(this.root, 'src/HotReloader.mjs')
        }
        if (this.filePath) {
            this.req = req
            this.stream = createReadStream(this.filePath)
            this.stream.on('finish', () => {
                this.req.destroy()
            })
            this.stream.on('error', e => {
                logger.error(`Error in CoreClientSiteCode: ${e.message}`)
                this.req.destroy()
            })
        }
    }

    pipe(res) {
        if (!this.filePath) return null
        res.setHeader('Content-Type', 'text/javascript')
        res.statusCode = 200
        return this.stream.pipe(res)
    }
}

export { CoreClientSiteCode }