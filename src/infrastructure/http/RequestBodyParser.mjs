function getContentType(headers) {
    if (!headers) return ''
    if (typeof headers.get === 'function') return headers.get('content-type') || ''
    return headers['content-type'] || headers['Content-Type'] || ''
}

class RequestBodyParser {
    constructor(request) {
        this.request = request
    }

    async parseText() {
        const body = await this.request.rawBody()
        return body.toString('utf-8')
    }

    async parseJson() {
        const text = await this.parseText()
        return JSON.parse(text)
    }

    async parseFormData() {
        const contentType = getContentType(this.request.headers)
        const formData = new FormData()

        if (!contentType) {
            return formData
        }

        if (contentType.includes('application/x-www-form-urlencoded')) {
            const text = await this.parseText()
            const params = new URLSearchParams(text)
            for (const [key, value] of params) {
                formData.append(key, value)
            }
            return formData
        }

        if (contentType.includes('multipart/form-data')) {
            const body = await this.request.rawBody()
            this.parseMultipart(body, contentType, formData)
            return formData
        }

        return formData
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

    parseMultipart(bodyBuffer, contentType, formData) {
        const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i)
        const boundary = boundaryMatch?.[1] || boundaryMatch?.[2]
        if (!boundary) {
            throw new Error('Invalid multipart/form-data: missing boundary')
        }

        const boundaryBuffer = Buffer.from(`--${boundary}`)
        const parts = this.splitBuffer(bodyBuffer, boundaryBuffer).slice(1, -1)

        for (const part of parts) {
            const cleanedPart = this.trimMultipartPart(part)
            if (cleanedPart.length === 0) {
                continue
            }

            const [headers, content] = this.splitHeadersAndBody(cleanedPart)
            const disposition = headers['content-disposition']
            if (!disposition) continue

            const fieldNameMatch = disposition.match(/name="([^"]+)"/)
            if (!fieldNameMatch) continue
            const fieldName = fieldNameMatch[1]
            const value = this.removeTrailingCrlf(content)

            const filenameMatch = disposition.match(/filename="([^"]*)"/)
            if (!filenameMatch) {
                formData.append(fieldName, value.toString('utf-8'))
                continue
            }

            const filename = filenameMatch[1]
            const partContentType = headers['content-type'] || 'application/octet-stream'
            const file = new File([value], filename, { type: partContentType })
            formData.append(fieldName, file)
        }
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

    trimMultipartPart(buffer) {
        let part = buffer
        if (part.length >= 2 && part.subarray(0, 2).equals(Buffer.from('\r\n'))) {
            part = part.subarray(2)
        }
        if (part.length >= 2 && part.subarray(part.length - 2).equals(Buffer.from('\r\n'))) {
            part = part.subarray(0, part.length - 2)
        }
        return part
    }

    removeTrailingCrlf(buffer) {
        if (buffer.length >= 2 && buffer.subarray(buffer.length - 2).equals(Buffer.from('\r\n'))) {
            return buffer.subarray(0, buffer.length - 2)
        }
        return buffer
    }
}

export { RequestBodyParser, getContentType }
