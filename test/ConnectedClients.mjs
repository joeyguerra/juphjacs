import test, { beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'

class ConnectedClients extends Set {
    constructor () {
        super()
    }
    async broadcast () {

    }
}

await test('Connected Clients: Need to keep a list of connected clients and their request connections to broadcast changes to', async t => {
    await t.test('Add client', async t => {
        const connectedClients = new ConnectedClients()
        const client = {}
        connectedClients.add(client)
        assert.equal(connectedClients.count, 1)
    })

    await t.test('Remove client', async t => {
        const connectedClients = new ConnectedClients()
        const client = {}
        connectedClients.add(client)
        connectedClients.delete(client)
        assert.equal(connectedClients.count, 0)
    })

    await t.test('Broadcast to no clients', async t => {
        const connectedClients = new ConnectedClients()

        await connectedClients.broadcast(() => {})

    })
})