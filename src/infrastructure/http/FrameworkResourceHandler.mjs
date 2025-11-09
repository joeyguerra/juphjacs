import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

class FrameworkResourceHandler {
    constructor(options = {}) {
        this.frameworkRoot = options.frameworkRoot || dirname(fileURLToPath(import.meta.url))
    }

    async handle(req, res) {
        const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
        
        // Only handle framework resource requests
        if (!url.pathname.startsWith('/__juphjacs__/')) {
            return false
        }
        
        // Remove /__juphjacs__/ prefix
        const resourcePath = url.pathname.replace('/__juphjacs__/', '')
        
        try {
            // Get framework resource file path
            const resourceFile = join(this.frameworkRoot, '..', 'infrastructure', 'hotreload', resourcePath)
            
            const content = await readFile(resourceFile, 'utf-8')
            
            // Determine content type
            const ext = resourcePath.split('.').pop()
            const contentTypes = {
                'mjs': 'application/javascript',
                'js': 'application/javascript',
                'css': 'text/css'
            }
            
            res.setHeader('Content-Type', contentTypes[ext] || 'text/plain')
            res.writeHead(200)
            res.end(content)
            
            return true
        } catch (error) {
            res.writeHead(404, { 'Content-Type': 'text/plain' })
            res.end('Framework resource not found')
            return true
        }
    }
}

export { FrameworkResourceHandler }
