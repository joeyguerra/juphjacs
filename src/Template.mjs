import vm, { SyntheticModule, SourceTextModule } from 'node:vm'
import { resolve, dirname } from 'node:path'

const LAYOUT_META_REGEX = /<meta name="layout" content="(?<fileName>.+)" \/>\n?/
const LAYOUT_BODY_REGEX = /\n?(?<indention>\s*)(?<body>\$\{\s?body\s?\})/i
const SCRIPT_REGEX = /<script server>(?<script>[\s\S]*?)<\/script>\n?/gi

class TemplateWithLayout {
    constructor(content, layout) {
        this.content = content
        this.layout = layout
    }
    async render(context = {}) {
        const content = await this.mergeWithLayout(this.content, this.layout)
        this.template = new Template(content)
        return this.template.render(context)
    }
    async mergeWithLayout(html, layout) {
        let content = html.toString()
        const bodyMatch = LAYOUT_BODY_REGEX.exec(layout)
        const layoutMatch = LAYOUT_META_REGEX.exec(content)
        content = content.replace(layoutMatch[0], '')
        return layout.replace(
            bodyMatch.groups.body,
            content.split('\n').map((line, i) => i > 0 ? bodyMatch.groups.indention + line : line).join('\n')
        )
    }
}
class Template {
    constructor(content) {
        this.content = content
    }
    async render(initialContext = {}) {
        const escapedContent = this.escapeScriptBackticks(this.content)
        const contexts = await this.executeScriptsIn(escapedContent)
        const context = Object.assign({}, initialContext)
        if (contexts.length > 0) {
            Object.assign(context, ...contexts)
        }
        const template = new Function('context', `with (context) { return \`${escapedContent.replaceAll(SCRIPT_REGEX, '')}\` }`)
        const renderedHtml = template(context)
        return this.restoreScriptBackticks(renderedHtml)
    }
    async executeScriptsIn(html) {
        const scripts = []
        let match
        while ((match = SCRIPT_REGEX.exec(html)) !== null) {
            scripts.push(match.groups.script)
        }
        if (scripts.length === 0) return []
        const contexts = []
        let context = vm.createContext({
            context: {},
            console
        })
        for (let script of scripts) {
            script = script.replace(/\\`/g, '`')
            try {
                const module = await this.compileScript(script, context)
                Object.assign(context.context, module.namespace)
                Object.assign(context.context, module.namespace.default)
                contexts.push(context.context)
            } catch (e) {
                console.error('compiling error', e)
            }
        }
        return contexts
    }
    async compileScript(script, context) {
        const module = new SourceTextModule(script, {
            context,
            initializeImportMeta(meta, module) {
                meta.url = `file://${filePath}`
            },
            importModuleDynamically: this.importModuleDynamically.bind(this)
        })
        await module.link(this.importModuleDynamically.bind(this))
        await module.evaluate()
        return module
    }
    async importNodeModule(specifier, referencingModule) {
        const mod = await import(specifier)
        const namespace = new SyntheticModule(['default'],
            () => namespace.setExport('default', mod.default),
            { identifier: specifier, context: referencingModule.context }
        )
        try {
            await namespace.link(this.importModuleDynamically.bind(this))
            await namespace.evaluate()
        } catch (e) {
            console.error(e)
        }
        return namespace
    }
    async importOtherModule(specifier, referencingModule) {
        const resolvedPath = resolve(dirname(referencingModule.identifier), specifier)
        const moduleContent = await fs.promises.readFile(resolvedPath, 'utf-8')
        const childModule = new SourceTextModule(moduleContent, {
            context: referencingModule.context
        })
        try {
            await childModule.link(this.importModuleDynamically.bind(this))
            await childModule.evaluate()    
        } catch (e) {
            console.error('custom', e)
        }
        return childModule
    }
    async importModuleDynamically(specifier, referencingModule) {
        if (specifier.startsWith('node:') || !specifier.startsWith('/')) {
            return this.importNodeModule(specifier, referencingModule)
        } else {
            return this.importOtherModule(specifier, referencingModule)
        }
    }
    escapeScriptBackticks(html) {
        return html.replace(/<script([\s\S]*?)<\/script>/gi, (match) => {
            return match.replace(/`/g, '\\`')
        })
    }
    restoreScriptBackticks(html) {
        return html.replace(/<script([\s\S]*?)<\/script>/gi, (match) => {
            return match.replace(/\\`/g, '`')
        })
    }
}

export {
    Template,
    TemplateWithLayout,
    LAYOUT_META_REGEX,
    LAYOUT_BODY_REGEX,
    SCRIPT_REGEX
}