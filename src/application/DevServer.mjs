import { ConfigLoader } from './config/ConfigLoader.mjs'
import { PluginManager } from './plugins/PluginManager.mjs'
import { SiteGenerator } from './SiteGenerator.mjs'
import { PageRepository } from '../domain/pages/PageRepository.mjs'
import { FileWatcher } from '../infrastructure/hotreload/FileWatcher.mjs'
import { ReloadServer } from '../infrastructure/hotreload/ReloadServer.mjs'
import { FileFilter } from '../infrastructure/FileFilter.mjs'
import { Logger } from '../Logger.mjs'
import { FetchRequest, FetchResponse } from '../infrastructure/http/FetchApi.mjs'
import { join } from 'node:path'
import { createServer } from 'node:http'
import { Server as SocketServer } from 'socket.io'
import pkg from '../../package.json' with { type: 'json' }

class JuphjacsDevelopmentServer {
    constructor(config = {}) {
        this.config = config
        this.rootDir = config.rootDir || process.cwd()
        // Set log level: 'debug', 'info', 'warning', 'error'
        this.logger = new Logger(pkg.name, null, config.logLevel)
        
        // Initialize components
        this.configLoader = new ConfigLoader(this.rootDir)
        this.pluginManager = new PluginManager()
        this.repository = new PageRepository(this.rootDir)
        this.fileFilter = new FileFilter(config.fileFilter || {})
        
        // Server components
        this.httpServer = null
        this.socketServer = null
        this.reloadServer = null
        this.fileWatcher = null
        this.siteGenerator = null
    }

    async initialize() {
        // Load configuration
        const siteConfig = await this.configLoader.load()
        
        this.logger.info('Initializing Juphjacs Development Server...')
        this.logger.info(`Pages folder: ${siteConfig.sourceFolder}`)
        this.logger.info(`Build folder: ${siteConfig.buildFolder}`)
        
        // Initialize site generator
        this.siteGenerator = new SiteGenerator(
            {
                sourceFolder: siteConfig.sourceFolder,
                buildFolder: siteConfig.buildFolder,
                resources: siteConfig.resources || []
            },
            this.pluginManager,
            this.repository
        )

        // Register plugins from config
        if (siteConfig.plugins && siteConfig.plugins.length > 0) {
            this.logger.info(`Loading ${siteConfig.plugins.length} plugins...`)
            for (const pluginConfig of siteConfig.plugins) {
                try {
                    const pluginModule = await import(pluginConfig.path)
                    const Plugin = pluginModule[pluginConfig.name] || pluginModule.default
                    const plugin = new Plugin(pluginConfig.options || {})
                    this.pluginManager.register(plugin)
                    this.logger.info(`  ✓ Loaded plugin: ${plugin.name}`)
                } catch (error) {
                    this.logger.error(`  ✗ Failed to load plugin ${pluginConfig.name}: ${error.message}`)
                }
            }
        }

        // Initialize site generator
        await this.siteGenerator.initialize()

        // Initial build
        this.logger.info('Building site...')
        await this.siteGenerator.build()
        this.logger.info('✓ Site built successfully')

        return this
    }

    async startDevServer(port = 3000) {
        // Create HTTP server with FetchApi for modern request/response handling
        this.httpServer = createServer({
            IncomingMessage: FetchRequest,
            ServerResponse: FetchResponse
        }, async (req, res) => {
            await this.handleRequest(req, res)
        })

        // Create Socket.IO server
        this.socketServer = new SocketServer(this.httpServer)
        
        // Create reload server
        this.reloadServer = new ReloadServer(this.socketServer)
        
        this.reloadServer.on('connection', (clientId) => {
            this.logger.info(`Client connected: ${clientId}`)
        })

        this.reloadServer.on('disconnect', (clientId) => {
            this.logger.info(`Client disconnected: ${clientId}`)
        })

        // Start file watcher
        const siteConfig = await this.configLoader.load()
        this.fileWatcher = new FileWatcher(siteConfig.sourceFolder, {
            ignore: this.fileFilter.ignorePatterns,
            debounce: 300
        })

        this.fileWatcher.on('change', async ({ filePath, stats }) => {
            await this.handleFileChange('change', filePath, stats)
        })

        this.fileWatcher.on('add', async ({ filePath, stats }) => {
            await this.handleFileChange('add', filePath, stats)
        })

        this.fileWatcher.on('unlink', async ({ filePath }) => {
            this.logger.info(`File deleted: ${filePath}`)
            // Could implement page deletion here
        })

        // Start watching for file changes
        await this.fileWatcher.watch()

        // Start HTTP server
        await new Promise((resolve) => {
            this.httpServer.listen(port, () => {
                this.logger.info(`🚀 Server running at http://localhost:${port}/`)
                this.logger.info(`👀 Watching for changes in ${siteConfig.sourceFolder}`)
                resolve()
            })
        })

        return this
    }

    async handleFileChange(event, filePath, stats) {
        this.logger.info(`File ${event}: ${filePath}`)

        // Check if file should be processed
        if (!this.fileFilter.shouldProcess(filePath)) {
            this.logger.debug(`Skipping: ${filePath}`)
            return
        }

        try {
            // Rebuild the changed file
            await this.siteGenerator.buildFile(filePath)

            // Get the page from repository
            const page = this.repository.findByFilePath(filePath)
            
            if (page) {
                // Notify connected clients
                if (this.fileFilter.getFileType(filePath) === 'css') {
                    // CSS-only reload (no page refresh)
                    this.reloadServer.broadcastCssReload(page.route)
                } else {
                    // For HTML/JS/other files, broadcast to all clients
                    // This ensures reload works even if referer doesn't exactly match
                    this.reloadServer.broadcast('reload', { 
                        route: page.route, 
                        filePath 
                    })
                }
                
                this.logger.info(`✓ Rebuilt and reloaded: ${page.route}`)
            } else {
                // No page found, but file was rebuilt - broadcast to all
                this.logger.info(`✓ Rebuilt: ${filePath}`)
                this.reloadServer.broadcast('reload', { filePath })
            }
        } catch (error) {
            this.logger.error(`Error rebuilding ${filePath}: ${error.message}`)
            this.reloadServer.broadcast('error', { message: error.message, filePath })
        }
    }

    async handleRequest(req, res) {
        const url = new URL(req.url, `http://${req.headers.host}`)
        
        this.logger.debug(`${req.method} ${url.pathname}`)

        // Intercept framework resources (served from juphjacs itself)
        if (url.pathname.startsWith('/__juphjacs__/')) {
            return await this.serveFrameworkResource(url.pathname, res)
        }

        // Serve files from build directory
        const filePath = url.pathname === '/' ? '/index.html' : url.pathname
        const fullPath = join(await this.configLoader.load().then(c => c.buildFolder), filePath)

        try {
            const { readFile } = await import('node:fs/promises')
            const content = await readFile(fullPath, 'utf-8')
            
            // Inject hot-reload script for HTML files (only if not already present)
            if (filePath.endsWith('.html')) {
                // Check if HotReloader is already included
                const hasHotReloader = content.includes('HotReloader') || content.includes('io(\'/hot-reload\')')
                
                let modifiedContent = content
                
                if (!hasHotReloader) {
                    // Inject hot-reload script with DOM morphing
                    const hotReloadScript = `
<script src="/socket.io/socket.io.js"></script>
<script type="module">
  import { HotReloader } from '/__juphjacs__/HotReloader.mjs'
  const socket = io('/hot-reload')
  const reloader = new HotReloader(window, socket)
</script>
</body>`
                    modifiedContent = content.replace('</body>', hotReloadScript)
                }
                
                res.setHeader('Content-Type', 'text/html')
                res.writeHead(200)
                res.end(modifiedContent)
            } else {
                // Determine content type
                const ext = filePath.split('.').pop()
                const contentTypes = {
                    'css': 'text/css',
                    'js': 'application/javascript',
                    'mjs': 'application/javascript',
                    'json': 'application/json',
                    'png': 'image/png',
                    'jpg': 'image/jpeg',
                    'svg': 'image/svg+xml',
                    'ico': 'image/x-icon'
                }
                
                res.setHeader('Content-Type', contentTypes[ext] || 'text/plain')
                res.writeHead(200)
                res.end(content)
            }
        } catch (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html' })
                res.end('<h1>404 Not Found</h1>')
            } else {
                this.logger.error(`Error serving ${url.pathname}: ${error.message}`)
                res.writeHead(500, { 'Content-Type': 'text/html' })
                res.end('<h1>500 Internal Server Error</h1>')
            }
        }
    }

    async serveFrameworkResource(pathname, res) {
        // Remove /__juphjacs__/ prefix
        const resourcePath = pathname.replace('/__juphjacs__/', '')
        
        try {
            const { readFile } = await import('node:fs/promises')
            const { fileURLToPath } = await import('node:url')
            const { dirname, join } = await import('node:path')
            
            // Get framework's root directory
            const frameworkRoot = dirname(fileURLToPath(import.meta.url))
            const resourceFile = join(frameworkRoot, '..', 'infrastructure', 'hotreload', resourcePath)
            
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
        } catch (error) {
            this.logger.error(`Error serving framework resource ${pathname}: ${error.message}`)
            res.writeHead(404, { 'Content-Type': 'text/plain' })
            res.end('Framework resource not found')
        }
    }

    async stop() {
        this.logger.info('Stopping server...')

        if (this.fileWatcher) {
            this.fileWatcher.close()
        }

        if (this.reloadServer) {
            this.reloadServer.close()
        }

        if (this.httpServer) {
            await new Promise((resolve) => {
                this.httpServer.close(resolve)
            })
        }

        this.logger.info('✓ Server stopped')
    }
}

// CLI entry point
async function startServer() {
    const server = new JuphjacsDevelopmentServer({
        logLevel: process.env.LOG_LEVEL || 'info'
    })

    try {
        await server.initialize()
        await server.startDevServer(process.env.PORT || 3000)
        console.log(`✓ Server started successfully http://localhost:${process.env.PORT || 3000}`)
        console.log('Press Ctrl+C to stop the server')
    } catch (error) {
        console.error('Failed to start server:', error)
        process.exit(1)
    }

    // Graceful shutdown
    const shutdown = async () => {
        console.log('\nShutting down gracefully...')
        await server.stop()
        process.exit(0)
    }

    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)
}

export { JuphjacsDevelopmentServer, startServer }
