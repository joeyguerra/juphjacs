import crypto from 'node:crypto'
import morphdom from 'morphdom'

const hash = crypto.createHash('sha256')
hash.update('hello')
const digest = hash.digest('hex')
export default {
    digest,
    morphdom
}
