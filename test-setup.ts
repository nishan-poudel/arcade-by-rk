import { JSDOM } from 'jsdom'
import Module from 'module'
import { readFileSync } from 'fs'
import path from 'path'

// ─── JSDOM ────────────────────────────────────────────────────────────────────
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost',
  pretendToBeVisual: true,
  resources: 'usable'
})

const { window } = dom

Object.defineProperty(globalThis, 'document', { value: window.document, writable: true })
Object.defineProperty(globalThis, 'window', { value: window, writable: true })
Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'jsdom' }, writable: true })
Object.defineProperty(globalThis, 'HTMLElement', { value: window.HTMLElement, writable: true })
Object.defineProperty(globalThis, 'Element', { value: window.Element, writable: true })
Object.defineProperty(globalThis, 'SVGElement', { value: window.SVGElement, writable: true })
Object.defineProperty(globalThis, 'Node', { value: window.Node, writable: true })
Object.defineProperty(globalThis, 'customElements', { value: window.customElements, writable: true })

process.removeAllListeners('warning')

// ─── Vue SFC loader ───────────────────────────────────────────────────────────
// tsx/cjs (loaded by mocha before this file) handles .ts imports and path aliases.
// Here we add .vue support using @vue/compiler-sfc + ts.transpileModule.
const srcDir = path.resolve(process.cwd(), 'src')

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { parse, compileScript, compileTemplate } = require('@vue/compiler-sfc')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ts = require('typescript')

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const extensions = (Module as any)._extensions

// eslint-disable-next-line @typescript-eslint/no-explicit-any
extensions['.vue'] = function (mod: any, filename: string) {
  const source = readFileSync(filename, 'utf-8')
  const { descriptor } = parse(source, { filename })
  const id = path.basename(filename, '.vue')

  let code: string

  if (descriptor.scriptSetup || descriptor.script) {
    // inlineTemplate merges template render fn into the script block
    const compiled = compileScript(descriptor, { id, inlineTemplate: true })
    code = compiled.content
  } else {
    code = 'export default {}\n'
    if (descriptor.template) {
      const tpl = compileTemplate({ source: descriptor.template.content, filename, id })
      code = tpl.code + '\nconst __sfc__ = {}; __sfc__.render = render; export default __sfc__\n'
    }
  }

  // Resolve @ path alias to absolute src dir
  code = code.replace(/from ['"]@\//g, `from '${srcDir}/`)
  code = code.replace(/require\(['"]@\//g, `require('${srcDir}/`)

  // Transpile TypeScript + ESM → CommonJS (strips types, converts export default → exports.default)
  const { outputText } = ts.transpileModule(code, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  })

  // Normalise: vue-test-utils expects the component as module.exports directly
  const final = outputText + '\nif (exports["default"]) module.exports = exports["default"]\n'
  mod._compile(final, filename)
}

