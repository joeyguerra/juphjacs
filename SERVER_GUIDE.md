# Juphjacs - Server Guide

## Quick Start

### Using the server

```bash
npm start
# or
node server.mjs
```

The server will:
- Load your `site.config.mjs` configuration
- Build your site from the `pages/` directory

Create a `site.config.mjs` file (see `site.config.example.mjs` for a template):

```javascript
import { BlogPlugin } from './src/application/plugins/BlogPlugin.mjs'
import { join } from 'node:path'

export default {
    siteName: 'My Site',
    siteUrl: 'https://example.com',
    pagesDir: join(process.cwd(), 'pages'),
    buildDir: join(process.cwd(), '_site'),
    resources: ['css', 'js', 'images'],
    port: 3000,
    plugins: [
        {
            name: 'BlogPlugin',
        }
    ]
}
```

## Architecture Overview

The refactored Juphjacs follows Domain-Driven Design principles:

### Domain Layer (`src/domain/`)
- **Page**: Represents a page entity with metadata, content, and routing information
- **PageRepository**: Manages the collection of pages, provides querying capabilities

### Application Layer (`src/application/`)
- **WebServer**: Development server with hot-reload, HTTP handling, and orchestration
- **SiteGenerator**: Orchestrates the build process, coordinates plugins and infrastructure
- **PluginManager**: Manages plugin lifecycle and hooks
- **Plugin**: Base class for creating plugins
- **ConfigLoader**: Loads and validates site configuration

### Infrastructure Layer (`src/infrastructure/`)
- **MarkdownParser**: Parses markdown files with YAML frontmatter
- **TemplateEngine**: Renders template literals with proper escaping
- **FileWatcher**: Watches for file changes (uses chokidar)
- **HotReloadSocketServer**: WebSocket server for hot-reload (uses socket.io)

### Policy Layer (`src/policy/`)
- **PathPolicy**: include/ignore patterns and layout detection
- **AssetPolicy**: asset classification, processing rules, and HMR strategy

### HTTP Handling (`src/infrastructure/http/`)
- **RequestHandlerChain**: Chains handlers to process requests
- **FrameworkResourceHandler**: Serves `/__juphjacs__/*` framework resources
- **DynamicPageHandler**: Executes page object methods for dynamic routes
- **StaticPageHandler**: Serves generated HTML from `_site`
- **StaticAssetHandler**: Serves static assets with correct MIME types
- **ErrorHandler**: Terminal handler producing 4xx/5xx responses

## Plugin System

### Built-in Plugins

#### BlogPlugin
Automatically collects and manages blog posts:

```javascript
{
    name: 'BlogPlugin',
    path: './src/application/plugins/BlogPlugin.mjs',
    options: {
        blogPath: '/blog',              // Path to blog posts
        blogIndexPath: '/blog/index.html',  // Blog index page (optional)
        dateFormat: 'iso'               // Date format
    }
}
```

Blog posts should follow this structure:
```
pages/
  blog/
    YYYY/
      post-slug.md
```

Frontmatter example:
```markdown
---
title: My Post Title
published: 2024-01-15
excerpt: A short description
tags: [javascript, node]
---

# Post content here
```

### Creating Custom Plugins

Extend the `Plugin` base class and implement lifecycle hooks:

```javascript
import { Plugin } from './src/application/plugins/Plugin.mjs'

class MyPlugin extends Plugin {
    constructor(options = {}) {
        super('MyPlugin')
        this.options = options
    }

    // Called when site generator initializes
    async onInit(data) {
        console.log('Plugin initialized')
        return data
    }

    // Called after all content is loaded
    async onContentLoaded(data) {
        // data.pages contains all pages
        return data
    }

    // Called when a page is rendered
    async onPageRendered(data) {
        // data.page is the rendered page
        // data.context is the template context
        return data
    }

    // Called after the build is complete
    async onBuildComplete(data) {
        console.log('Build complete')
        return data
    }
}

export { MyPlugin }
```

## File Processing

### Automatic path filtering

The `PathPolicy` automatically skips:
- `node_modules/`
- Hidden files (`.git/`, `.DS_Store`, `.env`)
- Build directories (`_site/`, `dist/`, `build/`)
- Lock files (`package-lock.json`, `yarn.lock`)
- Log files (`*.log`)

### File Type Detection

Files are processed based on type:
- **HTML/Markdown**: Template rendering + markdown processing
- **CSS/JS**: Copied as-is, triggers CSS-only reload
- **Assets** (images, fonts): Copied as-is
- **Data** (JSON): Copied as-is

Custom filtering is currently managed internally by `PathPolicy` defaults

## Hot Reload

The development server provides strategy-driven hot reload:

- **HTML/Markdown changes**: DOM morph without a full reload
- **CSS changes**: CSS-only reload (no page refresh)
- **JavaScript changes**: Full page reload
- **Asset changes**: No reload by default

Under the hood, the server determines `{ assetType, hmrStrategy }` via `AssetPolicy.getMeta(filePath)` and sends `file-changed` events including these fields. The client `HotReloader` executes the appropriate strategy.

Hot-reload script is automatically injected into HTML pages.

## API Reference

### JuphjacWebServer

```javascript
import { JuphjacWebServer } from './index.mjs'

const server = new JuphjacWebServer({
    debug: true,
    rootDir: process.cwd()
})

await server.initialize()
await server.start(3000)

// Later...
await server.stop()
```

### Passing Context to Pages

You can inject dependencies (database, services, etc.) into your page objects using the `context` option:

```javascript
import { JuphjacWebServer } from './index.mjs'
import { createDatabase } from './database.mjs'

// Initialize your services
const db = await createDatabase()
const logger = createLogger()
const cache = new CacheService()

const server = new JuphjacWebServer({
    rootDir: process.cwd(),
    context: {
        db,           // Database connection
        logger,       // Logger instance
        cache,        // Cache service
        config: myAppConfig,  // App configuration
        // ... any other services
    }
})

await server.initialize()
await server.start(3000)
```

**Page Implementation:**

Your page factory function receives the context as a 4th parameter:

```javascript
// pages/users.mjs
export default async function createPage(sourceFolder, filePath, template, context = {}) {
    return new UsersPage(template, context)
}

class UsersPage {
    constructor(template, context) {
        this.template = template
        this.db = context.db
        this.logger = context.logger
    }
    
    async get(req, res) {
        // Use injected dependencies
        const users = await this.db.users.findAll()
        this.logger.info('Users page accessed')
        
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ users }))
    }
    
    async post(req, res) {
        const user = await this.db.users.create(req.body)
        this.logger.info(`Created user: ${user.email}`)
        
        res.writeHead(201, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ user }))
    }
}
```

**Benefits:**
- ✅ Clean dependency injection
- ✅ Easy to test (mock context)
- ✅ Type-safe if using TypeScript
- ✅ No global state
- ✅ Explicit dependencies

**WebSocket Access:**

The hot-reload WebSocket server (`HotReloadSocketServer`) is automatically added to the context as `context.websocket`. This provides convenient methods for page hot-reloading and simple broadcasts:

```javascript
// pages/chat.mjs
export default async function createPage(sourceFolder, filePath, template, context = {}) {
    return new ChatPage(template, context)
}

class ChatPage {
    constructor(template, context) {
        this.template = template
        this.db = context.db
        this.websocket = context.websocket  // Hot-reload WebSocket server
    }
    
    async post(req, res) {
        const message = await req.json()
        
        // Save to database
        await this.db.messages.create(message)
        
        // Broadcast to all connected clients (uses /hot-reload namespace)
        this.websocket.broadcast('chat:message', {
            user: message.user,
            text: message.text,
            timestamp: new Date()
        })
        
        res.writeHead(201, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: true }))
    }
    
    async get(req, res) {
        // Send notification to specific client
        const messages = await this.db.messages.findAll()
        
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ messages }))
    }
}
```

**Hot-reload WebSocket methods (context.websocket):**
- `websocket.broadcast(event, data)` - Broadcast to all connected clients on /hot-reload namespace
- `websocket.broadcastCssReload(route)` - Trigger CSS-only reload (no page refresh)
- `websocket.sendFileChanged(data)` - Send file change notifications
- `websocket.getClientCount()` - Get number of connected clients

**Note:** `context.websocket` is a `HotReloadSocketServer` instance that uses the `/hot-reload` namespace. While you can use it for simple broadcasts, for production applications with multiple real-time features, use `context.io` (Socket.IO) directly to create dedicated namespaces.

**Using Socket.IO Directly (Recommended for Production):**

For advanced use cases, the raw Socket.IO server is available as `context.io`. This allows you to create custom namespaces, use rooms, and access the full Socket.IO API:

```javascript
// pages/advanced-chat.mjs
export default async function createPage(sourceFolder, filePath, template, context = {}) {
    return new AdvancedChatPage(template, context)
}

class AdvancedChatPage {
    constructor(template, context) {
        this.template = template
        this.io = context.io  // Raw Socket.IO server
        
        // Create a custom namespace for chat (separate from /hot-reload)
        this.chatNamespace = this.io.of('/chat')
        
        // Set up chat handlers
        this.chatNamespace.on('connection', (socket) => {
            console.log('User connected to chat')
            
            // Join a room
            socket.on('join-room', (roomName) => {
                socket.join(roomName)
                this.chatNamespace.to(roomName).emit('user-joined', { 
                    socketId: socket.id 
                })
            })
            
            // Send message to room
            socket.on('message', (data) => {
                this.chatNamespace.to(data.room).emit('message', {
                    user: data.user,
                    text: data.text,
                    timestamp: new Date()
                })
            })
        })
    }
    
    async post(req, res) {
        const { room, message } = await req.json()
        
        // Broadcast to specific room using Socket.IO API
        this.chatNamespace.to(room).emit('message', message)
        
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: true }))
    }
}
```

**Client-side connection to custom namespace:**

```html
<script src="/socket.io/socket.io.js"></script>
<script>
    // Connect to custom namespace
    const chatSocket = io('/chat')
    
    chatSocket.emit('join-room', 'general')
    
    chatSocket.on('message', (data) => {
        console.log('New message:', data)
    })
</script>
```

This gives you full access to Socket.IO features like:
- Custom namespaces for different purposes
- Rooms for targeted broadcasting
- Middleware for authentication
- Adapters for scaling across multiple servers

````

### SiteGenerator

```javascript
import { SiteGenerator } from './index.mjs'
import { PluginManager } from './index.mjs'
import { PageRepository } from './index.mjs'

const generator = new SiteGenerator({
    pagesDir: './pages',
    buildDir: './_site',
    pluginManager: new PluginManager(),
    repository: new PageRepository()
})

await generator.initialize()
await generator.build()
await generator.buildFile('./pages/index.html')
```

## Testing

All new components have comprehensive test coverage:

```bash
# Run all tests
npm test

# Run specific test suite
npm test -- test/BlogPluginTest.mjs
npm test -- test/PolicyTest.mjs
npm test -- test/SiteGeneratorRefactoredTest.mjs
```

## Environment Variables

- `LOG_LEVEL=debug` - Enable debug logging (debug, info, warning, error)
- `PORT=3000` - Server port (default: 3000)
- `PAGES=./pages` - Pages directory
- `SITE_FOLDER=./_site` - Build output directory

## Troubleshooting

### Hot-reload not working
- Check browser console for WebSocket connection errors
- Ensure port 3000 is not blocked by firewall
- Verify `site.config.mjs` has correct paths

### Files not building
- Check file filter patterns in config
- Verify file is not in ignored directories
- Check debug logs with `LOG_LEVEL=debug`

### Plugin not loading
- Verify plugin path is correct
- Check plugin exports correct class/function
- Review plugin initialization errors in logs

## Next Steps

1. Copy `site.config.example.mjs` to `site.config.mjs`
2. Customize configuration for your site
3. Create pages in `pages/` directory
4. Run `npm start` to start development server
5. Open `http://localhost:3000` in browser

Happy building! 🚀
