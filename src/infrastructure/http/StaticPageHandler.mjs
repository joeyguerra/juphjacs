import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'

class StaticPageHandler {
    constructor(options = {}) {
        this.buildFolder = options.buildFolder
    }

    async handle(req, res) {
        const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
        let filePath = url.pathname
        
        // Only handle HTML files (or paths that might resolve to HTML)
        if (!filePath.endsWith('.html') && !filePath.endsWith('/') && filePath !== '/') {
            // Check if it's a directory that should resolve to index.html
            const fullPath = join(this.buildFolder, filePath)
            try {
                const stats = await stat(fullPath)
                if (!stats.isDirectory()) {
                    return false
                }
                // It's a directory, append /index.html
                filePath = filePath + '/index.html'
            } catch {
                // Not a directory or doesn't exist
                return false
            }
        } else {
            // Resolve root and directory paths to index.html
            if (filePath === '/' || filePath.endsWith('/')) {
                filePath = filePath === '/' ? '/index.html' : filePath + 'index.html'
            }
        }
        
        const fullPath = join(this.buildFolder, filePath)
        
        try {
            // Try to read the file
            const content = await readFile(fullPath, 'utf-8')
            
            // Inject hot-reload script if not already present
            const hasHotReloader = content.includes('HotReloader') || content.includes('io(\'/hot-reload\')')
            
            let modifiedContent = content
            
            if (!hasHotReloader) {
                // Inject hot-reload script with DOM morphing
                                const hotReloadScript = `
<script src="/socket.io/socket.io.js"></script>
<script type="module">
  import { HotReloader } from '/__juphjacs__/HotReloader.mjs'
    const socket = io('/hot-reload', {
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 500,
        reconnectionDelayMax: 2000,
        timeout: 10000
    })
  const reloader = new HotReloader(window, socket)
</script>
</body>`
                modifiedContent = content.replace('</body>', hotReloadScript)
            }
            
            res.setHeader('Content-Type', 'text/html')
            res.writeHead(200)
            res.end(modifiedContent)
            
            return true
        } catch (error) {
            // File doesn't exist - let another handler deal with it
            if (error.code === 'ENOENT') {
                return false
            }
            // Other errors - rethrow
            throw error
        }
    }
}

export { StaticPageHandler }
