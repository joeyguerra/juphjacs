import { createServer } from 'node:http'
import { main, logger, EVENTS } from './index.mjs'
import { FetchRequest, FetchResponse } from './src/FetchApi.mjs'

const server = createServer({
    IncomingMessage: FetchRequest,
    ServerResponse: FetchResponse
})

const args = process.argv.reduce((acc, current, i, items) => {
    if (current === '--execute') {
        acc.execute = items[i + 1]
    }
    return acc
}, {execute: null})

await main(server, args.execute)

server.listen(process.env.PORT ?? 3000, () => {
    logger.info(`Server running at http://localhost:${server.address().port}/`)
})
