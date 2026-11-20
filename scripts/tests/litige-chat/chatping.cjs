// Test de src/lib/chatPing.ts (reconnaissance des messages PING et du miroir du litige).
//   node scripts/tests/litige-chat/chatping.cjs
const ts = require('typescript'), fs = require('fs'), path = require('path'), assert = require('assert')
const out = path.join(__dirname, '.build'); fs.mkdirSync(out, { recursive: true })
fs.writeFileSync(path.join(out, 'chatPing.cjs'), ts.transpileModule(fs.readFileSync(path.join(__dirname, '../../../src/lib/chatPing.ts'), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText)
const { isPingMessage, specialChatKind } = require(path.join(out, 'chatPing.cjs'))
const tx = { buyer_id: 'A', seller_id: 'P' }
let ok = 0
const t = (n, f) => { f(); ok++; console.log('  OK  ' + n) }
t('kind mediation = PING', () => assert.strictEqual(specialChatKind({ sender_id: 'X', kind: 'mediation' }, tx), 'ping'))
t('expéditeur ni acheteur ni vendeur (repli kind text) = PING', () => assert.strictEqual(specialChatKind({ sender_id: 'X', kind: 'text' }, tx), 'ping'))
t('message ordinaire du client = bulle', () => assert.strictEqual(specialChatKind({ sender_id: 'A', kind: 'text' }, tx), null))
t('message ordinaire du prestataire = bulle', () => assert.strictEqual(specialChatKind({ sender_id: 'P', kind: 'text' }, tx), null))
t('message système (sender null) = jamais PING', () => assert.strictEqual(specialChatKind({ sender_id: null, kind: 'system' }, tx), null))
t('proposition de tarif = jamais une carte spéciale', () => assert.strictEqual(specialChatKind({ sender_id: 'X', kind: 'offer' }, tx), null))
t('miroir d\'un litige (partie) = carte litige', () => assert.strictEqual(specialChatKind({ sender_id: 'A', kind: 'text', dispute_id: 'D' }, tx), 'litige'))
t('miroir d\'un litige (PING) = carte litige, signée PING', () => { const m = { sender_id: 'X', kind: 'mediation', dispute_id: 'D' }; assert.strictEqual(specialChatKind(m, tx), 'litige'); assert.ok(isPingMessage(m, tx)) })
t('mission pas encore chargée (tx absent) : jamais de faux PING', () => assert.strictEqual(specialChatKind({ sender_id: 'X', kind: 'text' }, null), null))
console.log(`\n${ok} OK, 0 KO`)
