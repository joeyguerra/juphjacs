import test from 'node:test'
import assert from 'node:assert/strict'
import { RequestParams } from '../src/RequestParams.mjs'
await test('RequestParams', async t => {
    await t.test('A URL can be parsed into a RequestParams object', async t => {
        const url = new URL('http://localhost:3000/?name=world')
        const params = new RequestParams(url)
        assert.deepEqual(params.get('name'), 'world')
    })
    await t.test('A URL can be parsed into a RequestParams object with multiple query parameters', async t => {
        const url = new URL('http://localhost:3000/?name=world&age=30')
        const params = new RequestParams(url)
        assert.deepEqual(params.get('name'), 'world')
        assert.deepEqual(params.get('age'), '30')
    })
    await t.test('A URL can be parsed into a RequestParams object with multiple values for a query parameter', async t => {
        const url = new URL('http://localhost:3000/?name=world&name=earth')
        const params = new RequestParams(url)
        assert.deepEqual(params.get('name'), 'world')
        assert.deepEqual(params.getAll('name'), ['world', 'earth'])
    })
    await t.test('A URL can be parsed into a RequestParams object with multiple query parameters and multiple values for a query parameter', async t => {
        const url = new URL('http://localhost:3000/?name=world&name=earth&age=30')
        const params = new RequestParams(url)
        assert.deepEqual(params.get('name'), 'world')
        assert.deepEqual(params.getAll('name'), ['world', 'earth'])
        assert.deepEqual(params.get('age'), '30')
    })
    await t.test('A URL can be parsed into a RequestParams object with no query parameters', async t => {
        const url = new URL('http://localhost:3000/')
        const params = new RequestParams(url)
        assert.deepEqual(params.get('name'), null)
    })
    await t.test('The URI can be included in the params', async t => {
        const url = new URL('http://localhost:3000/blog/2024/testing-blog-name')
        // const params = new RequestParams(url, new RegExp('/blog/(?<year>.*[^/])'))
        const params = new RequestParams(url, new RegExp('/blog/?(?<year>\\d{4})'))
        assert.deepEqual(params.get('year'), '2024')
    })
    await t.test('The URI can be included in the params with multiple values', async t => {
        const url = new URL('http://localhost:3000/blog/2024/12/25/')
        const params = new RequestParams(url, new RegExp('/blog/(?<year>.*[^/])/(?<month>.*[^/])/(?<day>.*[^/])'))
        assert.deepEqual(params.get('year'), '2024')
        assert.deepEqual(params.get('month'), '12')
        assert.deepEqual(params.get('day'), '25')
    })
})