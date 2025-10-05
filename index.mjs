// Juphjacs - Modern Static Site Generator with Hot-Reload
// Main entry point - Clean architecture exports

// Development Server
export { JuphjacsDevelopmentServer, startServer } from './src/application/DevServer.mjs'

// Application Layer
export { SiteGenerator } from './src/application/SiteGenerator.mjs'
export { ConfigLoader } from './src/application/config/ConfigLoader.mjs'
export { PluginManager } from './src/application/plugins/PluginManager.mjs'
export { Plugin } from './src/application/plugins/Plugin.mjs'
export { BlogPlugin } from './src/application/plugins/BlogPlugin.mjs'
export { SitemapPlugin } from './src/application/plugins/SitemapPlugin.mjs'

// Domain Layer
export { PageRepository } from './src/domain/pages/PageRepository.mjs'
export { Page, EVENTS } from './src/domain/pages/Page.mjs'

// Infrastructure Layer
export { MarkdownParser } from './src/infrastructure/markdown/MarkdownParser.mjs'
export { TemplateEngine } from './src/infrastructure/templates/TemplateEngine.mjs'
export { FileWatcher } from './src/infrastructure/hotreload/FileWatcher.mjs'
export { ReloadServer } from './src/infrastructure/hotreload/ReloadServer.mjs'
export { FileFilter } from './src/infrastructure/FileFilter.mjs'
export { UriToStaticFileRoute } from './src/infrastructure/routing/UriToStaticFileRoute.mjs'
export { RequestBodyParser } from './src/infrastructure/http/RequestBodyParser.mjs'
export { FetchRequest, FetchResponse } from './src/infrastructure/http/FetchApi.mjs'

// Utilities
export { Logger } from './src/Logger.mjs'
