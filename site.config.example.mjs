/**
 * juphjacs Site Configuration
 * 
 * This file defines the configuration for your juphjacs static site.
 * All paths are relative to this configuration file unless specified as absolute.
 */

export default {
    /**
     * Site name (required)
     */
    siteName: 'My Awesome Site',

    /**
     * Source folder containing your pages, templates, and content
     * Default: 'pages'
     */
    sourceFolder: './pages',

    /**
     * Build output folder for the generated static site
     * Default: '_site'
     */
    buildFolder: './_site',

    /**
     * Resource folders to copy to the build folder
     * Default: ['css', 'js', 'images']
     */
    resources: ['css', 'js', 'images'],

    /**
     * File extensions configuration
     */
    fileExtensions: {
        /**
         * File extensions to exclude from copying
         * These files will be processed instead
         */
        exclude: ['.html', '.xml', '.md', '.mjs', '.js'],
        
        /**
         * File extensions to include for processing
         */
        include: ['.html', '.xml', '.md']
    },

    /**
     * Development server configuration
     */
    server: {
        /**
         * Port to run the development server on
         * Can be overridden with PORT environment variable
         */
        port: 3000,
        
        /**
         * Host to bind the server to
         */
        host: 'localhost'
    },

    /**
     * Template security configuration
     * Generate keys with: npm run template:keys
     * Generate signed manifest with: npm run template:manifest -- --root ./pages
     */
    templateSecurity: {
        trustedRoots: ['./pages'],
        signedManifestPath: './.juphjacs/template-manifest.json',
        publicKeyPath: './.juphjacs/template-public.pem',
        requireSignedManifest: false,
        executionTimeoutMs: 250,
        workerMemoryLimitMb: 64,
        maxTemplateSizeBytes: 262144
    },

    /**
     * Plugin configuration
     * Plugins extend juphjacs functionality
     */
    plugins: [
        {
            /**
             * Plugin name (should match the plugin file name without extension)
             */
            name: 'blog',
            
            /**
             * Whether the plugin is enabled
             */
            enabled: true,

            /**
             * Path to the plugin file
             */
            path: '../../plugins/Blog.mjs',

            /**
             * Plugin-specific configuration
             */
            options: {
                postsFolder: 'blog',
                postsPerPage: 10,
                dateFormat: 'MMMM DD, YYYY'
            }
        },
        {
            name: 'sitemap',
            enabled: true,
            path: '../../plugins/Sitemap.mjs',
            options: {
                hostname: 'http://localhost:3000'
            }
        }
    ]
}
