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

Create websites with fast feedback with your code to the left (or right) and a browser to the right (or left). As you edit the code, the page updates, reflecting the changes (Hot Reload).

- Use HTML or Markdown documents.
- Write vanilla JavaScript and CSS.
- Generates a static site under `_site`.
- Pages can have corresponding `.mjs` files that export a class extending `Page`
- Template literals (`${variable}`) are rendered server-side
- Hot-reload via WebSocket (full reload for HTML/JS, CSS-only for styles)
- Plugin system for extensibility (BlogPlugin included)
- Configuration-driven setup with `site.config.mjs`

**📖 See [SERVER_GUIDE.md](./SERVER_GUIDE.md) for architecture details!**

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

- **Hot Reload**: Automatic page updates via WebSocket (full reload for HTML/JS, CSS-only for styles)
- **Plugin System**: Extend functionality with custom plugins (BlogPlugin included)
- **Template Engine**: Server-side template literal rendering
- **Static Generation**: Build optimized static sites for deployment
- **Markdown Support**: Write content in Markdown with YAML frontmatter
- **Configuration-Driven**: Flexible `site.config.mjs` configuration

**📖 See [SERVER_GUIDE.md](./SERVER_GUIDE.md) for architecture details!**

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

The server will build your site from `pages/` to `_site/` and start watching for changes with hot-reload at `http://localhost:3000`.

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
- HTML/JS changes trigger full page reload with WebSocket notification

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

# API Reference

```javascript
import {
    // Development Server
    startServer,                    // Quick start development server
    JuphjacsDevelopmentServer,     // Full control over dev server
    
    // Core
    SiteGenerator,                  // Static site generation
    Page,                          // Base class for pages
    
    // Plugins
    PluginManager,                 // Manage plugins
    Plugin,                        // Base class for plugins
    BlogPlugin,                    // Built-in blog functionality
    
    // Configuration
    ConfigLoader                   // Load site.config.mjs
} from 'juphjacs'

// Quick start
await startServer()

// Custom server
const server = new JuphjacsDevelopmentServer({ debug: true })
await server.initialize()
await server.startDevServer(3000)

// Access Socket.IO server for custom namespaces
const chatNamespace = server.socketServer.of('/chat')
chatNamespace.on('connection', (socket) => {
    socket.on('message', (msg) => {
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

**📖 See [SERVER_GUIDE.md](./SERVER_GUIDE.md) for complete WebSocket examples!**

````
```
