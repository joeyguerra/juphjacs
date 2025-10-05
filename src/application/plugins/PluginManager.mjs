class PluginManager {
    constructor() {
        this.plugins = []
        this.pluginsByName = new Map()
    }

    register(plugin) {
        if (this.pluginsByName.has(plugin.name)) {
            throw new Error(`Plugin "${plugin.name}" is already registered`)
        }

        this.plugins.push(plugin)
        this.pluginsByName.set(plugin.name, plugin)
    }

    async executeHook(hookName, data) {
        let result = data
        for (const plugin of this.plugins) {
            if (typeof plugin[hookName] === 'function') {
                try {
                    const hookResult = await plugin[hookName](result)
                    
                    // For hooks that transform data (like onContentLoaded), use the returned value
                    if (hookResult !== undefined) {
                        result = hookResult
                    }
                } catch (error) {
                    throw new Error(`Error in plugin "${plugin.name}" hook "${hookName}": ${error.message}`)
                }
            }
        }

        return result
    }

    getPlugin(name) {
        return this.pluginsByName.get(name)
    }

    hasPlugin(name) {
        return this.pluginsByName.has(name)
    }
}

export { PluginManager }
