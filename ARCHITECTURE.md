# juphjacs Architecture

This document describes the architecture.

## Overview

juphjacs is a static site generator with hot-reload capabilities. The architecture is organized into three main layers:

1. **Domain Layer** - Core business entities and logic
2. **Application Layer** - Application services, plugins, and orchestration
3. **Infrastructure Layer** - Technical implementations (file I/O, templates, markdown)

## Directory Structure

```
/src
  /domain
    /pages
      Page.mjs              # Core page entity
      PageRepository.mjs    # Repository for managing pages
  
  /application
    /plugins
      Plugin.mjs            # Base plugin class
      PluginManager.mjs     # Plugin lifecycle management
    /config
      ConfigLoader.mjs      # Configuration loading and validation
    SiteGenerator.mjs       # Main site generation orchestrator
  
  /infrastructure
    /markdown
      MarkdownParser.mjs    # Markdown parsing with frontmatter support
    /templates
      TemplateEngine.mjs    # Template literal rendering with script tag protection
    /hotreload
      FileWatcher.mjs       # File system watching
      ReloadServer.mjs      # WebSocket server for hot reload
      HotReloader.mjs       # Client-side hot reload script
```

## Core Concepts

### Domain Layer

#### Page
The `Page` class represents a single page in your site. It contains:
- File path and URI
- Template content
- Metadata (title, layout, etc.)
- Rendering logic
- Route information

#### PageRepository
Manages the collection of pages in memory. Provides methods to:
- Store and retrieve pages
- Query pages by criteria
- Find pages by file path or route

### Application Layer

#### Plugin System
Plugins extend juphjacs functionality through lifecycle hooks:

1. **onInit()** - Called when plugin is initialized
2. **onContentLoaded(pages)** - Called after content is loaded, can transform pages
3. **onPageRendered(page)** - Called after each page is rendered
4. **onBuildComplete(site)** - Called when the entire build is complete

Example plugin:

```javascript
import { Plugin } from './src/application/plugins/Plugin.mjs'

export class MyPlugin extends Plugin {
    constructor() {
        super('my-plugin')
    }

    async onContentLoaded(pages) {
        // Filter or transform pages
        return pages.filter(p => p.published)
    }

    async onBuildComplete(site) {
        // Generate additional files (sitemap, RSS feed, etc.)
    }
}
```

#### PluginManager
Manages plugin registration and lifecycle execution. Ensures plugins are:
- Registered uniquely
- Executed in order
- Able to transform data through hook chains

#### ConfigLoader
Loads and validates configuration from `site.config.mjs`. Provides:
- Default values for missing configuration
- Path resolution (relative to absolute)
- Validation of required fields
- Plugin configuration loading

### Infrastructure Layer

#### MarkdownParser
Parses markdown files with YAML frontmatter support:

```markdown
---
title: 'My Post'
published: '2025-09-01'
tags: ['one', 'two']
---

# Content here
```

Features:
- YAML frontmatter extraction
- Markdown-to-HTML conversion
- Configurable markdown-it options

#### TemplateEngine
Renders template literals with:
- Server-side variable interpolation
- Client-side script tag protection (preserves backticks in `<script>` tags)
- Async rendering support
- Context-aware rendering

#### Hot Reload System
Three-part system for live browser updates:

1. **FileWatcher** - Monitors file system for changes
2. **ReloadServer** - WebSocket server that broadcasts changes
3. **HotReloader** - Client-side script that morphs DOM when changes occur

## Configuration

Sites are configured via `site.config.mjs`:

```javascript
export default {
    siteName: 'My Site',
    sourceFolder: './pages',
    buildFolder: './_site',
    resources: ['css', 'js', 'images'],
    
    plugins: [
        {
            name: 'blog',
            enabled: true,
            config: {
                postsFolder: 'blog'
            }
        }
    ],
    
    server: {
        port: 3000,
        host: 'localhost'
    }
}
```

## Build Process

1. **Load Configuration** - ConfigLoader reads `site.config.mjs`
2. **Initialize Plugins** - PluginManager calls `onInit()` on all plugins
3. **Load Content** - SiteGenerator discovers and loads all pages
4. **Transform Content** - Plugins transform pages via `onContentLoaded()`
5. **Render Pages** - Each page is rendered with its template
6. **Notify Plugins** - `onPageRendered()` called for each page
7. **Write Files** - Rendered content written to build folder
8. **Complete Build** - `onBuildComplete()` called for cleanup/generation

## Page Controllers

Pages can have `.mjs` controllers that provide dynamic data during static site generation:

```javascript
// pages/blog.mjs
import { Page } from '../src/domain/pages/Page.mjs'

export default async (pagesFolder, filePath, template) => {
    const page = new Page(pagesFolder, filePath, template)
    page.title = 'Blog'
    page.posts = await loadPosts()
    page.layout = './layouts/main.html'
    return page
}
```

## Markdown Pages

Markdown files with frontmatter:

```markdown
---
layout: './layouts/post.html'
title: 'My Post'
published: '2025-09-01'
---

# Hello World

This is my post content.
```

## Hot Reload

During development, the hot reload system:
1. Watches for file changes
2. Rebuilds affected pages
3. Sends updated HTML to connected browsers
4. Morphs the DOM without full page reload
5. Preserves JavaScript state where possible

## Extensibility

juphjacs is designed to be extended through:

1. **Plugins** - Add functionality via lifecycle hooks
2. **Page Controllers** - Add logic to individual pages
3. **Layouts** - Nest templates for consistent design
4. **Custom Routes** - Define custom routing logic
5. **Middleware** - Intercept and modify requests

## Testing

The architecture supports testing at multiple levels:

- **Unit Tests** - Individual classes (Plugin, ConfigLoader, etc.)
- **Integration Tests** - Multiple components working together
- **Build Tests** - Full site generation workflow

All tests use Node.js built-in test runner.
