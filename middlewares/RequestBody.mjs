
import { RequestBodyParser } from '../src/RequestBodyParser.mjs'

export default async () => {
    return async (request, response) => {
        try {
            request.body = await (new RequestBodyParser(request)).parse()
        } catch (e) {
            console.error(e)
        }
    }
}