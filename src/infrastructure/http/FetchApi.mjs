import { IncomingMessage, ServerResponse } from 'node:http'
import { Readable } from 'node:stream'
import { RequestBodyParser } from './RequestBodyParser.mjs'

class FetchRequest extends IncomingMessage {
    constructor(socket) {
        super(socket)
        this.duplex = 'half'
        this._rawBodyPromise = null
    }

    get body () {
        const method = (this.method || '').toUpperCase()
        if (['GET', 'HEAD'].includes(method)) {
            return null
        }

        return Readable.from((async function* (request) {
            const buffer = await request.rawBody()
            if (buffer.length > 0) {
                yield buffer
            }
        })(this))
    }

    async rawBody() {
        const method = (this.method || '').toUpperCase()
        if (['GET', 'HEAD'].includes(method)) {
            return Buffer.alloc(0)
        }

        if (!this._rawBodyPromise) {
            this._rawBodyPromise = (async () => {
                const chunks = []
                for await (const chunk of this) {
                    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
                }
                return Buffer.concat(chunks)
            })()
        }

        return this._rawBodyPromise
    }

    async text() {
        const parser = new RequestBodyParser(this)
        return await parser.parseText()
    }

    async json() {
        const parser = new RequestBodyParser(this)
        return await parser.parseJson()
    }

    async arrayBuffer() {
        const buffer = await this.rawBody()
        return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
    }

    async blob() {
        const arrayBuffer = await this.arrayBuffer()
        return new Blob([arrayBuffer])
    }

    async formData() {
        const parser = new RequestBodyParser(this)
        return await parser.parseFormData()
    }
}

class FetchResponse extends ServerResponse {
    constructor(req) {
        super(req)
    }
    get body () {
        return Readable.from(this)
    }

    async text() {
        const chunks = []
        for await (const chunk of this.body) {
            chunks.push(chunk)
        }
        return Buffer.concat(chunks).toString('utf-8')
    }

    async json() {
        const text = await this.text()
        return JSON.parse(text)
    }

    async arrayBuffer() {
        const chunks = []
        for await (const chunk of this.body) {
            chunks.push(chunk)
        }
        return Buffer.concat(chunks).buffer
    }

    async blob() {
        const arrayBuffer = await this.arrayBuffer()
        return new Blob([arrayBuffer])
    }

    async formData() {
        const text = await this.text()
        const formData = new FormData()
        text.split('&').forEach(pair => {
            const [name, value] = pair.split('=').map(decodeURIComponent)
            formData.append(name, value)
        })
        return formData
    }

}

export { FetchRequest, FetchResponse }
