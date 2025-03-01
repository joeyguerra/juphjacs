import { resolve } from 'node:path'
import { stat } from 'node:fs/promises'
import { watch } from 'node:fs'
import EventEmitter from 'node:events'

class ChokidarWannabee extends EventEmitter {
    #watcher = null
    constructor(folder, delegate) {
        super()
        this.folder = folder
        this.delegate = delegate ?? function() { return false }
        this.debounceKeys = new Map()
    }
    dispose () {
        this.#watcher.close()
        this.removeAllListeners()
        this.debounceKeys.clear()
    }
    mapEvent(event) {
        switch (event) {
            case 'rename':
                return 'change'
            default:
                return event
        }
    }
    watch(folder) {
        this.#watcher = watch(folder,  { recursive: true }, this.fire.bind(this, folder))
        return this
    }
    async fire (folder, event, filename) {
        const eventName = this.mapEvent(event)
        let absolutePath = resolve(folder, filename)
        const debounceKey = `${absolutePath}-${eventName}`
        if (this.debounceKeys.has(debounceKey)) {
            clearTimeout(this.debounceKeys.get(debounceKey))
        }
        
        if (await this.delegate(folder, event, filename, absolutePath)) {
            return
        }

        this.debounceKeys.set(debounceKey, setTimeout(async () => {
            try {
                const stats = await stat(absolutePath)
                if (stats.isDirectory()) return
                this.emit(eventName, absolutePath, stats)
            } catch (e) {
                if (e.code === 'ENOENT') {
                    this.emit('warning', e)
                } else {
                    this.emit('error', e)
                }
            }
        }, 300))
    }
}

export { ChokidarWannabee }