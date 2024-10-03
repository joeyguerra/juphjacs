import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import EventEmitter from 'node:events'

class Value {
    #recording = false
    constructor() {
        this.value = ''
        this.quotes = 0
    }
    get recording() {
        return this.#recording
    }
    parse(char) {
        if (char === '"') {
            this.startRecording()
            this.quotes++
        }
        if(char === '"' && this.quotes === 1) {
            this.stopRecording()
            this.quotes++
        }
        if (this.#recording) {
            this.value += char
        }
    }
    stopRecording() {
        this.#recording = false
    }
    startRecording() {
        this.#recording = true
    }
}
class Attribute {
    #recording = false
    constructor() {
        this.name = ''
        this.value = null
    }
    get recording() {
        if(this.value) {
            return this.value.recording
        }
        return this.#recording
    }
    parse(char) {
        if (char === ' ' && char !== '/' && char !== '>') {
            this.startRecording()
        }
        if (char === '=') {
            this.stopRecording()
            this.value = new Value()
        }
        if (this.#recording && char !== ' ') {
            this.name += char
        }
    }
    stopRecording() {
        this.#recording = false
    }
    startRecording() {
        this.#recording = true
    }
}

class Node {
    #recording = false
    constructor(name, attributes) {
        this.name = name
        this.attributes = attributes
        this.children = []
        this.attribute = null
    }
    get recording() {
        if(this.attribute) {
            return this.attribute.recording
        }
        return this.#recording
    }
    parse(char) {
        if (char === '>' || char === '/') {
            console.log('node is completed', char)
            this.stopRecording()
        }

        if (char === '<') {
            this.startRecording()
        }
        if (char === ' ') {
            this.stopRecording()
            this.attribute = new Attribute()
        }
        if (this.#recording ) {
            this.name += char
        } else if(this.attribute) {
            this.attribute.parse(char)
        }
        if(this.attribute && !this.attribute.recording) {
            this.attributes.push(this.attribute)
            this.attribute = null
        }
    }
    stopRecording() {
        this.#recording = false
    }
    startRecording() {
        this.#recording = true
    }
}

class HtmlParser extends EventEmitter {
    constructor() {
        super()
        this.node = new Node('html', [])
    }
    parse(html) {
        let i = 0
        let char = null
        while((char = html[i])) {
            this.node.parse(char)
            console.log(this.node.recording, char)
            i++
        }
        console.log(this.node)
    }
}

await test('DOMParser', async t => {
    await t.test('Transitions state correctly based on the character.', async t => {
        const html = '<div class="container"><p id="paragraph">Hello World</p></div>';
        const parser = new HtmlParser();
        const parsedHtml = parser.parse(html);
        console.log(parsedHtml)
    });
    await t.test({skip: true}, 'Should start with html root', async t => {
        const html = '<html><div class="container"><p id="paragraph">Hello World</p></div></html>';
        const parser = new HtmlParser();
        const parsedHtml = parser.parse(html);
        assert.equal(parsedHtml.children[0].tagName, 'html');
    });
})