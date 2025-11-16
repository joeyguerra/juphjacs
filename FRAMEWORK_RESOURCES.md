# Framework Resources

## Overview

Juphjacs serves certain resources from the framework itself, not from the user's project. This ensures that framework functionality works regardless of the user's project structure.

## Framework Resource Path

All framework resources are served under the `/__juphjacs__/` path prefix.

## Available Resources

### HotReloader.mjs

**Path:** `/__juphjacs__/HotReloader.mjs`

**Location:** `src/infrastructure/hotreload/HotReloader.mjs`

**Purpose:** Client-side hot-reload handler with DOM morphing capabilities.

**Features:**
- Connects to the dev server via Socket.IO
- Listens for file change events
- Performs intelligent DOM morphing (only updates what changed)
- Preserves input values, focus, and scroll position
- Falls back to full reload on errors
- Supports CSS-only reloads

**Usage:**

The HotReloader is automatically injected into HTML pages by the development server. No manual setup required!

If you want to manually include it in your layout:

```html
<script src="/socket.io/socket.io.js"></script>
<script type="module">
  import { HotReloader } from '/__juphjacs__/HotReloader.mjs'
  const socket = io('/hot-reload')
  const reloader = new HotReloader(window, socket)
</script>
```

## How It Works

1. **Request interception:** The `FrameworkResourceHandler` in the `RequestHandlerChain` intercepts `/__juphjacs__/*`
2. **Framework path resolution:** Resolves the resource path relative to the framework's installation directory
3. **Content serving:** Serves the file with appropriate content-type headers
4. **Automatic injection:** For HTML pages without existing hot-reload code, the server automatically injects the script

## Adding New Framework Resources

To add a new framework resource:

1. Place the file in an appropriate location under `src/infrastructure/`
2. Ensure the `FrameworkResourceHandler` resolves it correctly (framework resources are served from `src/infrastructure/hotreload/` by default)
3. Document the resource in this file

## Benefits

✅ **Framework Consistency:** Users always get the latest framework code
✅ **No User Setup:** Works immediately without copying files to user projects
✅ **Clean User Projects:** User projects don't need framework implementation files
✅ **Automatic Updates:** Framework improvements automatically available to all projects
✅ **Module Compatibility:** Works whether juphjacs is installed as a package or used directly

## Technical Details

**Implementation:** `src/infrastructure/http/FrameworkResourceHandler.mjs` and `src/application/WebServer.mjs` (handler chain setup)

**Key Components:**
- `RequestHandlerChain` - Routes requests through handlers
- `FrameworkResourceHandler` - Serves files from framework installation

**Path Resolution:**
```javascript
const frameworkRoot = dirname(fileURLToPath(import.meta.url))
const resourceFile = join(frameworkRoot, '..', 'infrastructure', 'hotreload', resourcePath)
```

This ensures the resource is loaded from the framework's installation directory, not the user's project.
