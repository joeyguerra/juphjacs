import { Writable } from 'node:stream'

class Logger extends Writable {
    constructor(name, ringBuffer, debug, options = {}) {
        super({...options, objectMode: true})
        this.name = name
        this.debug = debug
        this.ringBuffer = ringBuffer
    }

    _write(chunk, encoding, callback) {
        process.stdout.write(chunk + '\n\n', callback)
    }

    debug (message, label) {
        if (!this.debug) return
        if (this.debug !== 'debug') return
        this.log(message, label, 'debug')
    }

    info (message, label) {
        if (!this.debug) return
        if (!['info', 'debug'].includes(this.debug)) return
        this.log(message, label, 'info')
    }

    warn (message, label) {
        if (!this.debug) return
        if (!['info', 'debug', 'warn'].includes(this.debug)) return
        this.log(message, label, 'warn')
    }

    error (message, label) {
        if (!this.debug) return
        if (!['info', 'debug', 'warn', 'error'].includes(this.debug)) return
        this.log(message, label, 'error')
    }

    log(message, label, level = 'info') {
        if (typeof message === 'object') {
            message = { ...message, time: new Date(), name: this.name }
        } else {
            message = { message, time: new Date() }
        }
        if (this.ringBuffer) {
            this.ringBuffer.push({ ...message, level, label })
        }
        const colorStart = level === 'error' ? '\x1b[31m' : level === 'warn' ? '\x1b[33m' : '\x1b[34m'
        message = JSON.stringify(message, (key, value) => value instanceof Set ? [...value] : value)
        this.write(`${colorStart}${level.toUpperCase()} ${label ? `[${new Date().toISOString()}] ${label}:` : `[${new Date().toISOString()}]`}\x1b[0m ${message}`)
    }
}

export {
    Logger
}