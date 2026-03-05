import { createHash } from 'node:crypto'
import { readFile, opendir } from 'node:fs/promises'
import { extname, isAbsolute, relative, resolve } from 'node:path'
import { Worker } from 'node:worker_threads'
import { canonicalizeManifestPayload, verifyTemplateManifestSignature } from './TemplateManifest.mjs'

class TemplateEngine {
    constructor(options = {}) {
        this.scriptTagRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi
        this.trustedRoots = (options.trustedRoots || []).map((root) => resolve(root))
        this.allowInlineTemplates = options.allowInlineTemplates === true
        this.executionTimeoutMs = options.executionTimeoutMs || 250
        this.workerMemoryLimitMb = options.workerMemoryLimitMb || 64
        this.workerRetryCount = Number.isInteger(options.workerRetryCount) ? options.workerRetryCount : 1
        this.maxTemplateSizeBytes = options.maxTemplateSizeBytes || 256 * 1024
        this.templateHashes = null
        this.signedManifestPath = options.signedManifestPath ? resolve(options.signedManifestPath) : null
        this.publicKey = options.publicKey || null
        this.publicKeyPath = options.publicKeyPath ? resolve(options.publicKeyPath) : null
        this.requireSignedManifest = options.requireSignedManifest === true
        this.verifiedManifest = null
        this.workerScriptUrl = new URL('./TemplateRenderWorker.mjs', import.meta.url)
        this.allowedTemplateExtensions = new Set(['.html', '.xml', '.md'])
    }

    async render(template, context = {}, options = {}) {
        const templatePath = options.templatePath ? resolve(options.templatePath) : null
        this.validateTemplateInput(template, templatePath)

        if (templatePath) {
            await this.verifyTrustedTemplate(templatePath, template, options)
        }

        // First, protect client-side template literals in script tags
        const { protectedTemplate, scriptContents } = this.protectScriptTags(template)
        const payload = this.buildWorkerPayload(protectedTemplate, context)

        // Render the template in an isolated worker
        const rendered = await this.renderTemplateInWorker(payload, context)

        // Restore the script tags with their original content
        const final = this.restoreScriptTags(rendered, scriptContents)

        return final
    }

    protectScriptTags(template) {
        const scriptContents = []
        let index = 0
        
        const protectedTemplate = template.replace(this.scriptTagRegex, (match, scriptContent) => {
            const placeholder = `___SCRIPT_PLACEHOLDER_${index}___`
            // Escape backticks and template expressions in JavaScript
            const escapedContent = scriptContent
                .replace(/\\/g, '\\\\')  // Escape backslashes first
                .replace(/`/g, '\\`')    // Escape backticks
                .replace(/\$\{/g, '\\${') // Escape template expressions
            scriptContents.push(escapedContent)
            index++
            return match.replace(scriptContent, placeholder)
        })
        
        return { protectedTemplate, scriptContents }
    }

    restoreScriptTags(template, scriptContents) {
        let result = template
        
        scriptContents.forEach((content, index) => {
            const placeholder = `___SCRIPT_PLACEHOLDER_${index}___`
            // Unescape the content when restoring
            const unescapedContent = content
                .replace(/\\\$\{/g, '${')  // Unescape template expressions first
                .replace(/\\`/g, '`')      // Unescape backticks
                .replace(/\\\\/g, '\\')    // Unescape backslashes last
            result = result.replace(placeholder, unescapedContent)
        })
        
        return result
    }

    validateTemplateInput(template, templatePath) {
        if (!this.allowInlineTemplates && !templatePath) {
            throw new Error('Inline templates are disabled. A trusted templatePath is required.')
        }

        if (Buffer.byteLength(template, 'utf-8') > this.maxTemplateSizeBytes) {
            const error = new Error(`Template exceeds max size limit (${this.maxTemplateSizeBytes} bytes)`)
            error.code = 'TEMPLATE_TOO_LARGE'
            throw error
        }
    }

    async verifyTrustedTemplate(templatePath, template, options = {}) {
        if (!this.isTrustedPath(templatePath)) {
            throw new Error(`Template path is outside trusted roots: ${templatePath}`)
        }

        const verificationContent = options.verificationContent ?? template
        const manifest = await this.getVerifiedManifestIfConfigured()
        if (manifest) {
            const expectedHash = this.getHashFromManifest(templatePath, manifest)
            if (!expectedHash) {
                throw new Error(`Template missing from signed manifest: ${templatePath}`)
            }
            const actualHash = this.sha256(verificationContent)
            if (actualHash !== expectedHash) {
                throw new Error(`Template hash mismatch for signed manifest entry: ${templatePath}`)
            }
            return
        }

        if (this.requireSignedManifest) {
            throw new Error('Signed template manifest is required but not configured or invalid')
        }

        if (!this.templateHashes) {
            this.templateHashes = await this.preHashTrustedTemplates()
        }

        const expectedHash = this.templateHashes.get(templatePath)
        if (!expectedHash) {
            throw new Error(`Template is not pre-hashed/allowlisted: ${templatePath}`)
        }

        const actualHash = this.sha256(verificationContent)
        if (actualHash !== expectedHash) {
            throw new Error(`Template hash mismatch for trusted template: ${templatePath}`)
        }
    }

    async getVerifiedManifestIfConfigured() {
        if (!this.signedManifestPath && !this.requireSignedManifest) {
            return null
        }

        if (this.verifiedManifest) {
            return this.verifiedManifest
        }

        if (!this.signedManifestPath) {
            return null
        }

        const raw = await readFile(this.signedManifestPath, 'utf-8')
        const manifest = JSON.parse(raw)
        const signature = manifest.signature
        if (!signature) {
            throw new Error('Signed manifest is missing signature')
        }

        const payload = {
            version: manifest.version,
            hashAlgorithm: manifest.hashAlgorithm,
            files: manifest.files || {}
        }

        const publicKey = await this.loadPublicKey()
        const verified = verifyTemplateManifestSignature(payload, signature, publicKey)
        if (!verified) {
            throw new Error('Signed manifest signature verification failed')
        }

        // Freeze normalized payload after successful signature verification.
        this.verifiedManifest = {
            version: payload.version,
            hashAlgorithm: payload.hashAlgorithm,
            files: Object.freeze({ ...(payload.files || {}) }),
            canonical: canonicalizeManifestPayload(payload)
        }
        return this.verifiedManifest
    }

    async loadPublicKey() {
        if (this.publicKey) {
            return this.publicKey
        }
        if (!this.publicKeyPath) {
            throw new Error('publicKeyPath/publicKey required for signed manifest verification')
        }
        const key = await readFile(this.publicKeyPath, 'utf-8')
        this.publicKey = key
        return key
    }

    getHashFromManifest(templatePath, manifest) {
        const resolvedPath = resolve(templatePath)
        for (const root of this.trustedRoots) {
            const rel = normalizeRelative(root, resolvedPath)
            if (!rel) {
                continue
            }
            if (manifest.files[rel]) {
                return manifest.files[rel]
            }
        }
        return null
    }

    isTrustedPath(filePath) {
        if (!filePath || this.trustedRoots.length === 0) {
            return false
        }

        const resolvedPath = resolve(filePath)
        return this.trustedRoots.some((root) => {
            const resolvedRoot = resolve(root)
            const rel = relative(resolvedRoot, resolvedPath)
            return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
        })
    }

    async preHashTrustedTemplates() {
        const hashes = new Map()

        for (const root of this.trustedRoots) {
            for await (const filePath of this.readAllFiles(root)) {
                const ext = extname(filePath).toLowerCase()
                if (!this.allowedTemplateExtensions.has(ext)) {
                    continue
                }
                const content = await readFile(filePath, 'utf-8')
                hashes.set(resolve(filePath), this.sha256(content))
            }
        }

        return hashes
    }

    async *readAllFiles(folder) {
        const dir = await opendir(folder)
        for await (const dirent of dir) {
            const entryPath = resolve(folder, dirent.name)
            if (dirent.isDirectory()) {
                yield *this.readAllFiles(entryPath)
                continue
            }
            yield entryPath
        }
    }

    sha256(content) {
        return createHash('sha256').update(content).digest('hex')
    }

    buildWorkerPayload(template, context) {
        // Get all properties and methods from the context, including prototype methods
        const allKeys = new Set()

        // Add own properties
        Object.keys(context).forEach(key => {
            allKeys.add(key)
        })

        // Add methods from the prototype chain
        let obj = context
        while (obj && obj !== Object.prototype) {
            Object.getOwnPropertyNames(obj).forEach(key => {
                if (key !== 'constructor' && typeof context[key] === 'function') {
                    allKeys.add(key)
                }
            })
            obj = Object.getPrototypeOf(obj)
        }

        // Extract variable names from template expressions ${varName}
        // This allows using ?? operator for undefined variables
        const templateVarRegex = /\$\{([a-zA-Z_$][a-zA-Z0-9_$]*)/g
        let match
        while ((match = templateVarRegex.exec(template)) !== null) {
            const varName = match[1]
            // Add variable to keys if not already present and not a keyword
            if (!allKeys.has(varName) && !this.isJavaScriptKeyword(varName)) {
                allKeys.add(varName)
            }
        }

        const contextValues = {}
        const serializedFunctions = {}
        const rpcFunctions = []

        for (const key of allKeys) {
            const value = context[key]

            if (typeof value === 'function') {
                if (this.shouldUseRpc(key)) {
                    rpcFunctions.push(key)
                    continue
                }

                const serialized = this.serializeFunction(value)
                if (serialized) {
                    serializedFunctions[key] = serialized
                } else {
                    rpcFunctions.push(key)
                }
                continue
            }

            contextValues[key] = this.toCloneableValue(value)
        }

        return {
            template,
            contextValues,
            serializedFunctions,
            rpcFunctions
        }
    }

    shouldUseRpc(functionName) {
        return functionName === 'include' || functionName === 'includeIf'
    }

    serializeFunction(fn) {
        const source = fn.toString()
        if (!source || source.includes('[native code]')) {
            return null
        }
        return source
    }

    toCloneableValue(value) {
        if (typeof value === 'undefined') {
            return undefined
        }

        try {
            return structuredClone(value)
        } catch {
            return null
        }
    }

    async renderTemplateInWorker(payload, context) {
        let attempt = 0
        let lastError = null

        while (attempt <= this.workerRetryCount) {
            try {
                return await this.renderTemplateInWorkerAttempt(payload, context)
            } catch (error) {
                lastError = error
                if (!this.isRetryableWorkerFailure(error) || attempt >= this.workerRetryCount) {
                    throw error
                }

                // Brief delay helps avoid racing with rapid edit/write cycles.
                await new Promise((resolveDelay) => setTimeout(resolveDelay, 25 * (attempt + 1)))
                attempt++
            }
        }

        throw lastError || new Error('Template rendering failed after retries')
    }

    async renderTemplateInWorkerAttempt(payload, context) {
        return await new Promise((resolvePromise, rejectPromise) => {
            const worker = new Worker(this.workerScriptUrl, {
                type: 'module',
                workerData: payload,
                resourceLimits: {
                    maxOldGenerationSizeMb: this.workerMemoryLimitMb,
                    maxYoungGenerationSizeMb: 16
                }
            })

            let settled = false
            const timeout = setTimeout(async () => {
                await worker.terminate()
                const contextInfo = context.templatePath ? ` for template ${context.templatePath}` : ''
                const timeoutError = new Error(`Template rendering timed out after ${this.executionTimeoutMs}ms ${contextInfo}`)
                timeoutError.code = 'TEMPLATE_WORKER_TIMEOUT'
                finalizeReject(timeoutError)
            }, this.executionTimeoutMs)

            const cleanup = () => {
                clearTimeout(timeout)
                worker.removeAllListeners()
            }

            const finalizeResolve = (value) => {
                if (settled) {
                    return
                }
                settled = true
                cleanup()
                resolvePromise(value)
            }

            const finalizeReject = (error) => {
                if (settled) {
                    return
                }
                settled = true
                cleanup()
                rejectPromise(error)
            }

            worker.on('message', async (message) => {
                if (message?.type === 'rpc-request') {
                    await this.handleRpcRequest(worker, context, message)
                    return
                }

                if (message?.type === 'result') {
                    finalizeResolve(message.result)
                    return
                }

                if (message?.type === 'error') {
                    const renderingError = new Error(`Template rendering error: ${message.error}`)
                    renderingError.code = 'TEMPLATE_WORKER_RENDER_ERROR'
                    renderingError.name = message.name || renderingError.name
                    if (message.stack) {
                        renderingError.stack = message.stack
                    }
                    finalizeReject(renderingError)
                }
            })

            worker.on('error', (error) => {
                const workerError = error instanceof Error ? error : new Error(String(error))
                workerError.code = workerError.code || 'TEMPLATE_WORKER_ERROR'
                finalizeReject(workerError)
            })

            worker.on('exit', (code) => {
                if (code === 0) {
                    return
                }
                const exitError = new Error(`Template worker exited with code ${code}`)
                exitError.code = 'TEMPLATE_WORKER_EXIT'
                exitError.exitCode = code
                finalizeReject(exitError)
            })
        })
    }

    isRetryableWorkerFailure(error) {
        if (!error) {
            return false
        }

        if (error.code === 'TEMPLATE_WORKER_TIMEOUT' || error.code === 'TEMPLATE_WORKER_RENDER_ERROR') {
            return false
        }

        if (error.code === 'ERR_WORKER_OUT_OF_MEMORY' || error.code === 'TEMPLATE_WORKER_EXIT' || error.code === 'TEMPLATE_WORKER_ERROR') {
            return true
        }

        const message = error.message || ''
        return /worker exited with code|out of memory|worker thread/i.test(message)
    }

    async handleRpcRequest(worker, context, request) {
        const { id, name, args } = request
        const fn = context[name]

        if (typeof fn !== 'function') {
            worker.postMessage({
                type: 'rpc-response',
                id,
                error: `Unknown context function: ${name}`
            })
            return
        }

        try {
            const value = await fn.apply(context, args)
            worker.postMessage({ type: 'rpc-response', id, value })
        } catch (error) {
            worker.postMessage({ type: 'rpc-response', id, error: error.message })
        }
    }

    isJavaScriptKeyword(word) {
        const keywords = [
            'await', 'break', 'case', 'catch', 'class', 'const', 'continue',
            'debugger', 'default', 'delete', 'do', 'else', 'export', 'extends',
            'finally', 'for', 'function', 'if', 'import', 'in', 'instanceof',
            'let', 'new', 'return', 'super', 'switch', 'this', 'throw', 'try',
            'typeof', 'var', 'void', 'while', 'with', 'yield'
        ]
        return keywords.includes(word)
    }
}

export { TemplateEngine }

function normalizeRelative(root, filePath) {
    const rel = relative(root, filePath)
    if (rel.startsWith('..') || isAbsolute(rel)) {
        return null
    }
    return rel.replace(/\\/g, '/')
}
