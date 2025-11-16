```ascii
       __   __    __  .______    __    __         __       ___       ______     _______.
      |  | |  |  |  | |   _  \  |  |  |  |       |  |     /   \     /      |   /       |
      |  | |  |  |  | |  |_)  | |  |__|  |       |  |    /  ^  \   |  ,----'  |   (----`
.--.  |  | |  |  |  | |   ___/  |   __   | .--.  |  |   /  /_\  \  |  |        \   \    
|  `--'  | |  `--'  | |  |      |  |  |  | |  `--'  |  /  _____  \ |  `----.----)   |   
 \______/   \______/  | _|      |__|  |__|  \______/  /__/     \__\ \______|_______/    
                                                                                    
```

# Just Use Plain Html, Javascript, and CSS; Stupid.

## A web site framework

Create websites with fast feedback with your code to the left (or right) and a browser to the right (or left). As you edit the code, the page updates, reflecting the changes via strategy-driven hot reload.

- Use HTML or Markdown documents.
- Write vanilla JavaScript and CSS.
- Generates a static site under `_site`.
- Pages can have corresponding `.mjs` files that export a class extending `Page`
- Template literals (`${variable}`) are rendered server-side
- Hot-reload via WebSocket
    - DOM morph for HTML and Markdown
    - CSS-only for styles
    - Full reload for JavaScript
- Plugin system for extensibility (BlogPlugin included)
- Configuration-driven setup with `site.config.mjs`

**📖 See [SERVER_GUIDE.md](./SERVER_GUIDE.md) and [ARCHITECTURE.md](./ARCHITECTURE.md) for architecture details**

The name is a play on the KISS Principle (Keep It Simple Stupid). It's super hard to keep things simple, the name is a reminder to keep trying.

# Target Audience(s)

- **Learning web development basics** - Use this tool to quickly build web pages with a short feedback loop. Code HTML and instantly see results. Perfect for learning JavaScript with fast iteration.
- **Building websites without frameworks** - Build websites with vanilla HTML, JavaScript and CSS, no heavy frameworks required.
- **Modern static site generation** - Generate optimized static sites with hot-reload during development.
- **Content-focused sites** - Perfect for blogs, documentation, portfolios with Markdown support and plugin system.

# Architecture

## Modern Clean Architecture (Domain-Driven Design)

The framework follows DDD principles with clear layer separation:

- **Application Layer**: DevServer, SiteGenerator, ConfigLoader, PluginManager
- **Domain Layer**: Page, PageRepository
- **Infrastructure Layer**: Markdown parsing, Template rendering, Hot-reload, File watching

## Key Features

- **Hot Reload**: Strategy-driven updates via WebSocket
    - DOM morph for HTML and Markdown
    - CSS-only for styles
    - Full reload for JavaScript
- **Plugin System**: Extend functionality with custom plugins (BlogPlugin included)
- **Template Engine**: Server-side template literal rendering
- **Static Generation**: Build optimized static sites for deployment
- **Markdown Support**: Write content in Markdown with YAML frontmatter
- **Configuration-Driven**: Flexible `site.config.mjs` configuration

**📖 See [SERVER_GUIDE.md](./SERVER_GUIDE.md) and [HOTRELOAD_ARCHITECTURE.md](./HOTRELOAD_ARCHITECTURE.md) for more**

# Why?

I built this framework because I wanted the run-time performance of a static site, with a delightful developer experience - fast feedback loops - while also staying close to the browser API, as opposed to what libraries like React do; JSX, more tooling and compile steps.

Am I re-inventing the wheel here? Are there any other frameworks on the web that have similar strategies and values?

> Similar philosophies exist, but this blend (static-first + page object methods + DOM morph hot reload + raw browser APIs) is still a distinct niche.

## Closest related approaches (and differences) as of 2025-11-15:

- **Eleventy / Jekyll / Hugo**: static generation only, no runtime page methods or websocket DOM morphing
- **Astro**: static + islands; still component/domain specific, not plain HTML + page object methods
- **Vite / Parcel dev servers**: fast HMR, but module/component oriented, not HTML diff morphing at page level
- **Hotwire / Turbo / Unpoly / htmx**: partial HTML replacement over HTTP, but generally request/response initiated by client, not server‑pushed morph diffs on file change
- **htmx + a static generator**: could approximate pieces, but you'd hand-roll integration
- **Remix / Next.js / SvelteKit / Nuxt**: route modules with server methods (loaders/actions), but tie you into a full SSR/component abstraction
- **Fresh (Deno)**: islands + server rendering, but still JSX/components
- **Phoenix LiveView / Laravel Livewire**: stateful socket updates to DOM, but framework-managed diffing with server state - not plain file content morphing after static regen
- **VitePress / Docusaurus**: markdown → static site with dev server, no dynamic per‑page HTTP verbs
- **htmx + a static generator**: could approximate pieces, but you'd hand-roll integration

## What’s distinct in this system:

- **Page object** get/post/put/delete directly, without heavier routing abstractions
- **Static build artifacts** plus selective dynamic method execution without adopting a component DSL
- **DOM morphing** of regenerated HTML on file change (server push) instead of full reload or client-driven partial fetch
- **User context injection** (db, io, websocket) while keeping pages **template-centric**
- Explicit **hot reload** strategies per asset type

It's in the ‘HTML-first, progressive enhancement, fast feedback’ space—adjacent to Hotwire/htmx + Eleventy — but more opinionated about the dev ergonomics (automatic DOM morph on save, websocket layer exposed, page object methods).

# Quick Start

Use the latest version of [Node.js](https://nodejs.org). As of writing, it's `v24.6.0`.

## Installation

```sh
npm install juphjacs
```

## Start Development Server

```sh
# Start the dev server
npm start

# With debugging
LOG_LEVEL=debug npm start

# Custom port
PORT=8080 npm start
```

The server builds your site from `pages/` to `_site/` and watches for changes with hot-reload at `http://localhost:3000`.

## Configuration

Create a `site.config.mjs` in your project root:

```javascript
export default {
    sourceFolder: './pages',
    buildFolder: './_site',
    resources: ['css', 'js', 'images'],
    plugins: []
}
```

# License

[MIT](https://opensource.org/license/MIT)

# App Design Goals

## Be Fast

Requests load static HTML pages generated at build time. The development server watches for changes and regenerates on the fly with hot-reload.

## Short Developer Feedback Loop

- File change detected → Static file regenerated → Browser updated instantly
- CSS changes reload styles only (no full page refresh)
- HTML/Markdown changes morph the DOM without a full reload
- JavaScript changes trigger a full page reload

## Plugin Architecture

Extend functionality with custom plugins:

```javascript
import { Plugin } from 'juphjacs'

class MyPlugin extends Plugin {
    async onContentLoaded(pages, context) {
        // Modify content before rendering
    }
    
    async onPageRendered(page, context) {
        // Post-process rendered pages
    }
}
```

## Creating Pages

### Simple HTML Page

```html
<!-- pages/index.html -->
<!DOCTYPE html>
<html>
<head>
    <title>${title}</title>
</head>
<body>
    <h1>${heading}</h1>
</body>
</html>
```

### With Page Logic

```javascript
// pages/index.mjs
import { Page } from 'juphjacs'

class IndexPage extends Page {
    constructor(pagesFolder, filePath, template, context = {}) {
        super(pagesFolder, filePath, template, context)
        this.title = 'My Site'
        this.heading = 'Welcome!'
        this.layout = './pages/layout.html'
    }
    
    async get(req, res) {
        await this.render()
        res.setHeader('Content-Type', 'text/html')
        res.end(this.content)
    }
}

export default async (pagesFolder, filePath, template, context = {}) => {
    return new IndexPage(pagesFolder, filePath, template, context)
}
```

### Markdown Blog Posts

```markdown
---
title: My First Post
published: 2024-01-15
layout: ./pages/blog/layout.html
---

# Hello World

Write your content in Markdown!
```

# Architecture

## Layers and Components

- Application: `WebServer`, `SiteGenerator`, `ConfigLoader`, `PluginManager`
- Domain: `Page`, `PageRepository`
- Infrastructure: Markdown, Templates, FileWatcher, HotReloadSocketServer
- Policy: `AssetPolicy` (asset classification, processing rules, HMR strategy), `PathPolicy` (include/ignore/layout)
- HTTP Handlers: `FrameworkResourceHandler`, `DynamicPageHandler`, `StaticPageHandler`, `StaticAssetHandler`, `ErrorHandler` composed via `RequestHandlerChain`

See `ARCHITECTURE.md` for details

# API Reference

```javascript
import {
    startServer,
    JuphjacWebServer,
    SiteGenerator,
    Page,
    PluginManager,
    Plugin,
    BlogPlugin,
    ConfigLoader
} from 'juphjacs'

// Quick start server
await startServer()

// Custom server
const server = new JuphjacWebServer({ logLevel: 'info' })
await server.initialize()
await server.start(3000)

// Access Socket.IO server for custom namespaces
const chatNamespace = server.socketServer.of('/chat')
chatNamespace.on('connection', socket => {
    socket.on('message', msg => {
        chatNamespace.emit('message', msg)
    })
})
```

## WebSocket / Socket.IO Access

The framework provides both a convenient WebSocket wrapper and direct access to the Socket.IO server:

```javascript
const server = new JuphjacWebServer({
    rootDir: process.cwd(),
    context: {
        db: myDatabase,
        logger: myLogger
    }
})

await server.initialize()
await server.start(3000)

// Direct Socket.IO access for custom namespaces
const chatNS = server.socketServer.of('/chat')
chatNS.on('connection', (socket) => {
    console.log('User connected to chat')
    
    socket.on('message', (data) => {
        chatNS.emit('message', data)
    })
})
```

Pages can access both the WebSocket wrapper and raw Socket.IO server via context:

```javascript
// pages/chat.mjs
export default function(sourceFolder, filePath, template, context = {}) {
    return {
        io: context.io,              // Raw Socket.IO server
        websocket: context.websocket, // Convenience wrapper
        
        post(req, res) {
            // Use the wrapper for simple broadcasts
            this.websocket.broadcast('notification', { message: 'Hello!' })
            
            // Or use Socket.IO directly for advanced features
            const chatRoom = this.io.of('/chat')
            chatRoom.to('room1').emit('message', { text: 'Hi room 1!' })
        }
    }
}
```

**📖 See [SERVER_GUIDE.md](./SERVER_GUIDE.md) for complete WebSocket examples**

````
```
