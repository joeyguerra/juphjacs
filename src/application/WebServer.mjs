import { ConfigLoader } from './config/ConfigLoader.mjs'
import { PluginManager } from './plugins/PluginManager.mjs'
import { SiteGenerator } from './SiteGenerator.mjs'
import { PageRepository } from '../domain/pages/PageRepository.mjs'
import { EVENTS as PageEvents } from '../domain/pages/Page.mjs'
import { HotReloadInjector } from '../infrastructure/http/HotReloadInjector.mjs'
import { FileWatcher } from '../infrastructure/hotreload/FileWatcher.mjs'
import { HotReloadSocketServer } from '../infrastructure/hotreload/HotReloadSocketServer.mjs'
import { HotReloadEvent } from '../infrastructure/hotreload/HotReloadEvent.mjs'
import { AssetPolicy, HmrStrategy, AssetType } from '../policy/AssetPolicy.mjs'
import { PathPolicy } from '../policy/PathPolicy.mjs'
import { Logger } from '../Logger.mjs'
import { FetchRequest, FetchResponse } from '../infrastructure/http/FetchApi.mjs'
import { RequestHandlerChain } from '../infrastructure/http/RequestHandlerChain.mjs'
import { DynamicPageHandler } from '../infrastructure/http/DynamicPageHandler.mjs'
import { FrameworkResourceHandler } from '../infrastructure/http/FrameworkResourceHandler.mjs'
import { StaticPageHandler } from '../infrastructure/http/StaticPageHandler.mjs'
import { StaticAssetHandler } from '../infrastructure/http/StaticAssetHandler.mjs'
import { ErrorHandler } from '../infrastructure/http/ErrorHandler.mjs'
import { join } from 'node:path'
import { createServer } from 'node:http'
import { Server as SocketServer } from 'socket.io'
import pkg from '../../package.json' with { type: 'json' }
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import { readFile } from 'node:fs/promises'


class JuphjacWebServer {
    /**
     * @param {Object} config
     * @param {string} config.rootDir - Root directory for the project
     * @param {string} config.logLevel - Log level: 'debug', 'info', 'warning', 'error'
     * @param {Object} config.context - User context passed to page objects
     * @param {boolean} config.hotReload - Enable hot-reload script injection (default: true)
     */
    constructor(config = {}) {
        this.config = config
        this.rootDir = config.rootDir || process.cwd()
        // Set log level: 'debug', 'info', 'warning', 'error'
        this.logger = new Logger(pkg.name, null, config.logLevel)
        // Store user-provided context for passing to pages
        this.userContext = config.context || {}
        if (!this.userContext.logger) {
            this.userContext.logger = this.logger
        }
        // Initialize components
        this.configLoader = new ConfigLoader(this.rootDir)
        this.pluginManager = new PluginManager()
        this.repository = new PageRepository(this.rootDir)
        this.assetPolicy = new AssetPolicy()
        this.pathPolicy = new PathPolicy()
        
        // Server components
        this.httpServer = null
        this.socketServer = null
        this.websocketServer = null
        this.fileWatcher = null
        this.siteGenerator = null
        this.handlerChain = null
        this.hotReloadListener = null
    }

    async initialize() {
        // Load configuration
        const siteConfig = await this.configLoader.load()
        
        this.logger.info('Initializing Juphjacs Web Server...')
        this.logger.info(`Pages folder: ${siteConfig.sourceFolder}`)
        this.logger.info(`Build folder: ${siteConfig.buildFolder}`)
        
        // Initialize site generator
        this.siteGenerator = new SiteGenerator(
            {
                sourceFolder: siteConfig.sourceFolder,
                buildFolder: siteConfig.buildFolder,
                resources: siteConfig.resources || [],
                dist: siteConfig.dist || []
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

        // Expose plugin access on context for dynamic pages
        this.userContext.getPluginByName = (name) => this.pluginManager.getPlugin(name)
        this.userContext.hasPlugin = (name) => this.pluginManager.hasPlugin(name)

        // Set up hot-reload injection listener for dynamic pages (dev mode only)
        const enableHotReload = this.config.hotReload !== false // default true
        if (enableHotReload) {
            this.hotReloadListener = (filePath, page) => {
                if (page.content && page.contentType === 'text/html') {
                    page.content = HotReloadInjector.inject(page.content)
                }
            }
            process.on(PageEvents.TEMPLATE_RENDERED, this.hotReloadListener)
        }

        // Initial build
        this.logger.info('Building site...')
        await this.siteGenerator.build()
        this.logger.info('✓ Site built successfully')

        // Initialize request handler chain
        this.handlerChain = new RequestHandlerChain()
        
        // Add framework resource handler (highest priority)
        const frameworkResourceHandler = new FrameworkResourceHandler({
            frameworkRoot: dirname(fileURLToPath(import.meta.url))
        })
        this.handlerChain.add(frameworkResourceHandler)
        
        // Add dynamic page handler
        const dynamicPageHandler = new DynamicPageHandler({
            pagesFolder: siteConfig.sourceFolder,
            context: this.userContext,
            findPageByRoute: async (route) => {
                // Find page in repository
                const page = this.repository.findByRoute(route)
                if (!page) return null
                
                // Load the page module to get the instance with methods
                const moduleFilePath = page.filePath.replace(/\.(html|xml)$/, '.mjs')
                try {
                    const template = await readFile(page.filePath, 'utf-8')
                    const pageModule = await import(moduleFilePath + '?t=' + Date.now())
                    const pageInstance = await pageModule.default(siteConfig.sourceFolder, page.filePath, template, this.userContext)
                    return pageInstance
                } catch (error) {
                    this.logger.debug(`No module found for ${page.filePath}: ${error.message}`)
                    return null
                }
            }
        })
        
        this.handlerChain.add(dynamicPageHandler)
        
        // Add static page handler
        const staticPageHandler = new StaticPageHandler({
            buildFolder: siteConfig.buildFolder
        })
        this.handlerChain.add(staticPageHandler)
        
        // Add static asset handler
        const staticAssetHandler = new StaticAssetHandler({
            buildFolder: siteConfig.buildFolder
        })
        this.handlerChain.add(staticAssetHandler)
        
        // Add error handler (terminal handler)
        const errorHandler = new ErrorHandler()
        this.handlerChain.add(errorHandler)

        return this
    }

    async start(port = 3000) {
        // Create HTTP server with FetchApi for modern request/response handling
        this.httpServer = createServer({
            IncomingMessage: FetchRequest,
            ServerResponse: FetchResponse
        }, async (req, res) => {
            await this.handleRequest(req, res)
        })

        // Create Socket.IO server
        this.socketServer = new SocketServer(this.httpServer)
        
        // Create hot-reload WebSocket server
        this.websocketServer = new HotReloadSocketServer(this.socketServer)
        
        // Make hot-reload WebSocket server and raw Socket.IO server available to page objects via context
        this.userContext.websocket = this.websocketServer
        this.userContext.io = this.socketServer
        
        this.websocketServer.on('connection', (clientId) => {
            this.logger.info(`Client connected: ${clientId}`)
        })

        this.websocketServer.on('disconnect', (clientId) => {
            this.logger.info(`Client disconnected: ${clientId}`)
        })

        // Start file watcher
        const siteConfig = await this.configLoader.load()
        this.fileWatcher = new FileWatcher(siteConfig.sourceFolder, {
            ignore: this.pathPolicy.ignorePatterns,
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
        if (!this.pathPolicy.shouldProcess(filePath)) {
            this.logger.debug(`Skipping: ${filePath}`)
            return
        }

        try {
            // Rebuild the changed file
            await this.siteGenerator.buildFile(filePath)

            // Get the page from repository
            const page = this.repository.findByFilePath(filePath)
            if (page) {
                // Notify connected clients based on HMR strategy
                const { assetType, hmrStrategy } = this.assetPolicy.getMeta(filePath)
                this.logger.debug(`Asset type: ${assetType}, HMR strategy: ${hmrStrategy}`)
                switch (hmrStrategy) {
                    case HmrStrategy.CSS_ONLY:
                        // CSS-only reload (targeted to this page's URL)
                        {
                            const urlPath = '/' + page.filePath
                                .replace(this.siteGenerator.config.sourceFolder, '')
                                .replace(/\\/g, '/')
                                .replace(/\.md$/i, '.html')
                            this.websocketServer.broadcastCssReloadToPath(urlPath, { filePath: page.filePath })
                        }
                        break
                    
                    case HmrStrategy.DOM_MORPH:
                    case HmrStrategy.FULL_RELOAD:
                        // For HTML/JS/MD files, send file-changed event with page content
                        // Client decides whether to morph DOM or full reload based on file type
                        // Only send serializable page data (no methods/functions)
                        // Send targeted update to clients on this page's route
                        const urlPath = page.filePath
                            .replace(this.siteGenerator.config.sourceFolder, '')
                            .replace(/\\/g, '/')
                            .replace(/\.md$/i, '.html')

                        const event = HotReloadEvent.fromPage(urlPath, page, assetType, hmrStrategy)
                        this.websocketServer.sendFileChangedToPath(urlPath, event)
                        // Ask plugins which additional pages are affected and rebuild them
                        try {
                            const affectedFiles = await this.pluginManager.collectHookResults('onFileChanged', {
                                filePath,
                                page,
                                repository: this.repository,
                                site: this.siteGenerator.config
                            })
                            const uniqueFiles = Array.from(new Set(affectedFiles.filter(Boolean)))
                            for (const f of uniqueFiles) {
                                try {
                                    const affectedPage = await this.siteGenerator.buildFile(f)
                                    if (!affectedPage) continue
                                    const meta = this.assetPolicy.getMeta(affectedPage.filePath)
                                    const affectedUrlPath = affectedPage.filePath
                                        .replace(this.siteGenerator.config.sourceFolder, '')
                                        .replace(/\\/g, '/')
                                        .replace(/\.md$/i, '.html')
                                    const evt = HotReloadEvent.fromPage(
                                        affectedUrlPath,
                                        affectedPage,
                                        meta.assetType,
                                        meta.hmrStrategy
                                    )
                                    this.websocketServer.sendFileChangedToPath(affectedUrlPath, evt)
                                } catch (err) {
                                    this.logger.debug(`Skipping affected rebuild for ${f}: ${err.message}`)
                                }
                            }
                        } catch (e) {
                            this.logger.debug(`Plugin affected pages error: ${e.message}`)
                        }
                        break
                    
                    case HmrStrategy.NONE:
                        // No reload needed for static assets
                        break
                }
                this.logger.info(`✓ Rebuilt and reloaded: ${JSON.stringify(page.route)}`)
            } else {
                // No page found, but file was rebuilt - send generic reload
                this.logger.info(`✓ Rebuilt: ${filePath}`)
                this.websocketServer.sendFileChanged({ filePath })
            }
        } catch (error) {
            this.logger.error(`Error rebuilding ${filePath}: ${error.message}`)
            this.websocketServer.broadcast('error', { message: error.message, filePath })
        }
    }

    async handleRequest(req, res) {
        const url = new URL(req.url, `http://${req.headers.host}`)
        
        this.logger.debug(`${req.method} ${url.pathname}`)

        // Use handler chain - ErrorHandler is terminal, so this will always handle the request
        try {
            await this.handlerChain.handle(req, res)
        } catch (error) {
            this.logger.error(`Error in handler chain: ${error.message}`)
            this.logger.error(error.stack)
            if (!res.headersSent) {
                res.writeHead(500, { 'Content-Type': 'text/html' })
                res.end('<h1>500 Internal Server Error</h1>')
            }
        }
    }

    async stop() {
        this.logger.info('Stopping server...')

        if (this.hotReloadListener) {
            process.off(PageEvents.TEMPLATE_RENDERED, this.hotReloadListener)
            this.hotReloadListener = null
        }

        if (this.fileWatcher) {
            this.fileWatcher.close()
        }

        if (this.websocketServer) {
            this.websocketServer.close()
        }

        if (this.httpServer) {
            await new Promise((resolve) => {
                const timeout = setTimeout(() => {
                    this.logger.warn('Forcing server shutdown after timeout...')
                    this.httpServer.closeAllConnections?.()
                    resolve()
                }, 5000)

                this.httpServer.close(() => {
                    clearTimeout(timeout)
                    resolve()
                })
            })
        }

        this.logger.info('✓ Server stopped')
    }
}

// CLI entry point
async function startServer() {
    const server = new JuphjacWebServer({
        logLevel: process.env.LOG_LEVEL || 'info'
    })

    try {
        await server.initialize()
        await server.start(process.env.PORT || 3000)
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

export { JuphjacWebServer, startServer }
