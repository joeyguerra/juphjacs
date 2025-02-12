import test from 'node:test'
import assert from 'node:assert/strict'
import { RingBuffer } from '../src/RingBuffer.mjs'

await test('Ring Buffer', async t => {
    await t.test('Only holds 100 events', async t => {
        const buffer = new RingBuffer(100)
        for (let i = 0; i < 150; i++) {
            buffer.push(i)
        }
        assert.equal(buffer.length, 100)
    })

    await t.test('Writes events', async t => {
        const buffer = new RingBuffer(100)
        buffer.push('event')
        assert.equal(buffer.count, 1)
    })

    await t.test('Writes events in order', async t => {
        const buffer = new RingBuffer(100)
        for (let i = 0; i < 100; i++) {
            buffer.push(i)
        }
        console.log(buffer)
        assert.equal(buffer.get(0), 0)
        assert.equal(buffer.get(99), 99)
    })

    await t.test('Processor reads events', async t => {
        const buffer = new RingBuffer(100)
        for (let i = 0; i < 100; i++) {
            buffer.push({id: i, kind: 'event', data: `data ${i}`})
        }
        let counter = 0
        for (let event of buffer) {
            assert.equal(event.id, counter)
            assert.equal(event.kind, 'event')
            assert.equal(event.data, `data ${counter}`)
            counter++
        }
    })

    await t.test('Buffer is empty after events are processed', async t => {
        const buffer = new RingBuffer(100)
        for (let i = 0; i < 100; i++) {
            buffer.push(i)
        }
        for (let i = 0; i < 100; i++) {
            buffer.shift()
        }
        assert.equal(buffer.count, 0)
    })
})