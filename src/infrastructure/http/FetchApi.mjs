import { IncomingMessage, ServerResponse } from 'node:http'
import { Readable } from 'node:stream'
import { RequestBodyParser } from './RequestBodyParser.mjs'

class FetchRequest extends IncomingMessage {
    constructor(socket) {
        super(socket)
        this.duplex = 'half'
    }

    get body () {
        return ['GET', 'HEAD'].includes(this.method) ? null : Readable.from(this)
    }

    async text() {
        const parser = new RequestBodyParser(this)
        return await parser.parse()
    }

    async json() {
        const parser = new RequestBodyParser(this)
        return await parser.parse()
    }

    async arrayBuffer() {
        if (this.body) {
            const chunks = []
            for await (const chunk of this.body) {
                chunks.push(chunk)
            }
            const buffer = Buffer.concat(chunks)
            return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
        }
        return null
    }

    async blob() {
        const arrayBuffer = await this.arrayBuffer()
        return arrayBuffer ? new Blob([arrayBuffer]) : null
    }

    async formData() {
        const parser = new RequestBodyParser(this)
        return await parser.parse()
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
