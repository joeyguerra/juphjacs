# Hot-Reload Architecture

## Problem Solved

The `HotReloader.mjs` file needs to be available to any project using juphjacs as a module, without requiring users to copy files into their projects.

## Solution: Framework-Served Resources

HotReloader is now served directly from the juphjacs framework installation via a special `/__juphjacs__/` URL path.

## Architecture

```
User Request: /__juphjacs__/HotReloader.mjs
                    ↓
         DevServer.handleRequest()
                    ↓
    Intercepts /__juphjacs__/* paths
                    ↓
    DevServer.serveFrameworkResource()
                    ↓
    Resolves to: src/infrastructure/hotreload/HotReloader.mjs
                    ↓
    Serves file with correct content-type
```

## File Locations

### Framework Files (juphjacs installation)
```
src/infrastructure/hotreload/
├── HotReloader.mjs       ← Client-side DOM morphing
├── FileWatcher.mjs       ← Server-side file monitoring
└── ReloadServer.mjs      ← WebSocket server
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

### 1. HTML Page Request
```javascript
GET /index.html
→ DevServer checks: Not /__juphjacs__/* 
→ Serves from user's build folder
→ Auto-injects hot-reload script if missing
```

### 2. Framework Resource Request
```javascript
GET /__juphjacs__/HotReloader.mjs
→ DevServer checks: Starts with /__juphjacs__/
→ Calls serveFrameworkResource()
→ Resolves to framework installation path
→ Serves from src/infrastructure/hotreload/HotReloader.mjs
```

### 3. File Change Event
```javascript
File changed: pages/index.html
→ FileWatcher emits 'change' event
→ DevServer rebuilds file
→ ReloadServer broadcasts via Socket.IO
→ HotReloader.mjs receives event
→ Fetches updated HTML
→ Morphs DOM (preserves state)
```

## Code Implementation

### DevServer.handleRequest()

```javascript
async handleRequest(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`)
    
    // Intercept framework resources
    if (url.pathname.startsWith('/__juphjacs__/')) {
        return await this.serveFrameworkResource(url.pathname, res)
    }
    
    // Serve user files from build directory
    const filePath = url.pathname === '/' ? '/index.html' : url.pathname
    const fullPath = join(buildFolder, filePath)
    // ... serve user file
}
```

### DevServer.serveFrameworkResource()

```javascript
async serveFrameworkResource(pathname, res) {
    const resourcePath = pathname.replace('/__juphjacs__/', '')
    
    // Get framework's installation directory
    const frameworkRoot = dirname(fileURLToPath(import.meta.url))
    const resourceFile = join(frameworkRoot, '..', 'infrastructure', 'hotreload', resourcePath)
    
    const content = await readFile(resourceFile, 'utf-8')
    res.setHeader('Content-Type', 'application/javascript')
    res.end(content)
}
```

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

## DOM Morphing

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

All 126 tests pass, including:
- ✅ File watching and hot-reload
- ✅ DOM morphing functionality
- ✅ Template rendering with nullish coalescing
- ✅ Blog plugin integration
- ✅ Development server request handling

## Related Files

- `src/application/DevServer.mjs` - Request handling and injection
- `src/infrastructure/hotreload/HotReloader.mjs` - Client-side DOM morphing
- `src/infrastructure/hotreload/FileWatcher.mjs` - File system monitoring
- `src/infrastructure/hotreload/ReloadServer.mjs` - WebSocket server
- `FRAMEWORK_RESOURCES.md` - Documentation
