# Juphjacs Quick Start Example

## 1. Create a new project

```bash
mkdir my-website
cd my-website
npm init -y
npm install juphjacs
```

## 2. Create configuration

```javascript
// site.config.mjs
export default {
    sourceFolder: './pages',
    buildFolder: './_site',
    resources: ['css', 'js', 'images'],
    plugins: []
}
```

## 3. Create server entry point

```javascript
// server.mjs
#!/usr/bin/env node
import { startServer } from 'juphjacs'
await startServer()
```

## 4. Create your first page

```html
<!-- pages/index.html -->
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>${title}</title>
    <link rel="stylesheet" href="/css/style.css">
</head>
<body>
    <h1>${heading}</h1>
    <p>${message}</p>
</body>
</html>
```

```javascript
// pages/index.mjs
import { Page } from 'juphjacs'

class IndexPage extends Page {
    constructor(pagesFolder, filePath, template, delegate) {
        super(pagesFolder, filePath, template, delegate)
        this.title = 'Welcome to Juphjacs'
        this.heading = 'Hello, World!'
        this.message = 'Your static site generator is ready!'
    }
}

export default async (pagesFolder, filePath, template, delegate) => {
    return new IndexPage(pagesFolder, filePath, template, delegate)
}
```

## 5. Add some styles

```css
/* pages/css/style.css */
body {
    font-family: system-ui, -apple-system, sans-serif;
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem;
    line-height: 1.6;
}

h1 {
    color: #2563eb;
}
```

## 6. Start the development server

```bash
node server.mjs
```

Visit **http://localhost:3000** and see your site with hot-reload!

## 7. Add a blog (Optional)

### Create blog configuration

```javascript
// site.config.mjs
export default {
    sourceFolder: './pages',
    buildFolder: './_site',
    resources: ['css', 'js', 'images'],
    plugins: [
        {
            name: 'BlogPlugin',
            path: './node_modules/juphjacs/src/application/plugins/BlogPlugin.mjs',
            options: {
                postsFolder: 'blog',
                blogIndexPath: '/blog/index.html'
            }
        }
    ]
}
```

### Create blog index page

```html
<!-- pages/blog/index.html -->
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Blog</title>
</head>
<body>
    <h1>Blog Posts</h1>
    <ul>
        ${posts.map(post => `
            <li>
                <h2><a href="${post.route}">${post.title}</a></h2>
                <time>${post.date}</time>
                <p>${post.description || ''}</p>
            </li>
        `).join('')}
    </ul>
</body>
</html>
```

### Create your first blog post

```markdown
<!-- pages/blog/2024/my-first-post.md -->
---
title: My First Blog Post
published: 2024-01-15
author: Your Name
tags: [javascript, tutorial]
---

# Welcome to My Blog

This is my first post using **Juphjacs**!

## Features I Love

- Fast hot-reload
- Simple Markdown writing
- No complex build tools
- Pure HTML/CSS/JS

Check out more at [Juphjacs](https://github.com/joeyguerra/juphjacs)!
```

## 8. Build for production

```bash
# Start server (it builds automatically)
node server.mjs

# Your static site is in _site/
# Deploy _site/ folder to any static host!
```

## Next Steps

- Read **SERVER_GUIDE.md** for architecture details
- Create custom plugins
- Add layouts and nested pages
- Deploy to Netlify, Vercel, or GitHub Pages

Happy building! 🚀
