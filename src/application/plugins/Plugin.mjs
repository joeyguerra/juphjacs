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
}

export { Plugin }
