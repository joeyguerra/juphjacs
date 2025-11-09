import test from 'node:test'
import assert from 'node:assert/strict'
import { RequestHandlerChain } from '../src/infrastructure/http/RequestHandlerChain.mjs'

await test('RequestHandlerChain', async t => {
    await t.test('should call handlers in order until one handles the request', async () => {
        const chain = new RequestHandlerChain()
        const calls = []
        
        const handler1 = {
            async handle(req, res) {
                calls.push('handler1')
                return false // doesn't handle
            }
        }
        
        const handler2 = {
            async handle(req, res) {
                calls.push('handler2')
                return true // handles the request
            }
        }
        
        const handler3 = {
            async handle(req, res) {
                calls.push('handler3')
                return false
            }
        }
        
        chain.add(handler1)
        chain.add(handler2)
        chain.add(handler3)
        
        const mockReq = {}
        const mockRes = {}
        
        await chain.handle(mockReq, mockRes)
        
        // Should call handler1 and handler2, but not handler3
        assert.deepEqual(calls, ['handler1', 'handler2'])
    })
    
    await t.test('should call all handlers if none handle the request', async () => {
        const chain = new RequestHandlerChain()
        const calls = []
        
        const handler1 = {
            async handle(req, res) {
                calls.push('handler1')
                return false
            }
        }
        
        const handler2 = {
            async handle(req, res) {
                calls.push('handler2')
                return false
            }
        }
        
        chain.add(handler1)
        chain.add(handler2)
        
        const mockReq = {}
        const mockRes = {}
        
        await chain.handle(mockReq, mockRes)
        
        assert.deepEqual(calls, ['handler1', 'handler2'])
    })
})
