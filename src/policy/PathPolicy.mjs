import { minimatch } from 'minimatch'

class PathPolicy {
  constructor(config = {}) {
    this.config = {
      ignore: [],
      include: [],
      layoutPatterns: ['**/layout.html', '**/_layout.html'],
      ...config
    }

    this.defaultIgnorePatterns = [
      '**/node_modules/**',
      '**/.git/**',
      '**/.DS_Store',
      '**/.env',
      '**/.env.*',
      '**/.vscode/**',
      '**/.idea/**',
      '**/_site/**',
      '**/dist/**',
      '**/build/**',
      '**/package-lock.json',
      '**/yarn.lock',
      '**/pnpm-lock.yaml',
      '**/*.log',
      '**/npm-debug.log*'
    ]

    this.ignorePatterns = [...this.defaultIgnorePatterns, ...this.config.ignore]
    this.includePatterns = this.config.include
    this.layoutPatterns = this.config.layoutPatterns
  }

  shouldProcess(filePath) {
    const normalizedPath = filePath.replace(/\\/g, '/')

    if (this.includePatterns.length > 0) {
      const included = this.includePatterns.some(pattern =>
        minimatch(normalizedPath, pattern)
      )
      if (!included) return false
    }

    const ignored = this.ignorePatterns.some(pattern =>
      minimatch(normalizedPath, pattern)
    )

    return !ignored
  }

  isLayoutFile(filePath) {
    const normalizedPath = filePath.replace(/\\/g, '/')

    return this.layoutPatterns.some(pattern =>
      minimatch(normalizedPath, pattern)
    )
  }
}

export { PathPolicy }
