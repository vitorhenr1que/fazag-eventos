const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')
module.exports = function loadLock(db) {
    const file = path.resolve(__dirname, '../../src/lib/financeiro-lock.ts')
    const loaded = new Module(file, module); loaded.filename = file; loaded.paths = module.paths
    const original = loaded.require.bind(loaded)
    loaded.require = id => {
        if (id === '@/lib/db') return { __esModule: true, default: db }
        if (id === './app-error') return require('../../src/lib/app-error.ts')
        return original(id)
    }
    loaded._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, file)
    return loaded.exports
}
