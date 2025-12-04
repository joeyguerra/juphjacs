/**
 * Client-side hot reload handler with DOM morphing
 * Connects to the server via Socket.IO and handles reload events
 * Uses DOM diffing to update only changed elements without full page reload
 */
class HotReloader {
    constructor(window, socket) {
        this.window = window
        this.socket = socket
        this.setupListeners()
    }

    setupListeners() {
        // Smart reload with DOM morphing
        this.socket.on('reload', async (data) => {
            console.debug('[HotReload] Reloading page...', data)
            await this.morphDOM()
        })

        // CSS-only reload (no page refresh)
        this.socket.on('css-reload', () => {
            console.debug('[HotReload] Reloading CSS...')
            this.reloadStylesheets()
        })

        // File changed event with details
        this.socket.on('file-changed', async (/** @type {import('./HotReloadEvent.mjs').HotReloadEvent} */ data) => {
            console.debug('[HotReload] File changed:', data)
            
            // Only apply if the change targets this page
            const currentPath = this.window.location.pathname
            const targetPath = this.resolveTargetPath(data)
            if (targetPath && !this.routesMatch(currentPath, targetPath)) {
                console.debug('[HotReload] Ignoring change for different route', { currentPath, targetPath })
                return
            }

            // Use HMR strategy from server if provided, fallback to file type detection
            const strategy = data.hmrStrategy || this.detectStrategy(data)
            console.info('[HotReload] Using HMR strategy:', strategy)
            switch (strategy) {
                case 'full-reload':
                    console.info('[HotReload] Full reload required...')
                    this.window.location.reload()
                    break
                
                case 'dom-morph':
                    console.info('[HotReload] Morphing DOM...')
                    await this.morphDOM(data)
                    break
                
                case 'css-only':
                    console.info('[HotReload] Reloading CSS...')
                    this.reloadStylesheets()
                    break
                
                default:
                    console.info('[HotReload] No reload strategy for this file type')
            }
        })

        // Error from server
        this.socket.on('error', (error) => {
            console.error('[HotReload] Server error:', error)
        })

        // Connection events
        this.socket.on('connect', () => {
            console.info('[HotReload] Connected to hot-reload server')
        })

        this.socket.on('disconnect', () => {
            console.info('[HotReload] Disconnected from hot-reload server')
            this.reconnect()
        })

        // Reconnection lifecycle
        this.socket.on('connect_error', (err) => {
            console.warn('[HotReload] Connection error:', err?.message || err)
        })

        this.socket.on('reconnect_attempt', (attempt) => {
            console.info('[HotReload] Reconnect attempt:', attempt)
        })

        this.socket.on('reconnect', () => {
            console.info('[HotReload] Reconnected. Syncing page to latest...')
            // Ensure we didn't miss updates while disconnected
            this.window.location.reload()
        })

        this.socket.on('reconnect_failed', () => {
            console.error('[HotReload] Reconnect failed')
        })
    }

    /**
     * Resolve target route from event payload
     * @param {import('./HotReloadEvent.mjs').HotReloadEvent} data - Hot reload event
     * @returns {string|null} URL path for the changed page
     */
    resolveTargetPath(data = {}) {
        return data.route || null
    }

    // Compare normalized routes
    routesMatch(current, target) {
        const normalize = p => {
            let s = String(p || '').split('#')[0].split('?')[0]
            if (!s.startsWith('/')) s = '/' + s
            s = s.replace(/\/index\.html$/i, '/')
            if (s.length > 1 && s.endsWith('/')) s = s.slice(0, -1)
            return s
        }
        return normalize(current) === normalize(target)
    }

    /**
     * Detect HMR strategy from file data (fallback for older servers)
     * @param {Object} data - File change data
     * @returns {string} HMR strategy
     */
    detectStrategy(data) {
        // Check for JavaScript files
        if (data.assetType === 'js' || data.fileType === 'javascript' || data.filePath?.match(/\.(js|mjs)$/)) {
            return 'full-reload'
        }
        
        // Check for CSS files
        if (data.assetType === 'css' || data.fileType === 'css') {
            return 'css-only'
        }
        
        // Default to DOM morphing for HTML/MD
        return 'dom-morph'
    }

    /**
     * Fetch the latest HTML and morph the DOM to match
     * This updates only what changed without losing state
     * @param {import('./HotReloadEvent.mjs').HotReloadEvent} data - Hot reload event with content
     */
    async morphDOM(data) {
        try {
            const newHTML = data.content
            const parser = new DOMParser()
            const newDoc = parser.parseFromString(newHTML, 'text/html')

            // Morph the body content
            this.morphNode(this.window.document.body, newDoc.body)

            // Update title if changed
            if (this.window.document.title !== newDoc.title) {
                this.window.document.title = newDoc.title
            }

            // Update head elements (but preserve hot-reload scripts)
            this.updateHead(newDoc.head)

            console.info('[HotReload] DOM morphed successfully')
        } catch (error) {
            console.error('[HotReload] Error morphing DOM:', error)
            // Fall back to full reload on error
            this.window.location.reload()
        }
    }

    /**
     * Morph one DOM node to match another
     * Preserves focus, scroll position, and element state
     */
    morphNode(fromNode, toNode) {
        // Skip morphing for elements that should preserve state
        if (fromNode.hasAttribute && fromNode.hasAttribute('data-hot-reload-preserve')) {
            return
        }

        // If nodes are different types, replace completely
        if (fromNode.nodeType !== toNode.nodeType || fromNode.nodeName !== toNode.nodeName) {
            fromNode.replaceWith(toNode.cloneNode(true))
            return
        }

        // Handle text nodes
        if (fromNode.nodeType === Node.TEXT_NODE) {
            if (fromNode.nodeValue !== toNode.nodeValue) {
                fromNode.nodeValue = toNode.nodeValue
            }
            return
        }

        // Handle comment nodes
        if (fromNode.nodeType === Node.COMMENT_NODE) {
            if (fromNode.nodeValue !== toNode.nodeValue) {
                fromNode.nodeValue = toNode.nodeValue
            }
            return
        }

        // Skip script tags to avoid re-execution
        if (fromNode.nodeName === 'SCRIPT') {
            return
        }

        // Update attributes (only for element nodes)
        this.morphAttributes(fromNode, toNode)

        // Preserve input values, selections, and focus
        const activeElement = this.window.document.activeElement
        const hasFocus = fromNode === activeElement || fromNode.contains(activeElement)
        
        if (fromNode.nodeName === 'INPUT' || fromNode.nodeName === 'TEXTAREA' || fromNode.nodeName === 'SELECT') {
            // Preserve form state
            return
        }

        // Morph children
        this.morphChildren(fromNode, toNode)
    }

    /**
     * Update element attributes to match target
     * Should only be called with element nodes
     */
    morphAttributes(fromNode, toNode) {
        // Safety check: only element nodes have attributes
        if (!fromNode.attributes || !toNode.attributes) {
            return
        }
        
        // Remove old attributes
        const fromAttrs = fromNode.attributes
        for (let i = fromAttrs.length - 1; i >= 0; i--) {
            const attr = fromAttrs[i]
            if (!toNode.hasAttribute(attr.name)) {
                fromNode.removeAttribute(attr.name)
            }
        }

        // Add/update new attributes
        const toAttrs = toNode.attributes
        for (let i = 0; i < toAttrs.length; i++) {
            const attr = toAttrs[i]
            if (fromNode.getAttribute(attr.name) !== attr.value) {
                fromNode.setAttribute(attr.name, attr.value)
            }
        }
    }

    /**
     * Morph child nodes
     */
    morphChildren(fromNode, toNode) {
        const fromChildren = Array.from(fromNode.childNodes)
        const toChildren = Array.from(toNode.childNodes)

        // Simple algorithm: morph matching children, add new ones, remove extras
        const maxLength = Math.max(fromChildren.length, toChildren.length)

        for (let i = 0; i < maxLength; i++) {
            const fromChild = fromChildren[i]
            const toChild = toChildren[i]

            if (!toChild) {
                // Remove extra child
                if (fromChild) {
                    fromChild.remove()
                }
            } else if (!fromChild) {
                // Add new child
                fromNode.appendChild(toChild.cloneNode(true))
            } else {
                // Morph existing child
                this.morphNode(fromChild, toChild)
            }
        }
    }

    /**
     * Update head elements (styles, meta tags)
     * Preserves hot-reload scripts and existing scripts
     */
    updateHead(newHead) {
        const currentHead = this.window.document.head
        const currentLinks = Array.from(currentHead.querySelectorAll('link[rel="stylesheet"]'))
        const newLinks = Array.from(newHead.querySelectorAll('link[rel="stylesheet"]'))

        // Update stylesheets
        newLinks.forEach((newLink, index) => {
            const currentLink = currentLinks[index]
            if (currentLink) {
                if (currentLink.href !== newLink.href) {
                    currentLink.href = newLink.href
                }
            } else {
                currentHead.appendChild(newLink.cloneNode(true))
            }
        })

        // Remove extra stylesheets
        if (currentLinks.length > newLinks.length) {
            currentLinks.slice(newLinks.length).forEach(link => link.remove())
        }

        // Update meta tags
        const currentMetas = Array.from(currentHead.querySelectorAll('meta'))
        const newMetas = Array.from(newHead.querySelectorAll('meta'))

        newMetas.forEach((newMeta) => {
            const name = newMeta.getAttribute('name') || newMeta.getAttribute('property')
            if (name) {
                const currentMeta = currentMetas.find(m => 
                    m.getAttribute('name') === name || m.getAttribute('property') === name
                )
                if (currentMeta) {
                    if (currentMeta.getAttribute('content') !== newMeta.getAttribute('content')) {
                        currentMeta.setAttribute('content', newMeta.getAttribute('content'))
                    }
                } else {
                    currentHead.appendChild(newMeta.cloneNode(true))
                }
            }
        })
    }

    reloadStylesheets() {
        const links = this.window.document.querySelectorAll('link[rel="stylesheet"]')
        links.forEach(link => {
            const url = new URL(link.href)
            url.searchParams.set('t', Date.now())
            link.href = url.toString()
        })
    }

    reconnect() {
        if (this.socket && !this.socket.connected) {
            console.info('[HotReload] Attempting to reconnect...')
            this.socket.connect()
        }
    }
    
    disconnect() {
        if (this.socket) {
            this.socket.disconnect()
        }
    }
}

export { HotReloader }
