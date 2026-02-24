import { createHash, sign, verify } from 'node:crypto'
import { opendir, readFile } from 'node:fs/promises'
import { extname, relative, resolve } from 'node:path'

const DEFAULT_EXTENSIONS = new Set(['.html', '.xml', '.md'])

function normalizeRelativePath(value) {
    return value.replace(/\\/g, '/')
}

async function *readAllFiles(folder) {
    const dir = await opendir(folder)
    for await (const dirent of dir) {
        const entryPath = resolve(folder, dirent.name)
        if (dirent.isDirectory()) {
            yield *readAllFiles(entryPath)
            continue
        }
        yield entryPath
    }
}

function sha256(content) {
    return createHash('sha256').update(content).digest('hex')
}

function canonicalizeManifestPayload(payload) {
    const sortedFiles = Object.keys(payload.files || {})
        .sort((a, b) => a.localeCompare(b))
        .reduce((acc, key) => {
            acc[key] = payload.files[key]
            return acc
        }, {})

    return JSON.stringify({
        version: payload.version,
        hashAlgorithm: payload.hashAlgorithm,
        files: sortedFiles
    })
}

async function buildTemplateHashMap(trustedRoots, allowedExtensions = DEFAULT_EXTENSIONS) {
    const roots = trustedRoots.map((root) => resolve(root))
    const files = {}
    const extensionSet = new Set([...allowedExtensions].map((ext) => ext.toLowerCase()))

    for (const root of roots) {
        for await (const filePath of readAllFiles(root)) {
            const ext = extname(filePath).toLowerCase()
            if (!extensionSet.has(ext)) {
                continue
            }

            const rel = normalizeRelativePath(relative(root, filePath))
            if (rel.startsWith('..')) {
                continue
            }

            if (files[rel]) {
                throw new Error(`Duplicate template path in manifest roots: ${rel}`)
            }

            const content = await readFile(filePath, 'utf-8')
            files[rel] = sha256(content)
        }
    }

    return files
}

function signTemplateManifest(payload, privateKeyPem) {
    const canonical = canonicalizeManifestPayload(payload)
    return sign(null, Buffer.from(canonical, 'utf-8'), privateKeyPem).toString('base64')
}

function verifyTemplateManifestSignature(payload, signatureBase64, publicKeyPem) {
    const canonical = canonicalizeManifestPayload(payload)
    return verify(
        null,
        Buffer.from(canonical, 'utf-8'),
        publicKeyPem,
        Buffer.from(signatureBase64, 'base64')
    )
}

async function createSignedTemplateManifest({ trustedRoots, privateKeyPem, allowedExtensions = DEFAULT_EXTENSIONS }) {
    const files = await buildTemplateHashMap(trustedRoots, allowedExtensions)
    const payload = {
        version: 1,
        hashAlgorithm: 'sha256',
        files
    }
    const signature = signTemplateManifest(payload, privateKeyPem)
    return { ...payload, signature }
}

export {
    DEFAULT_EXTENSIONS,
    buildTemplateHashMap,
    canonicalizeManifestPayload,
    createSignedTemplateManifest,
    signTemplateManifest,
    verifyTemplateManifestSignature
}
