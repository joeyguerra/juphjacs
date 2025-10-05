import EventEmitter from 'node:events'
import chokidar from 'chokidar'

class FileWatcher extends EventEmitter {
    constructor(rootFolder, options = {}) {
        super()
        this.rootFolder = rootFolder
        this.options = {
            ignore: options.ignore || ['**/node_modules/**', '**/.git/**', '**/_site/**'],
            debounceTime: options.debounceTime || 100,
            persistent: true,
            ignoreInitial: true,
            ...options
        }
        
        // Ensure ignore patterns are absolute or glob patterns
        if (this.options.ignore) {
            this.options.ignore = this.options.ignore.map(pattern => {
                // If pattern doesn't start with **, make it match from root
                if (!pattern.startsWith('**/') && !pattern.startsWith('/')) {
                    return `**/${pattern}`
                }
                return pattern
            })
        }
        
        this.watcher = null
        this.debounceTimers = new Map()
    }

    async watch() {
        if (this.watcher) {
            return
        }

        this.watcher = chokidar.watch(this.rootFolder, {
            ignored: this.options.ignore,
            persistent: this.options.persistent,
            ignoreInitial: this.options.ignoreInitial,
            awaitWriteFinish: {
                stabilityThreshold: 50,
                pollInterval: 25
            }
        })

        this.watcher.on('change', (filePath, stats) => {
            this.debounce('change', filePath, stats)
        })

        this.watcher.on('add', (filePath, stats) => {
            this.debounce('add', filePath, stats)
        })

        this.watcher.on('unlink', (filePath) => {
            this.emit('unlink', { filePath })
        })

        this.watcher.on('error', (error) => {
            this.emit('error', error)
        })

        // Wait for ready
        await new Promise((resolve) => {
            this.watcher.on('ready', resolve)
        })
    }

    debounce(event, filePath, stats) {
        const key = `${event}:${filePath}`
        
        // Clear existing timer
        if (this.debounceTimers.has(key)) {
            clearTimeout(this.debounceTimers.get(key))
        }

        // Set new timer
        const timer = setTimeout(() => {
            this.debounceTimers.delete(key)
            // Emit as an object for consistent API
            this.emit(event, { filePath, stats })
        }, this.options.debounceTime)

        this.debounceTimers.set(key, timer)
    }

    async close() {
        // Clear all debounce timers
        for (const timer of this.debounceTimers.values()) {
            clearTimeout(timer)
        }
        this.debounceTimers.clear()

        if (this.watcher) {
            await this.watcher.close()
            this.watcher = null
        }

        this.removeAllListeners()
    }
}

export { FileWatcher }
