# Migration Guide: juphjacs v1.x to v2.0

This guide helps you migrate from the old juphjacs architecture to the new Domain-Driven Design (DDD) architecture.

## Overview

The refactored juphjacs introduces:
- Clean separation of concerns (Domain, Application, Infrastructure)
- Configuration-driven approach with `site.config.mjs`
- Improved plugin system with lifecycle hooks
- Better template engine with client-side script protection
- Enhanced markdown support with YAML frontmatter

## Breaking Changes

### 1. File Imports

**Old:**
```javascript
import { Page } from './src/Page.mjs'
import { SiteGenerator } from './src/SiteGenerator.mjs'
```

**New:**
```javascript
import { Page } from './src/domain/pages/Page.mjs'
import { SiteGenerator } from './src/application/SiteGenerator.mjs'
```

### 2. Configuration

**Old:** Environment variables and command-line arguments
```bash
PAGES=./pages SITE_FOLDER=./_site npm start
```

**New:** `site.config.mjs` file
```javascript
export default {
    siteName: 'My Site',
    sourceFolder: './pages',
    buildFolder: './_site',
    resources: ['css', 'js', 'images']
}
```

### 3. Plugin System

**Old:** Plugins used process events
```javascript
// plugins/MyPlugin.mjs
import { EVENTS } from '../src/Page.mjs'

export default async () => {
    process.on(EVENTS.PRE_TEMPLATE_RENDER, (filePath, page) => {
        // Do something
    })
}
```

**New:** Plugins extend base class with lifecycle hooks
```javascript
// plugins/MyPlugin.mjs
import { Plugin } from '../src/application/plugins/Plugin.mjs'

export class MyPlugin extends Plugin {
    constructor() {
        super('my-plugin')
    }

    async onContentLoaded(pages) {
        // Transform pages
        return pages
    }

    async onPageRendered(page) {
        // Do something with rendered page
    }
}
```

## Step-by-Step Migration

### Step 1: Create Configuration File

Create `site.config.mjs` in your project root:

```javascript
export default {
    siteName: 'Your Site Name',
    sourceFolder: './pages',
    buildFolder: './_site',
    resources: ['css', 'js', 'images'],
    
    server: {
        port: process.env.PORT || 3000,
        host: 'localhost'
    }
}
```

### Step 2: Update Plugin Files

If you have custom plugins, update them to use the new Plugin base class.

**Before:**
```javascript
import { EVENTS } from '../src/Page.mjs'

export default async () => {
    const posts = new Set()
    
    process.on(EVENTS.TEMPLATE_RENDERED, (filePath, page) => {
        if (filePath.includes('/blog/')) {
            posts.add(page)
        }
    })
}
```

**After:**
```javascript
import { Plugin } from '../src/application/plugins/Plugin.mjs'

export class BlogPlugin extends Plugin {
    constructor() {
        super('blog')
        this.posts = []
    }

    async onContentLoaded(pages) {
        // Filter blog posts
        this.posts = pages.filter(p => p.filePath.includes('/blog/'))
        return pages
    }

    async onBuildComplete(site) {
        // Generate blog index, RSS feed, etc.
    }
}

// Export instance
export default new BlogPlugin()
```

### Step 3: Update Markdown Files

If you're using markdown, you can now use YAML frontmatter:

**Before:**
```markdown
# My Post

This is content.
```

**After:**
```markdown
---
layout: './layouts/post.html'
title: 'My Post'
published: '2025-09-01'
excerpt: 'A summary of my post'
tags: ['javascript', 'web']
---

# My Post

This is content.
```

### Step 4: Update Page Controllers

Page controller signatures remain largely the same, but you should update imports:

**Before:**
```javascript
import { Page } from '../src/Page.mjs'

export default async (pagesFolder, filePath, template) => {
    const page = new Page(pagesFolder, filePath, template)
    page.title = 'My Page'
    return page
}
```

**After:**
```javascript
import { Page } from '../src/domain/pages/Page.mjs'

export default async (pagesFolder, filePath, template, context = {}) => {
    const page = new Page(pagesFolder, filePath, template, context = {})
    page.title = 'My Page'
    page.layout = './layouts/main.html'
    return page
}
```

### Step 5: Update Package Scripts

Update your `package.json` scripts if needed:

**Before:**
```json
{
    "scripts": {
        "start": "PAGES=./pages SITE_FOLDER=./_site node server.mjs"
    }
}
```

**After:**
```json
{
    "scripts": {
        "start": "node server.mjs",
        "dev": "node --watch server.mjs"
    }
}
```

## New Features You Can Use

### 1. YAML Frontmatter in Markdown

```markdown
---
title: 'Post Title'
author: 'John Doe'
date: '2024-01-01'
published: '2025-09-01'
tags: ['tag1', 'tag2']
custom: 'Any custom field'
---

# Content
```

### 2. Improved Template Engine

The new template engine automatically protects client-side template literals:

```html
<div>${serverVariable}</div>

<script>
// This won't be processed by the server
const clientTemplate = `Hello ${clientVar}`
</script>
```

### 3. Plugin Configuration

Configure plugins in `site.config.mjs`:

```javascript
export default {
    siteName: 'My Site',
    plugins: [
        {
            name: 'blog',
            enabled: true,
            config: {
                postsPerPage: 10,
                dateFormat: 'YYYY-MM-DD'
            }
        }
    ]
}
```

Access plugin config in your plugin:

```javascript
export class BlogPlugin extends Plugin {
    constructor(config = {}) {
        super('blog')
        this.postsPerPage = config.postsPerPage || 10
        this.dateFormat = config.dateFormat || 'YYYY-MM-DD'
    }
}
```

### 4. PageRepository

Use the PageRepository for better page management:

```javascript
import { PageRepository } from './src/domain/pages/PageRepository.mjs'

const repository = new PageRepository('/path/to/pages')

// Store pages
repository.save(page)

// Query pages
const publishedPages = repository.where({ published: '2025-09-01' })

// Find by route
const page = repository.findByRoute('/about')
```

## Backward Compatibility

The following features maintain backward compatibility:

- Page controller signature (with optional 4th parameter)
- Template literal syntax
- Route definitions
- Layout system
- Hot reload functionality

## Common Issues

### Issue: "Cannot find module"

**Solution:** Update your import paths to the new structure:
- `./src/Page.mjs` → `./src/domain/pages/Page.mjs`
- `./src/SiteGenerator.mjs` → `./src/application/SiteGenerator.mjs`

### Issue: Plugins not working

**Solution:** Update plugins to extend the new `Plugin` base class and use lifecycle hooks instead of process events.

### Issue: Configuration not loaded

**Solution:** Ensure `site.config.mjs` is in your project root and exports a default object with at least `siteName` defined.

## Testing Your Migration

1. Run all existing tests: `npm test`
2. Build your site: `npm start` (with EXECUTE=true)
3. Start dev server: `npm run dev`
4. Check hot reload works: Edit a file and verify browser updates

## Getting Help

If you encounter issues during migration:

1. Check the [ARCHITECTURE.md](./ARCHITECTURE.md) for design details
2. Review example configuration in `site.config.example.mjs`
3. Look at the test files in `/test` for usage examples
4. Open an issue on GitHub with details about your setup

## Rollback

If you need to rollback to the old version:

```bash
git checkout v1.x
npm install
```

Make sure to backup your custom plugins and configurations before migrating.
