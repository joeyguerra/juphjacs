import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert'
import { Plugin } from '../src/application/plugins/Plugin.mjs'
import { PluginManager } from '../src/application/plugins/PluginManager.mjs'

describe('Plugin', () => {
    describe('base class', () => {
        it('should have a name property', () => {
            const plugin = new Plugin('test-plugin')
            assert.strictEqual(plugin.name, 'test-plugin')
        })

        it('should have lifecycle hook methods', async () => {
            const plugin = new Plugin('test')
            
            assert.strictEqual(await plugin.onInit(), undefined)
            // onContentLoaded returns pages by default
            const pages = [{ title: 'Test' }]
            assert.deepStrictEqual(await plugin.onContentLoaded(pages), pages)
            assert.strictEqual(await plugin.onPageRendered({}), undefined)
            assert.strictEqual(await plugin.onBuildComplete({}), undefined)
        })

        it('should allow subclasses to override lifecycle hooks', async () => {
            class CustomPlugin extends Plugin {
                constructor() {
                    super('custom')
                    this.initCalled = false
                    this.contentLoadedCalled = false
                }

                async onInit() {
                    this.initCalled = true
                }

                async onContentLoaded(pages) {
                    this.contentLoadedCalled = true
                    return pages.filter(p => p.published)
                }
            }

            const plugin = new CustomPlugin()
            await plugin.onInit()
            assert.strictEqual(plugin.initCalled, true)

            const pages = [
                { title: 'Published', published: '2025-09-01' },
                { title: 'Draft', published: null }
            ]
            const filtered = await plugin.onContentLoaded(pages)
            assert.strictEqual(plugin.contentLoadedCalled, true)
            assert.strictEqual(filtered.length, 1)
            assert.strictEqual(filtered[0].title, 'Published')
        })
    })

    describe('PluginManager', () => {
        let manager

        beforeEach(() => {
            manager = new PluginManager()
        })

        it('should register plugins', () => {
            const plugin = new Plugin('test-plugin')
            manager.register(plugin)
            
            assert.strictEqual(manager.plugins.length, 1)
            assert.strictEqual(manager.plugins[0].name, 'test-plugin')
        })

        it('should prevent duplicate plugin registration', () => {
            const plugin1 = new Plugin('test-plugin')
            const plugin2 = new Plugin('test-plugin')
            
            manager.register(plugin1)
            assert.throws(() => {
                manager.register(plugin2)
            }, /already registered/)
        })

        it('should call onInit on all plugins', async () => {
            let initOrder = []
            
            class Plugin1 extends Plugin {
                async onInit() {
                    initOrder.push('plugin1')
                }
            }
            
            class Plugin2 extends Plugin {
                async onInit() {
                    initOrder.push('plugin2')
                }
            }

            manager.register(new Plugin1('plugin1'))
            manager.register(new Plugin2('plugin2'))
            
            await manager.executeHook('onInit')
            
            assert.deepStrictEqual(initOrder, ['plugin1', 'plugin2'])
        })

        it('should pass data through onContentLoaded hook chain', async () => {
            class FilterPlugin extends Plugin {
                async onContentLoaded(pages) {
                    return pages.filter(p => p.published)
                }
            }
            
            class SortPlugin extends Plugin {
                async onContentLoaded(pages) {
                    return pages.sort((a, b) =>{
                        return new Date(b.published) - new Date(a.published)
                    })
                }
            }

            manager.register(new FilterPlugin('filter'))
            manager.register(new SortPlugin('sort'))
            
            const pages = [
                { title: 'Old Published', published: '2020-01-01'},
                { title: 'New Published', published: '2024-01-01' },
                { title: 'Draft', published: null }
            ]
            
            const result = await manager.executeHook('onContentLoaded', pages)
            
            assert.strictEqual(result.length, 2)
            assert.strictEqual(result[0].title, 'New Published')
            assert.strictEqual(result[1].title, 'Old Published')
        })

        it('should handle errors in plugin hooks gracefully', async () => {
            class FailingPlugin extends Plugin {
                async onInit() {
                    throw new Error('Plugin failed')
                }
            }

            manager.register(new FailingPlugin('failing'))
            
            await assert.rejects(
                async () => await manager.executeHook('onInit'),
                /Plugin failed/
            )
        })

        it('should allow plugins to emit events', async () => {
            const events = []
            
            class EventPlugin extends Plugin {
                async onContentLoaded(pages) {
                    this.emit('custom-event', { data: 'test' })
                    return pages
                }
            }

            const plugin = new EventPlugin('event-plugin')
            plugin.on('custom-event', (data) => {
                events.push(data)
            })
            
            manager.register(plugin)
            await manager.executeHook('onContentLoaded', [])
            
            assert.strictEqual(events.length, 1)
            assert.deepStrictEqual(events[0], { data: 'test' })
        })
    })
})
