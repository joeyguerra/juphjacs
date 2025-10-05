class TemplateEngine {
    constructor() {
        this.scriptTagRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi
    }

    async render(template, context = {}) {
        // First, protect client-side template literals in script tags
        const { protectedTemplate, scriptContents } = this.protectScriptTags(template)
        
        // Render the template with server-side context
        const rendered = await this.renderTemplate(protectedTemplate, context)
        
        // Restore the script tags with their original content
        const final = this.restoreScriptTags(rendered, scriptContents)
        
        return final
    }

    protectScriptTags(template) {
        const scriptContents = []
        let index = 0
        
        const protectedTemplate = template.replace(this.scriptTagRegex, (match, scriptContent) => {
            const placeholder = `___SCRIPT_PLACEHOLDER_${index}___`
            // Escape backticks and template expressions in JavaScript
            const escapedContent = scriptContent
                .replace(/\\/g, '\\\\')  // Escape backslashes first
                .replace(/`/g, '\\`')    // Escape backticks
                .replace(/\$\{/g, '\\${') // Escape template expressions
            scriptContents.push(escapedContent)
            index++
            return match.replace(scriptContent, placeholder)
        })
        
        return { protectedTemplate, scriptContents }
    }

    restoreScriptTags(template, scriptContents) {
        let result = template
        
        scriptContents.forEach((content, index) => {
            const placeholder = `___SCRIPT_PLACEHOLDER_${index}___`
            // Unescape the content when restoring
            const unescapedContent = content
                .replace(/\\\$\{/g, '${')  // Unescape template expressions first
                .replace(/\\`/g, '`')      // Unescape backticks
                .replace(/\\\\/g, '\\')    // Unescape backslashes last
            result = result.replace(placeholder, unescapedContent)
        })
        
        return result
    }

    async renderTemplate(template, context) {
        // Get all properties and methods from the context, including prototype methods
        const allKeys = new Set()
        const allValues = []
        
        // Add own properties
        Object.keys(context).forEach(key => {
            allKeys.add(key)
        })
        
        // Add methods from the prototype chain
        let obj = context
        while (obj && obj !== Object.prototype) {
            Object.getOwnPropertyNames(obj).forEach(key => {
                if (key !== 'constructor' && typeof context[key] === 'function') {
                    allKeys.add(key)
                }
            })
            obj = Object.getPrototypeOf(obj)
        }
        
        // Extract variable names from template expressions ${varName}
        // This allows using ?? operator for undefined variables
        const templateVarRegex = /\$\{([a-zA-Z_$][a-zA-Z0-9_$]*)/g
        let match
        while ((match = templateVarRegex.exec(template)) !== null) {
            const varName = match[1]
            // Add variable to keys if not already present and not a keyword
            if (!allKeys.has(varName) && !this.isJavaScriptKeyword(varName)) {
                allKeys.add(varName)
            }
        }
        
        // Build the values array in the same order as keys
        const keys = Array.from(allKeys)
        keys.forEach(key => {
            const value = context[key]
            // Bind methods to the context
            allValues.push(typeof value === 'function' ? value.bind(context) : value)
        })
        
        // Wrap template in backticks to make it a template literal
        const functionBody = `return \`${template}\``
        
        try {
            // Create an ASYNC function with the context variables as parameters
            const AsyncFunction = async function () {}.constructor
            const renderFunction = new AsyncFunction(...keys, functionBody)
            
            // Call the function with the context values and await the result
            const result = await renderFunction.apply(context, allValues)
            
            return result
        } catch (error) {
            throw new Error(`Template rendering error: ${error.message}`)
        }
    }

    isJavaScriptKeyword(word) {
        const keywords = [
            'await', 'break', 'case', 'catch', 'class', 'const', 'continue',
            'debugger', 'default', 'delete', 'do', 'else', 'export', 'extends',
            'finally', 'for', 'function', 'if', 'import', 'in', 'instanceof',
            'let', 'new', 'return', 'super', 'switch', 'this', 'throw', 'try',
            'typeof', 'var', 'void', 'while', 'with', 'yield'
        ]
        return keywords.includes(word)
    }
}

export { TemplateEngine }
