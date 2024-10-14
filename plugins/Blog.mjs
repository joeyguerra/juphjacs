
import { EVENTS } from '../server.mjs'
import { Template } from '../src/Template.mjs'

class Post {
    constructor(title, date, excerpt, slug, link) {
        this.title = title
        this.date = date
        this.excerpt = excerpt
        this.slug = slug
        this.link = link
    }
}

const posts = new Set()

export default async () => {
    const blogIndex = {
        filePath: '',
        context: {posts: []}
    }
    process.on(EVENTS.TEMPLATE_RENDERED, async (filePath, context, output) => {
        if (filePath.includes('/blog/index.html')) {
            blogIndex.filePath = filePath
            blogIndex.context = context
        }
        const regex = /\/blog\/(?<year>\d{4})\/(?<slug>[^.]+)(?<!\.html|\.md)/ig
        if (/\/blog\/\d+/i.test(filePath)) {
            const match = regex.exec(filePath)
            const { year, slug } = match.groups
            const link = `/blog/${year}/${slug}.html`
            const post = new Post(context.title, new Date(year), context.excerpt, slug, link)
            posts.add(post)
            blogIndex.context.posts.push(post)
        }
    })

    process.on(EVENTS.PRE_TEMPLATE_RENDER, async (filePath, initialContext, content) => {
        if (filePath.includes('/blog/index.html')) {
            initialContext.posts = blogIndex.context.posts
            initialContext.postsSet = posts
        }
    })
}