class Dummy {
    constructor(request, response) {
        this.request = request
        this.response = response
    }

    async execute () {

    }
}

export {
    Dummy
}

export default async () => {
    return async (request, response) => {
        await new Dummy(request, response).execute()
    }
}