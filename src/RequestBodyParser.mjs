import { Readable, isReadable } from 'node:stream'

class RequestBodyParser {
    constructor(request) {
        this.request = request
    }
    
    parse() {
        return new Promise((resolve, reject) => {
            let body = Buffer.alloc(0)
            const contentType = this.request.headers['content-type']

            if (!contentType) {
                return resolve(null)
            }

            this.request.on('data', (chunk) => {
                body = Buffer.concat([body, chunk])
            })
    
            this.request.on('end', () => {
                try {
                    if (contentType.includes('application/json')) {
                        return resolve(JSON.parse(body.toString()))
                    }
    
                    if (contentType.includes('application/x-www-form-urlencoded')) {
                        return resolve(Object.fromEntries(new URLSearchParams(body.toString())))
                    }
    
                    if (contentType.includes('text/plain')) {
                        return resolve(body.toString())
                    }

                    if (contentType.includes('multipart/form-data')) {
                        return resolve(this.parseMultipart(body, contentType))
                    }
    
                    resolve({ raw: body.toString(), message: 'Unsupported Content-Type' })
                } catch (error) {
                    reject(new Error('Invalid request body'))
                }
            })
    
            this.request.on('error', (err) => reject(err))
        })
    }

    splitBuffer(buffer, delimiter) {
        let start = 0
        let end = 0
        const parts = []

        while ((end = buffer.indexOf(delimiter, start)) !== -1) {
            parts.push(buffer.slice(start, end))
            start = end + delimiter.length
        }

        parts.push(buffer.slice(start))
        return parts
    }

    parseMultipart(bodyBuffer, contentType) {
        const boundary = contentType.split('boundary=')[1]
        if (!boundary) {
            throw new Error('Invalid multipart/form-data: missing boundary')
        }
    
        const boundaryBuffer = Buffer.from(`--${boundary}`)
        const parts = this.splitBuffer(bodyBuffer, boundaryBuffer).slice(1, -1)

        const result = { fields: {}, files: {} }
        for (const part of parts) {
            const [headers, content] = this.splitHeadersAndBody(part)
            const disposition = headers['content-disposition']
            if (!disposition) continue
            
            const match = disposition.match(/name="(.+?)"/)
            
            if (!match) continue
            const fieldName = match[1]
    
            if (disposition.includes('filename=')) {
                const filenameMatch = disposition.match(/filename="(.+?)"/)
                const filename = filenameMatch ? filenameMatch[1] : 'unknown'
    
                const contentType = headers['content-type'] || 'application/octet-stream'
                const fileStream = this.createStreamFromBuffer(content)
                result.files[fieldName] = {
                    filename,
                    mimetype: contentType,
                    stream: fileStream
                }
            } else {
                result.fields[fieldName] = content.toString().replace(/\r\n$/, '')
            }
        }

        return result
    }
    
    createStreamFromBuffer(buffer) {
        const stream = new Readable()
        stream.push(buffer)
        stream.push(null)
        return stream
    }

    splitHeadersAndBody(buffer) {
        const doubleCRLF = Buffer.from('\r\n\r\n')
        const index = buffer.indexOf(doubleCRLF)
    
        if (index === -1) {
            throw new Error('Invalid multipart format')
        }
    
        const headersPart = buffer.slice(0, index).toString()
        const bodyPart = buffer.slice(index + 4) // Skip \r\n\r\n
    
        const headers = headersPart.split('\r\n').reduce((acc, line) => {
            const [key, value] = line.split(': ').map((s) => s.trim())
            if (key && value) acc[key.toLowerCase()] = value
            return acc
        }, {})
    
        return [headers, bodyPart]
    }
    
}

export { RequestBodyParser }
