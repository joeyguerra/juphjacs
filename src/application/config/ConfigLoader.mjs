import { join, resolve, isAbsolute } from 'node:path'
import { stat } from 'node:fs/promises'

const DEFAULT_CONFIG = {
    siteName: 'My Site',
    sourceFolder: 'pages',
    buildFolder: '_site',
    resources: ['css', 'js', 'images'],
    fileExtensions: {
        exclude: ['.html', '.xml', '.md', '.mjs', '.js'],
        include: ['.html', '.xml', '.md']
    },
    server: {
        port: 3000,
        host: 'localhost'
    },
    plugins: []
}

class ConfigLoader {
    constructor(rootFolder) {
        this.rootFolder = rootFolder
        this.configFileName = 'site.config.mjs'
    }

    async load() {
        const configPath = join(this.rootFolder, this.configFileName)
        
        let userConfig = {}
        
        try {
            await stat(configPath)
            const configModule = await import(`file://${configPath}`)
            userConfig = configModule.default || {}
        } catch (error) {
            if (error.code !== 'ENOENT') {
                throw new Error(`Failed to load configuration: ${error.message}`)
            }
            // Use default config if file doesn't exist
        }
        
        const config = this.mergeConfig(DEFAULT_CONFIG, userConfig)
        
        this.validate(config)
        this.resolvePaths(config)
        
        return config
    }

    mergeConfig(defaults, user) {
        return {
            ...defaults,
            ...user,
            fileExtensions: {
                ...defaults.fileExtensions,
                ...user.fileExtensions
            },
            server: {
                ...defaults.server,
                ...user.server
            },
            plugins: user.plugins || defaults.plugins
        }
    }

    validate(config) {
        if (!config.siteName) {
            throw new Error('Configuration error: siteName is required')
        }
    }

    resolvePaths(config) {
        // Resolve sourceFolder to absolute path
        if (config.sourceFolder && !isAbsolute(config.sourceFolder)) {
            config.sourceFolder = resolve(this.rootFolder, config.sourceFolder)
        }
        
        // Resolve buildFolder to absolute path
        if (config.buildFolder && !isAbsolute(config.buildFolder)) {
            config.buildFolder = resolve(this.rootFolder, config.buildFolder)
        }
    }
}

export { ConfigLoader, DEFAULT_CONFIG }
