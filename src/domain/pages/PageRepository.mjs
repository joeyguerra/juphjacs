class PageRepository {
    constructor(rootFolder) {
        this.rootFolder = rootFolder
        this.pages = new Map()
        this.pagesByFilePath = new Map()
    }

    save(page) {
        const key = page.uri || page.filePath
        this.pages.set(key, page)
        this.pagesByFilePath.set(page.filePath, page)
    }

    get(uri) {
        return this.pages.get(uri)
    }

    has(uri) {
        return this.pages.has(uri)
    }

    delete(uri) {
        const page = this.pages.get(uri)
        if (page) {
            this.pagesByFilePath.delete(page.filePath)
            this.pages.delete(uri)
        }
    }

    all() {
        return Array.from(this.pages.values())
    }

    where(criteria) {
        return this.all().filter(page => {
            return Object.keys(criteria).every(key => {
                return page[key] === criteria[key]
            })
        })
    }

    findByFilePath(filePath) {
        return this.pagesByFilePath.get(filePath)
    }

    findByRoute(path) {
        return this.all().find(page => {
            if (page.route && typeof page.route.test === 'function') {
                return page.route.test(path)
            }
            return false
        })
    }

    clear() {
        this.pages.clear()
        this.pagesByFilePath.clear()
    }
}

export { PageRepository }
