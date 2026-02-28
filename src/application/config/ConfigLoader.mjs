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
    templateSecurity: {
        trustedRoots: [],
        signedManifestPath: null,
        publicKeyPath: null,
        requireSignedManifest: false,
        executionTimeoutMs: 250,
        workerMemoryLimitMb: 64,
        workerRetryCount: 1,
        maxTemplateSizeBytes: 262144
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
            templateSecurity: {
                ...defaults.templateSecurity,
                ...user.templateSecurity
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

        // Resolve template security paths
        if (config.templateSecurity?.trustedRoots?.length) {
            config.templateSecurity.trustedRoots = config.templateSecurity.trustedRoots.map((root) => {
                return isAbsolute(root) ? root : resolve(this.rootFolder, root)
            })
        } else {
            config.templateSecurity.trustedRoots = [config.sourceFolder]
        }

        if (config.templateSecurity?.signedManifestPath && !isAbsolute(config.templateSecurity.signedManifestPath)) {
            config.templateSecurity.signedManifestPath = resolve(this.rootFolder, config.templateSecurity.signedManifestPath)
        }

        if (config.templateSecurity?.publicKeyPath && !isAbsolute(config.templateSecurity.publicKeyPath)) {
            config.templateSecurity.publicKeyPath = resolve(this.rootFolder, config.templateSecurity.publicKeyPath)
        }
    }
}

export { ConfigLoader, DEFAULT_CONFIG }
