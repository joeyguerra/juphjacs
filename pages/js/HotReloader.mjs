import io from '/socket.io/socket.io.esm.min.js'
import morphdom from '/morphdom/morphdom-esm.js'
const morphdomOptions = {
    onNodeAdded (node) {
        if (node.nodeName === 'SCRIPT' && node.id !== 'HotReloader') {
            const script = document.createElement('script')
            Array(...node.attributes).forEach( attr => { script.setAttribute(attr.nodeName ,attr.nodeValue) })
            script.innerHTML = node.innerHTML
            node.replaceWith(script)
        }
    },
    onBeforeElUpdated (fromEl, toEl) {
        if (fromEl.nodeName === 'SCRIPT' && toEl.nodeName === 'SCRIPT' && fromEl.id !== 'HotReloader' && toEl.id !== 'HotReloader') {
            const script = document.createElement('script')
            Array(...toEl.attributes).forEach( attr => { script.setAttribute(attr.nodeName ,attr.nodeValue) })
            script.innerHTML = toEl.innerHTML
            fromEl.replaceWith(script)
            return false
        }
        return true
    }
}

class HotReloader {
    constructor(window, socket) {
        this.window = window
        this.socket = socket
        socket.on('file changed', msg => {
            const domFromData = new DOMParser().parseFromString(msg.data, 'text/html')
            morphdom(document.head, domFromData.head, morphdomOptions)
            morphdom(document.body, domFromData.body, morphdomOptions)
            console.info('morphed', new Date())
        })
        socket.on('disconnect', reason => {
            console.error('Disconnected:', reason)
        })
        socket.on('connect_error', error => {
            console.error('Connection error:', error)
        })
        window.addEventListener('unload', e =>{
            socket.close()
        })    
    }
}
export { HotReloader }