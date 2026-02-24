import { parentPort, workerData } from 'node:worker_threads'

const pendingRpc = new Map()
let rpcId = 0

function normalizeFunctionSource(source) {
    if (/^async\s+[A-Za-z_$][A-Za-z0-9_$]*\s*\(/.test(source)) {
        return source.replace(/^async\s+/, 'async function ')
    }

    if (/^[A-Za-z_$][A-Za-z0-9_$]*\s*\(/.test(source)) {
        return `function ${source}`
    }

    if (/^\*\s*[A-Za-z_$][A-Za-z0-9_$]*\s*\(/.test(source)) {
        return `function ${source}`
    }

    return source
}

function deserializeFunction(source) {
    const normalized = normalizeFunctionSource(source)
    return (0, eval)(`(${normalized})`)
}

function createRpcFunction(name) {
    return (...args) => {
        return new Promise((resolve, reject) => {
            const id = ++rpcId
            pendingRpc.set(id, { resolve, reject })
            parentPort.postMessage({
                type: 'rpc-request',
                id,
                name,
                args
            })
        })
    }
}

function isJavaScriptKeyword(word) {
    const keywords = [
        'await', 'break', 'case', 'catch', 'class', 'const', 'continue',
        'debugger', 'default', 'delete', 'do', 'else', 'export', 'extends',
        'finally', 'for', 'function', 'if', 'import', 'in', 'instanceof',
        'let', 'new', 'return', 'super', 'switch', 'this', 'throw', 'try',
        'typeof', 'var', 'void', 'while', 'with', 'yield'
    ]
    return keywords.includes(word)
}

async function renderTemplate(payload) {
    const context = { ...payload.contextValues }

    for (const [name, source] of Object.entries(payload.serializedFunctions || {})) {
        context[name] = deserializeFunction(source)
    }

    for (const name of payload.rpcFunctions || []) {
        context[name] = createRpcFunction(name)
    }

    const keys = new Set(Object.keys(context))
    const templateVarRegex = /\$\{([a-zA-Z_$][a-zA-Z0-9_$]*)/g
    let match
    while ((match = templateVarRegex.exec(payload.template)) !== null) {
        const varName = match[1]
        if (!keys.has(varName) && !isJavaScriptKeyword(varName)) {
            keys.add(varName)
            context[varName] = undefined
        }
    }

    const argNames = Array.from(keys)
    const argValues = argNames.map((name) => context[name])
    const functionBody = `return \`${payload.template}\``
    const AsyncFunction = async function () {}.constructor
    const renderFunction = new AsyncFunction(...argNames, functionBody)
    return await renderFunction.apply(context, argValues)
}

parentPort.on('message', (message) => {
    if (message?.type !== 'rpc-response') {
        return
    }

    const pending = pendingRpc.get(message.id)
    if (!pending) {
        return
    }

    pendingRpc.delete(message.id)

    if (message.error) {
        pending.reject(new Error(message.error))
        return
    }

    pending.resolve(message.value)
})

try {
    const result = await renderTemplate(workerData)
    parentPort.postMessage({ type: 'result', result })
} catch (error) {
    parentPort.postMessage({
        type: 'error',
        error: error?.message || String(error)
    })
} finally {
    parentPort.removeAllListeners('message')
    parentPort.close()
}
