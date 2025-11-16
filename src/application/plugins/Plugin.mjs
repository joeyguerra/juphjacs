import EventEmitter from 'node:events'

class Plugin extends EventEmitter {
    constructor(name) {
        super()
        this.name = name
    }

    async onInit() {
        // Hook called when plugin is initialized
    }

    async onContentLoaded(pages) {
        // Hook called after content is loaded
        // Should return pages (possibly modified)
        return pages
    }

    async onPageRendered(page) {
        // Hook called after a single page is rendered
    }

    async onBuildComplete(site) {
        // Hook called when build is complete
    }

    /**
     * Optional hook: declare additional pages affected by a file change
     * @param {Object} change
     * @param {string} change.filePath - Absolute path of the changed source file
     * @param {Object} change.page - Page object for the changed file, if any
     * @param {import('../../domain/pages/PageRepository.mjs').PageRepository} change.repository - Repository
     * @param {{sourceFolder:string, buildFolder:string}} change.site - Site config
     * @returns {Promise<string[]|undefined>} Absolute file paths to rebuild
     */
    async onFileChanged(change) {
        return []
    }
}

export { Plugin }
