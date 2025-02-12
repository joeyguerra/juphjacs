
class RingBuffer {
    #count = 0
    #buffer = []
    constructor(limit) {
        this.limit = limit
    }
    get count() {
        return this.#count
    }
    push(event) {
        if (this.#buffer.length === this.limit) {
            this.#buffer.shift()
            this.#count--
        }
        this.#count++
        this.#buffer.push(event)
    }
    shift() {
        if (this.#buffer.length > 0) {
            this.#count--
            return this.#buffer.shift()
        }
    }
    get length() {
        return this.#buffer.length
    }
    [Symbol.iterator]() {
        return this.#buffer[Symbol.iterator]()
    }
    get(index) {
        return this.#buffer[index]
    }
}

export { RingBuffer }