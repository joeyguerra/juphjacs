# How to Use Juphjacs - Complete Guide

## Quick Start (30 seconds)

### 1. Start the Development Server

```bash
node server.mjs
```

That's it! Your site is now running at **http://localhost:3000** with hot-reload enabled.

---

## Creating Your First Page

### Basic HTML Page

Create a file in `pages/`:

```html
<!-- pages/about.html -->
<!DOCTYPE html>
<html>
<head>
    <title>About Us</title>
</head>
<body>
    <h1>About Our Company</h1>
    <p>We build amazing things!</p>
</body>
</html>
```

Visit: **http://localhost:3000/about.html**

---

## Adding Dynamic Content

### Create a Page with Template Variables

```html
<!-- pages/about.html -->
<!DOCTYPE html>
<html>
<head>
    <title>${title}</title>
</head>
<body>
    <h1>${heading}</h1>
    <p>${description}</p>
    <ul>
        ${items.map(item => `<li>${item}</li>`).join('')}
    </ul>
</body>
</html>
```

### Add Page Logic

```javascript
// pages/about.mjs
import { Page } from 'juphjacs'

class AboutPage extends Page {
    constructor(pagesFolder, filePath, template, delegate) {
        super(pagesFolder, filePath, template, delegate)
        
        // Set data for template
        this.title = 'About Us'
        this.heading = 'Welcome to Our Site'
        this.description = 'We make awesome stuff!'
        this.items = ['Item 1', 'Item 2', 'Item 3']
    }
}

export default async (pagesFolder, filePath, template, delegate) => {
    return new AboutPage(pagesFolder, filePath, template, delegate)
}
```

The server automatically injects `${title}`, `${heading}`, etc. into your HTML!

---

## Using Layouts

### Create a Layout

```html
<!-- pages/layout.html -->
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>${title} - My Site</title>
    <link rel="stylesheet" href="/css/style.css">
</head>
<body>
    <nav>
        <a href="/">Home</a>
        <a href="/about.html">About</a>
        <a href="/blog">Blog</a>
    </nav>
    
    <main>
        ${body}
    </main>
    
    <footer>
        <p>&copy; 2024 My Website</p>
    </footer>
</body>
</html>
```

### Use Layout in Your Page

```javascript
// pages/about.mjs
class AboutPage extends Page {
    constructor(pagesFolder, filePath, template, delegate) {
        super(pagesFolder, filePath, template, delegate)
        this.title = 'About'
        this.layout = './pages/layout.html'  // ← Use layout!
    }
}
```

Now your `about.html` content will be wrapped in the layout!

---

## Writing Blog Posts in Markdown

### 1. Configure BlogPlugin

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

### 2. Create a Blog Post

```markdown
<!-- pages/blog/2024/my-first-post.md -->
---
title: My First Blog Post
date: 2024-01-15
author: Your Name
tags: [javascript, tutorial]
layout: ./pages/layout.html
shouldPublish: true
---

# Hello World!

This is my first post using **Juphjacs**.

## Features I Love

- Fast hot-reload
- Simple Markdown writing  
- No complex build tools

\`\`\`javascript
console.log('Code blocks work too!')
\`\`\`
```

### 3. Create Blog Index Page

```html
<!-- pages/blog/index.html -->
<h1>My Blog</h1>

<div class="posts">
    ${posts.map(post => `
        <article>
            <h2><a href="${post.route}">${post.title}</a></h2>
            <time>${post.date}</time>
            <p>${post.description || ''}</p>
            <div class="tags">
                ${post.tags ? post.tags.map(tag => `<span class="tag">${tag}</span>`).join('') : ''}
            </div>
        </article>
    `).join('')}
</div>
```

```javascript
// pages/blog/index.mjs
import { Page } from 'juphjacs'

class BlogIndexPage extends Page {
    constructor(pagesFolder, filePath, template, delegate) {
        super(pagesFolder, filePath, template, delegate)
        this.title = 'Blog'
        this.layout = './pages/layout.html'
        // posts will be injected by BlogPlugin
    }
}

export default async (pagesFolder, filePath, template, delegate) => {
    return new BlogIndexPage(pagesFolder, filePath, template, delegate)
}
```

Visit: **http://localhost:3000/blog/index.html**

---

## Handling Forms and POST Requests

### Create a Contact Form

```html
<!-- pages/contact.html -->
<h1>Contact Us</h1>

${message ? `<p class="success">${message}</p>` : ''}

<form method="POST" action="/contact.html">
    <input type="text" name="name" placeholder="Your Name" required>
    <input type="email" name="email" placeholder="Your Email" required>
    <textarea name="message" placeholder="Your Message" required></textarea>
    <button type="submit">Send</button>
</form>
```

### Handle the POST Request

```javascript
// pages/contact.mjs
import { Page } from 'juphjacs'

class ContactPage extends Page {
    constructor(pagesFolder, filePath, template, delegate) {
        super(pagesFolder, filePath, template, delegate)
        this.title = 'Contact'
        this.layout = './pages/layout.html'
        this.message = null
    }
    
    async get(req, res) {
        await this.render()
        res.setHeader('Content-Type', 'text/html')
        res.end(this.content)
    }
    
    async post(req, res) {
        // Modern Fetch API - automatically available!
        const formData = await req.formData()
        
        const name = formData.fields.name
        const email = formData.fields.email
        const message = formData.fields.message
        
        // Process the form (send email, save to DB, etc.)
        console.log('Form submitted:', { name, email, message })
        
        // Show success message
        this.message = 'Thanks! We received your message.'
        
        await this.render()
        res.setHeader('Content-Type', 'text/html')
        res.end(this.content)
    }
}

export default async (pagesFolder, filePath, template, delegate) => {
    return new ContactPage(pagesFolder, filePath, template, delegate)
}
```

**Note:** The DevServer now uses FetchApi, so you get modern methods like:
- `await req.json()` - Parse JSON body
- `await req.formData()` - Parse form data
- `await req.text()` - Get raw text

---

## Adding Styles and JavaScript

### Create CSS

```css
/* pages/css/style.css */
body {
    font-family: system-ui, sans-serif;
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem;
    line-height: 1.6;
}

h1 {
    color: #2563eb;
}

nav a {
    margin-right: 1rem;
    text-decoration: none;
    color: #4b5563;
}

nav a:hover {
    color: #2563eb;
}
```

### Add Client-Side JavaScript

```javascript
// pages/js/app.js
console.log('Site loaded!')

// Add interactivity
document.addEventListener('DOMContentLoaded', () => {
    const nav = document.querySelector('nav')
    if (nav) {
        console.log('Navigation ready')
    }
})
```

Reference in your layout:

```html
<link rel="stylesheet" href="/css/style.css">
<script src="/js/app.js" defer></script>
```

---

## Hot Reload Features

The server automatically watches for changes:

### ✅ CSS Changes
- **Hot-reloads styles** without full page refresh
- Styles update instantly while you edit

### ✅ HTML/Markdown Changes
- **Full page reload** with new content
- Changes appear immediately

### ✅ JavaScript Changes
- **Full page reload** to ensure consistency
- New code loads automatically

---

## Project Structure Example

```
my-site/
├── site.config.mjs          # Configuration
├── server.mjs                # Start script
├── pages/                    # Your content
│   ├── layout.html          # Main layout
│   ├── index.html           # Homepage
│   ├── index.mjs            # Homepage logic
│   ├── about.html
│   ├── about.mjs
│   ├── contact.html
│   ├── contact.mjs
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   └── app.js
│   ├── images/
│   │   └── logo.svg
│   └── blog/
│       ├── index.html       # Blog listing
│       ├── index.mjs
│       └── 2024/
│           ├── post-1.md
│           └── post-2.md
└── _site/                    # Generated (auto-created)
    ├── index.html
    ├── about.html
    ├── contact.html
    ├── css/
    ├── js/
    └── blog/
```

---

## Common Tasks

### 1. Add a New Page

```bash
# Create HTML
touch pages/services.html

# (Optional) Add logic
touch pages/services.mjs
```

Visit: **http://localhost:3000/services.html**

### 2. Add a New Blog Post

```bash
touch pages/blog/2024/new-post.md
```

Add frontmatter and content - it auto-appears in blog index!

### 3. Change Port

```bash
PORT=8080 node server.mjs
```

### 4. Enable Debug Logging

```bash
LOG_LEVEL=debug node server.mjs
```

### 5. Build for Production

Just run the server - it builds to `_site/`:

```bash
node server.mjs
```

Then deploy the `_site/` folder to any static host:

```bash
# Netlify
netlify deploy --dir=_site

# Vercel  
vercel --prod _site

# Or just copy to your web server
rsync -av _site/ user@server:/var/www/html/
```

---

## Advanced: API Endpoints

Create JSON API endpoints:

```javascript
// pages/api/users.mjs
import { Page } from 'juphjacs'

class UsersAPI extends Page {
    constructor(pagesFolder, filePath, template, delegate) {
        super(pagesFolder, filePath, template, delegate)
    }
    
    async get(req, res) {
        const users = [
            { id: 1, name: 'Alice' },
            { id: 2, name: 'Bob' }
        ]
        
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(users))
    }
    
    async post(req, res) {
        const newUser = await req.json()
        
        // Process new user...
        
        res.setHeader('Content-Type', 'application/json')
        res.statusCode = 201
        res.end(JSON.stringify({ id: 3, ...newUser }))
    }
}

export default async (pagesFolder, filePath, template, delegate) => {
    return new UsersAPI(pagesFolder, filePath, template, delegate)
}
```

No HTML file needed for APIs!

---

## Tips & Tricks

### 1. Template Expressions

You can use JavaScript expressions in templates:

```html
<p>Today is: ${new Date().toLocaleDateString()}</p>
<p>Random: ${Math.random()}</p>
<p>Uppercase: ${'hello'.toUpperCase()}</p>
```

### 2. Conditional Rendering

```html
${user ? `<p>Welcome, ${user.name}!</p>` : '<p>Please log in</p>'}
```

### 3. Include Partials

```javascript
// In your Page class
async get(req, res) {
    const header = await this.include('partials/header.html')
    // Use header in your template
    await this.render()
    res.end(this.content)
}
```

### 4. Custom Routes

```javascript
import { UriToStaticFileRoute } from 'juphjacs'

class MyPage extends Page {
    constructor(pagesFolder, filePath, template, delegate) {
        super(pagesFolder, filePath, template, delegate)
        
        // Custom route pattern
        this.route = new UriToStaticFileRoute('/custom-url', filePath)
    }
}
```

---

## Getting Help

- **Docs**: Check `USAGE_GUIDE.md` for complete API reference
- **Examples**: Look at files in `test/html/` for working examples
- **Architecture**: Read `DEVSERVER_GUIDE.md` for how it works

---

## Next Steps

1. ✅ **Start the server**: `node server.mjs`
2. ✅ **Create a page**: Add `pages/test.html`
3. ✅ **Add some styles**: Create `pages/css/style.css`
4. ✅ **Write a blog post**: Add `pages/blog/2024/first.md`
5. ✅ **Deploy**: Copy `_site/` to your host

**Happy building!** 🚀
