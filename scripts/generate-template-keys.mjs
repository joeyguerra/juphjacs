#!/usr/bin/env node
import { generateKeyPairSync } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

function parseArgs(argv) {
    const args = {}
    for (let i = 2; i < argv.length; i++) {
        const arg = argv[i]
        if (!arg.startsWith('--')) continue
        const key = arg.slice(2)
        const value = argv[i + 1]
        args[key] = value
        i++
    }
    return args
}

const args = parseArgs(process.argv)
const privateKeyPath = resolve(args.private || './.juphjacs/template-private.pem')
const publicKeyPath = resolve(args.public || './.juphjacs/template-public.pem')

const { privateKey, publicKey } = generateKeyPairSync('ed25519', {
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' }
})

await mkdir(dirname(privateKeyPath), { recursive: true })
await mkdir(dirname(publicKeyPath), { recursive: true })
await writeFile(privateKeyPath, privateKey, { mode: 0o600 })
await writeFile(publicKeyPath, publicKey, { mode: 0o644 })

console.log(`Private key: ${privateKeyPath}`)
console.log(`Public key: ${publicKeyPath}`)
