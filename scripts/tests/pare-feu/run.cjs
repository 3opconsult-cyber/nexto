// Test du pare-feu des commissions (src/lib/payments/firewall.ts) sur une base simulée en mémoire.
//   node scripts/tests/pare-feu/run.cjs
// Les verrous côté base (trigger : un pro suspendu ne peut ni se débloquer ni toucher au mandat) se
// testent en SQL avec un rôle « authenticated » et un ROLLBACK : voir CLAUDE.md, section pare-feu.
const ts = require('typescript'), fs = require('fs'), path = require('path')
const out = path.join(__dirname, '.build'); fs.mkdirSync(out, { recursive: true })
const src = fs.readFileSync(path.join(__dirname, '../../../src/lib/payments/firewall.ts'), 'utf8')
  .replace(/from '@\/lib\/supabase\/admin'/g, "from '../fakeAdmin.cjs'")
fs.writeFileSync(path.join(out, 'firewall.cjs'), ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText)
require('./scenario.cjs')
