import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'

class StaticAssetHandler {
    constructor(options = {}) {
        this.buildFolder = options.buildFolder
        
        // MIME type mappings
        this.contentTypes = {
            // Text
            'css': 'text/css',
            'txt': 'text/plain',
            'xml': 'application/xml',
            'csv': 'text/csv',
            
            // JavaScript
            'js': 'application/javascript',
            'mjs': 'application/javascript',
            'json': 'application/json',
            
            // Images
            'png': 'image/png',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'gif': 'image/gif',
            'webp': 'image/webp',
            'svg': 'image/svg+xml',
            'ico': 'image/x-icon',
            'bmp': 'image/bmp',
            'tiff': 'image/tiff',
            'tif': 'image/tiff',
            
            // Fonts
            'woff': 'font/woff',
            'woff2': 'font/woff2',
            'ttf': 'font/ttf',
            'otf': 'font/otf',
            'eot': 'application/vnd.ms-fontobject',
            
            // Video
            'mp4': 'video/mp4',
            'webm': 'video/webm',
            'ogg': 'video/ogg',
            
            // Audio
            'mp3': 'audio/mpeg',
            'wav': 'audio/wav',
            
            // Documents
            'pdf': 'application/pdf',
            'zip': 'application/zip',
            'tar': 'application/x-tar',
            'gz': 'application/gzip'
        }
        
        // Text file extensions
        this.textExtensions = ['css', 'txt', 'xml', 'csv', 'js', 'mjs', 'json', 'svg']
    }

    getContentType(ext) {
        return this.contentTypes[ext] || 'application/octet-stream'
    }

    async handle(req, res) {
        const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
        const filePath = url.pathname
        
        // Don't handle HTML files (those are handled by StaticPageHandler)
        if (filePath.endsWith('.html') || filePath.endsWith('/') || filePath === '/') {
            return false
        }
        
        const fullPath = join(this.buildFolder, filePath)
        
        try {
            // Check if path is a directory
            const stats = await stat(fullPath)
            if (stats.isDirectory()) {
                // Let StaticPageHandler handle directory -> index.html resolution
                return false
            }
            
            // Determine file type
            const ext = filePath.split('.').pop().toLowerCase()
            const isText = this.textExtensions.includes(ext)
            
            // Read file with appropriate encoding
            const content = isText 
                ? await readFile(fullPath, 'utf-8')
                : await readFile(fullPath)
            
            // Set content type and send response
            const contentType = this.getContentType(ext)
            res.setHeader('Content-Type', contentType)
            res.writeHead(200)
            res.end(content)
            
            return true
        } catch (error) {
            // File doesn't exist - let ErrorHandler deal with it
            if (error.code === 'ENOENT') {
                return false
            }
            // Directory operation errors - let another handler deal with it
            if (error.code === 'EISDIR') {
                return false
            }
            // Other errors - rethrow
            throw error
        }
    }
}

export { StaticAssetHandler }
