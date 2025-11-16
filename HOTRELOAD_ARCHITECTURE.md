# Hot Reload Architecture

## Problem Solved

The `HotReloader.mjs` file needs to be available to any project using juphjacs as a module, without requiring users to copy files into their projects.

## Solution: Framework-Served Resources

HotReloader is now served directly from the juphjacs framework installation via a special `/__juphjacs__/` URL path.

## Architecture

```
User request: /__juphjacs__/HotReloader.mjs
                    ↓
   RequestHandlerChain
                    ↓
FrameworkResourceHandler intercepts /__juphjacs__/*
                    ↓
Resolves to src/infrastructure/hotreload/HotReloader.mjs
                    ↓
Serves file with correct content type
```

## File Locations

### Framework Files (juphjacs installation)
```
src/infrastructure/hotreload/
├── HotReloader.mjs       ← Client-side DOM morphing
├── FileWatcher.mjs       ← Server-side file monitoring
└── HotReloadSocketServer.mjs      ← WebSocket server
```

### User Project (clean, no framework files)
```
pages/
├── index.html
├── layout.html           ← Imports from /__juphjacs__/
└── blog/
    └── layout.html       ← Imports from /__juphjacs__/
```

## Request Flow

### 1. HTML page request
```javascript
GET /index.html
→ WebServer routes through RequestHandlerChain 
→ Serves from user's build folder
→ Auto-injects hot-reload script if missing
```

### 2. Framework resource request
```javascript
GET /__juphjacs__/HotReloader.mjs
→ FrameworkResourceHandler resolves to framework installation path
→ Serves from src/infrastructure/hotreload/HotReloader.mjs
```

### 3. File change event
```javascript
File changed: pages/index.html
→ FileWatcher emits 'change' event
→ WebServer rebuilds file
→ AssetPolicy.getMeta(filePath) returns { assetType, hmrStrategy }
→ HotReloadSocketServer sends 'file-changed' with meta and content
→ HotReloader receives event and executes strategy
    - CSS_ONLY → reload styles
    - DOM_MORPH → fetch and morph DOM
    - FULL_RELOAD → window.location.reload()
```

## Code Implementation

### Framework resource handling

```javascript
// See src/infrastructure/http/FrameworkResourceHandler.mjs
```

### Client injection

### Automatic Injection

```javascript
if (filePath.endsWith('.html')) {
    const hasHotReloader = content.includes('HotReloader') || content.includes("io('/hot-reload')")
    
    if (!hasHotReloader) {
        const hotReloadScript = `
<script src="/socket.io/socket.io.js"></script>
<script type="module">
  import { HotReloader } from '/__juphjacs__/HotReloader.mjs'
  const socket = io('/hot-reload')
  const reloader = new HotReloader(window, socket)
</script>
</body>`
        modifiedContent = content.replace('</body>', hotReloadScript)
    }
}
```

## Benefits

### ✅ Clean User Projects
Users don't need framework implementation files in their projects.

### ✅ Automatic Updates
When juphjacs is updated, users automatically get the latest HotReloader.

### ✅ Works as npm Package
Works whether juphjacs is installed via npm or used directly.

### ✅ No Manual Setup
Hot-reload works immediately with zero configuration.

### ✅ Consistent Behavior
All projects using juphjacs get the same hot-reload experience.

## DOM morphing

The HotReloader uses intelligent DOM morphing instead of full page reloads:

```javascript
async morphDOM() {
    // Fetch updated HTML
    const response = await fetch(window.location.href, { cache: 'no-cache' })
    const newHTML = await response.text()
    const newDoc = new DOMParser().parseFromString(newHTML, 'text/html')
    
    // Morph body (preserves state)
    this.morphNode(document.body, newDoc.body)
    
    // Update head elements
    this.updateHead(newDoc.head)
}
```

### State Preservation
- ✅ Input values preserved
- ✅ Focus preserved
- ✅ Scroll position preserved
- ✅ Form state preserved
- ✅ Only changed elements updated
- ✅ No script re-execution

## Extension Points

To add more framework resources:

1. **Create the resource file** in `src/infrastructure/`
2. **Update path resolution** in `serveFrameworkResource()` if needed
3. **Document** in `FRAMEWORK_RESOURCES.md`
4. **Use the `/__juphjacs__/` prefix** in import statements

Example:
```javascript
// Future framework resource
import { FormValidator } from '/__juphjacs__/FormValidator.mjs'
```

## Testing

Representative coverage includes:
- ✅ File watching and hot-reload
- ✅ DOM morphing functionality
- ✅ Template rendering with nullish coalescing
- ✅ Blog plugin integration
- ✅ Development server request handling

## Related Files

- `src/application/WebServer.mjs` - Request handling and orchestration
- `src/infrastructure/hotreload/HotReloader.mjs` - Client-side DOM morphing
- `src/infrastructure/hotreload/FileWatcher.mjs` - File system monitoring
- `src/infrastructure/hotreload/HotReloadSocketServer.mjs` - WebSocket server
- `src/policy/AssetPolicy.mjs` - HMR strategy and asset classification
- `FRAMEWORK_RESOURCES.md` - Documentation
