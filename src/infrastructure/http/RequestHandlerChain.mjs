class RequestHandlerChain {
    constructor() {
        this.handlers = []
    }

    add(handler) {
        this.handlers.push(handler)
    }

    async handle(req, res) {
        for (const handler of this.handlers) {
            const handled = await handler.handle(req, res)
            if (handled) {
                return true
            }
        }
        return false
    }
}

export { RequestHandlerChain }
