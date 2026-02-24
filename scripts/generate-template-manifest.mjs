#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { createSignedTemplateManifest } from '../src/infrastructure/templates/TemplateManifest.mjs'

function parseArgs(argv) {
    const args = { root: [] }
    for (let i = 2; i < argv.length; i++) {
        const arg = argv[i]
        if (!arg.startsWith('--')) continue
        const key = arg.slice(2)
        const value = argv[i + 1]
        if (key === 'root') {
            args.root.push(value)
        } else {
            args[key] = value
        }
        i++
    }
    return args
}

const args = parseArgs(process.argv)
const trustedRoots = args.root.length ? args.root.map((root) => resolve(root)) : [resolve('./pages')]
const privateKeyPath = resolve(args.private || './.juphjacs/template-private.pem')
const manifestPath = resolve(args.out || './.juphjacs/template-manifest.json')

const privateKeyPem = await readFile(privateKeyPath, 'utf-8')
const manifest = await createSignedTemplateManifest({
    trustedRoots,
    privateKeyPem
})

await mkdir(dirname(manifestPath), { recursive: true })
await writeFile(manifestPath, JSON.stringify(manifest, null, 2))

console.log(`Manifest written: ${manifestPath}`)
console.log(`Entries: ${Object.keys(manifest.files).length}`)
