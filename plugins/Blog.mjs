
import { EVENTS } from '../src/Page.mjs'
import { sep } from 'node:path'

class Post {
    constructor(title, date, excerpt, slug, link, published, tags, image, shouldPublish) {
        this.title = title
        this.date = date
        this.excerpt = excerpt
        this.slug = slug
        this.link = link
        this.published = published
        this.tags = tags
        this.image = image
        this.shouldPublish = shouldPublish
    }
}

const posts = new Set()

export default async () => {
    const blogIndex = {
        filePath: '',
        page: {posts: []},
        context: {}
    }
    process.on(EVENTS.TEMPLATE_RENDERED, async (filePath, page) => {
        if (filePath.includes(`${sep}blog${sep}index.html`)) {
            blogIndex.filePath = filePath
            Object.keys(page).forEach(key => {
                blogIndex.context[key] = page[key]
            })
        }
        const regex = /\/blog\/(?<year>\d{4})\/(?<slug>[^.]+)(?<!\.html|\.md)/ig
        if (/\/blog\/\d+/i.test(filePath)) {
            const match = regex.exec(filePath)
            const { year, slug } = match.groups
            const link = `/blog/${year}/${slug}.html`
            const post = new Post(page.title, new Date(year), page.excerpt,
                slug, link, page.published, page.tags, page.image, page.shouldPublish)
            if (post.shouldPublish === true) {
                posts.add(post)
            }
        }
    })

    process.on(EVENTS.PRE_TEMPLATE_RENDER, async (filePath, page) => {
        if (filePath.includes(`${sep}blog${sep}index.html`)) {
            page.postsSet = posts
        }
    })
}