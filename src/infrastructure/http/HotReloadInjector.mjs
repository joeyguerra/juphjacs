class HotReloadInjector {
    static inject(htmlContent) {
        // Check if hot-reload script is already present
        const hasHotReloader = htmlContent.includes('HotReloader') || htmlContent.includes('io(\'/hot-reload\')')
        
        if (hasHotReloader) {
            return htmlContent
        }
        
        // Inject hot-reload script with DOM morphing
        const hotReloadScript = `
<script src="/socket.io/socket.io.js"></script>
<script type="module">
  import { HotReloader } from '/__juphjacs__/HotReloader.mjs'
    const socket = io('/hot-reload', {
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 500,
        reconnectionDelayMax: 2000,
        timeout: 10000
    })
  const reloader = new HotReloader(window, socket)
</script>
</body>`
        
        return htmlContent.replace('</body>', hotReloadScript)
    }
}

export { HotReloadInjector }
