import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert'
import { FileWatcher } from '../src/infrastructure/hotreload/FileWatcher.mjs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import { setTimeout as sleep } from 'node:timers/promises'

describe('FileWatcher', () => {
    let testDir
    let watcher

    beforeEach(async () => {
        testDir = join(tmpdir(), `juphjacs-watcher-test-${Date.now()}`)
        await mkdir(testDir, { recursive: true })
    })

    afterEach(async () => {
        if (watcher) {
            await watcher.close()
        }
        try {
            await rm(testDir, { recursive: true, force: true })
        } catch (e) {
            // Ignore cleanup errors
        }
    })

    it('should create a file watcher for a directory', () => {
        watcher = new FileWatcher(testDir)
        assert.ok(watcher)
        assert.strictEqual(watcher.rootFolder, testDir)
    })

    it('should emit change event when file is modified', async () => {
        const testFile = join(testDir, 'test.html')
        await writeFile(testFile, '<h1>Initial</h1>')

        const changes = []
        
        watcher = new FileWatcher(testDir, {
            debounceTime: 50  // Shorter debounce for faster test
        })
        
        watcher.on('change', ({ filePath, stats }) => {
            changes.push({ filePath, stats })
        })

        await watcher.watch()
        await sleep(200) // Wait longer for watcher to be fully ready

        // Modify the file
        await writeFile(testFile, '<h1>Modified</h1>')
        await sleep(300) // Wait longer for change detection + debounce

        assert.ok(changes.length > 0, `Expected changes but got ${changes.length}`)
        assert.ok(changes.some(change => change.filePath.includes('test.html')))
    })

    it('should emit add event when file is created', async () => {
        const additions = []
        
        watcher = new FileWatcher(testDir, {
            debounceTime: 50
        })
        
        watcher.on('add', ({ filePath, stats }) => {
            additions.push({ filePath, stats })
        })

        await watcher.watch()
        await sleep(200)

        const newFile = join(testDir, 'new.html')
        await writeFile(newFile, '<h1>New File</h1>')
        await sleep(300)

        assert.ok(additions.length > 0, `Expected additions but got ${additions.length}`)
        assert.ok(additions.some(addition => addition.filePath.includes('new.html')))
    })

    it('should support ignore patterns configuration', async () => {
        // Just test that ignore patterns can be configured
        watcher = new FileWatcher(testDir, {
            ignore: ['**/node_modules/**', '**/.git/**', '**/*.tmp']
        })
        
        assert.ok(watcher.options.ignore.length >= 3)
        assert.ok(watcher.options.ignore.some(p => p.includes('node_modules')))
    })

    it('should watch nested directories', async () => {
        await mkdir(join(testDir, 'nested'), { recursive: true })
        
        const changes = []
        
        watcher = new FileWatcher(testDir, { debounceTime: 50 })
        watcher.on('add', ({ filePath, stats }) => {
            changes.push({ filePath, stats })
        })

        await watcher.watch()
        await sleep(200)

        await writeFile(join(testDir, 'nested', 'deep.html'), '<h1>Deep</h1>')
        await sleep(300)

        assert.ok(changes.some(change => change.filePath.includes('deep.html')))
    })

    it('should provide file statistics with events', async () => {
        const testFile = join(testDir, 'test.html')
        await writeFile(testFile, '<h1>Test</h1>')

        let eventData = null
        
        watcher = new FileWatcher(testDir, { debounceTime: 50 })
        watcher.on('change', ({ filePath, stats }) => {
            eventData = { filePath, stats }
        })

        await watcher.watch()
        await sleep(200)

        await writeFile(testFile, '<h1>Modified</h1>')
        await sleep(300)

        assert.ok(eventData)
        assert.ok(eventData.filePath)
        assert.ok(eventData.stats)
    })

    it('should allow closing the watcher', async () => {
        watcher = new FileWatcher(testDir, { debounceTime: 50 })
        await watcher.watch()
        
        await watcher.close()
        
        // After closing, no events should fire
        const changes = []
        watcher.on('change', ({ filePath }) => {
            changes.push(filePath)
        })

        await writeFile(join(testDir, 'test.html'), '<h1>Test</h1>')
        await sleep(300)

        assert.strictEqual(changes.length, 0)
    })

    it('should support custom debounce time', async () => {
        const testFile = join(testDir, 'test.html')
        await writeFile(testFile, '<h1>Initial</h1>')

        let changeCount = 0
        
        watcher = new FileWatcher(testDir, { debounceTime: 50 })
        watcher.on('change', () => {
            changeCount++
        })

        await watcher.watch()
        await sleep(200)

        // Make multiple rapid changes
        await writeFile(testFile, '<h1>Change 1</h1>')
        await writeFile(testFile, '<h1>Change 2</h1>')
        await writeFile(testFile, '<h1>Change 3</h1>')
        await sleep(300)

        // Should be debounced to fewer events
        assert.ok(changeCount < 3, 'Should debounce rapid changes')
    })
})
