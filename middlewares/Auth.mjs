class Auth {
    constructor(request, response) {
        this.request = request
        this.response = response
    }

    async execute () {
        const { headers } = this.request
    }
}

export {
    Auth
}

export default async () => {
    return async (request, response) => {
        await new Auth(request, response).execute()
    }
}