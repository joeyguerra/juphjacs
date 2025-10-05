/**
 * juphjacs - A simple, modern static site generator with hot-reload
 * 
 * Main exports for the refactored architecture
 */

// Domain Layer
export { Page, EVENTS as PAGE_EVENTS } from './src/domain/pages/Page.mjs'
export { PageRepository } from './src/domain/pages/PageRepository.mjs'

// Application Layer
export { Plugin } from './src/application/plugins/Plugin.mjs'
export { PluginManager } from './src/application/plugins/PluginManager.mjs'
export { ConfigLoader, DEFAULT_CONFIG } from './src/application/config/ConfigLoader.mjs'

// Infrastructure Layer
export { MarkdownParser } from './src/infrastructure/markdown/MarkdownParser.mjs'
export { TemplateEngine } from './src/infrastructure/templates/TemplateEngine.mjs'

// Legacy exports for backward compatibility
export { Page as default } from './src/domain/pages/Page.mjs'
