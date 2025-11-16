/**
 * Hot reload event payload schema
 * Defines the contract between server (WebServer) and client (HotReloader)
 */
class HotReloadEvent {
    /**
     * Create a hot reload event
     * @param {Object} data - Event data
     * @param {string} data.route - Canonical URL path for the page (e.g., '/blog/2024/first-post.html')
     * @param {string} data.content - Rendered HTML content of the page
     * @param {string} data.filePath - Source file path (e.g., 'pages/blog/2024/first-post.md')
     * @param {string} [data.title] - Page title
     * @param {string} [data.assetType] - Asset type from AssetType enum (html, markdown, css, js, etc.)
     * @param {string} [data.hmrStrategy] - HMR strategy from HmrStrategy enum (css-only, dom-morph, full-reload, none)
     */
    constructor(data) {
        /** @type {string} Canonical URL path for the page */
        this.route = data.route
        
        /** @type {string} Rendered HTML content */
        this.content = data.content
        
        /** @type {string} Source file path */
        this.filePath = data.filePath
        
        /** @type {string|undefined} Page title */
        this.title = data.title
        
        /** @type {string|undefined} Asset type (html, markdown, css, js, etc.) */
        this.assetType = data.assetType
        
        /** @type {string|undefined} HMR strategy (css-only, dom-morph, full-reload, none) */
        this.hmrStrategy = data.hmrStrategy
    }

    /**
     * Create event from page object
     * @param {string} route - URL path
     * @param {Object} page - Page object with content, filePath, title
     * @param {string} assetType - Asset type
     * @param {string} hmrStrategy - HMR strategy
     * @returns {HotReloadEvent}
     */
    static fromPage(route, page, assetType, hmrStrategy) {
        return new HotReloadEvent({
            route,
            content: page.content,
            filePath: page.filePath,
            title: page.title,
            assetType,
            hmrStrategy
        })
    }

    /**
     * Convert to plain object for JSON serialization
     * @returns {Object}
     */
    toJSON() {
        return {
            route: this.route,
            content: this.content,
            filePath: this.filePath,
            title: this.title,
            assetType: this.assetType,
            hmrStrategy: this.hmrStrategy
        }
    }
}

export { HotReloadEvent }
