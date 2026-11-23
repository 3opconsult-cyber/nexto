// Test sans réseau ni base : alerte immédiate à PING (sendImmediateAdminAlert, src/lib/notifyServer.ts) et délais des e-mails de
// report / d'annulation. Client Supabase simulé en mémoire, fetch (Resend) simulé : aucun e-mail réel, aucune clé.
//   node scripts/tests/emails-immediats/run.cjs
const fs = require('fs'), path = require('path'), ts = require('typescript')
const root = path.join(__dirname, '../../..')
let ok = 0, ko = 0
const t = (name, cond) => { if (cond) { ok++; console.log('OK  ' + name) } else { ko++; console.log('KO  ' + name) } }

// --- chargeur TypeScript minimal (alias @/ -> src/, stub de @/lib/supabase/admin) ---
const cache = {}
function load(rel) {
  if (cache[rel]) return cache[rel].exports
  const src = fs.readFileSync(path.join(root, rel), 'utf8')
  const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 } }).outputText
  const mod = { exports: {} }; cache[rel] = mod
  const req = id => {
    if (id === '@/lib/supabase/admin') return { hasServiceRole: () => !!process.env.SUPABASE_SERVICE_ROLE_KEY }
    if (id.startsWith('@/')) return load('src/' + id.slice(2) + '.ts')
    return require(id)
  }
  new Function('module', 'exports', 'require', js)(mod, mod.exports, req)
  return mod.exports
}

// --- base simulée ---
function makeDb(tables, opts = {}) {
  const calls = []
  function builder(name) {
    const st = { name, filters: [], op: 'select', patch: null }
    const q = {
      select() { return q }, order() { return q }, limit() { return q },
      eq(c, v) { st.filters.push(r => get(r, c) === v); return q },
      in(c, vs) { st.filters.push(r => vs.includes(get(r, c))); return q },
      gte(c, v) { st.filters.push(r => String(get(r, c)) >= v); return q },
      is(c, v) { st.filters.push(r => (get(r, c) ?? null) === v); return q },
      update(p) { st.op = 'update'; st.patch = p; return q },
      insert(row) { (tables[name] = tables[name] || []).push({ id: 'log' + Math.random(), ...row }); calls.push(['insert', name, row]); return Promise.resolve({ error: null }) },
      maybeSingle() { return Promise.resolve({ data: rows()[0] ?? null, error: null }) },
      then(res, rej) { return run().then(res, rej) },
    }
    const get = (r, c) => c.includes('->>') ? (r[c.split('->>')[0]] || {})[c.split('->>')[1]] : r[c]
    const rows = () => (tables[name] || []).filter(r => st.filters.every(f => f(r)))
    async function run() {
      if (opts.missing && opts.missing.includes(name)) return { data: null, error: { message: 'relation does not exist' } }
      if (st.op === 'update') { const rs = rows(); rs.forEach(r => Object.assign(r, st.patch)); calls.push(['update', name, st.patch, rs.length]); return { data: rs.map(r => ({ id: r.id })), error: null } }
      return { data: rows(), error: null }
    }
    return q
  }
  return { calls, from: builder, auth: { admin: { getUserById: async id => ({ data: { user: { email: (tables.emails || {})[id] || 'x@example.com' } } }) } } }
}

const TX = '11111111-1111-4111-8111-111111111111', BUYER = 'b1', SELLER = 's1'
const now = () => new Date().toISOString()
const mk = (extra = {}) => ({
  transactions: [{ id: TX, buyer_id: BUYER, seller_id: SELLER }],
  admin_notifications: [{ id: 'n1', kind: 'payment_alert', created_at: now(), emailed_at: null, detail: { transaction_id: TX, payment_kind: 'cancel_after_arrival', gravite: 'grave' } }],
  ...extra,
})

;(async () => {
  const realFetch = global.fetch
  let sentMails = []
  global.fetch = async (url, init) => { sentMails.push({ url, body: JSON.parse(init.body) }); return { ok: true } }
  const { sendImmediateAdminAlert } = load('src/lib/notifyServer.ts')

  // 1. Sans clé : réponse propre, aucun appel réseau.
  delete process.env.RESEND_API_KEY; delete process.env.SUPABASE_SERVICE_ROLE_KEY
  let r = await sendImmediateAdminAlert(makeDb(mk()), { transactionId: TX, callerId: BUYER, kind: 'cancellation' })
  t('sans clé : {sent:false, reason:off}', r.sent === false && r.reason === 'off')
  t('sans clé : aucun appel réseau', sentMails.length === 0)

  // 2. Avec clés factices (simulées, jamais envoyées).
  process.env.RESEND_API_KEY = 'test'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'test'; delete process.env.ADMIN_NOTIFY_EMAIL
  let tables = mk(), db = makeDb(tables)
  r = await sendImmediateAdminAlert(db, { transactionId: TX, callerId: 'etranger', kind: 'cancellation' })
  t('appelant étranger à la mission : refusé', r.sent === false && r.reason === 'forbidden' && sentMails.length === 0)
  r = await sendImmediateAdminAlert(db, { transactionId: TX, callerId: BUYER, kind: 'inconnu' })
  t('kind inconnu : refusé', r.reason === 'invalid')

  r = await sendImmediateAdminAlert(db, { transactionId: TX, callerId: BUYER, kind: 'cancellation' })
  t('partie à la mission : 1 e-mail envoyé', r.sent === true && sentMails.length === 1)
  const m = sentMails[0]
  t('destinataire : repli info@opconsult.co', m.body.to[0] === 'info@opconsult.co')
  t('titre français de l’alerte dans l’objet', m.body.subject === 'PING : Annulation après l’arrivée du prestataire')
  t('lien /admin, aucun id de mission ni nom', m.body.text.includes('/admin') && !m.body.text.includes(TX) && !m.body.html.includes(TX))
  t('emailed_at posé (le cron ne le renverra pas)', !!tables.admin_notifications[0].emailed_at)
  r = await sendImmediateAdminAlert(db, { transactionId: TX, callerId: SELLER, kind: 'cancellation' })
  t('second appel : pas de deuxième e-mail', r.sent === false && sentMails.length === 1)

  // 3. Alerte trop ancienne ou déjà envoyée par le cron : rien.
  tables = mk(); tables.admin_notifications[0].created_at = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  r = await sendImmediateAdminAlert(makeDb(tables), { transactionId: TX, callerId: BUYER, kind: 'cancellation' })
  t('alerte de plus de 3 min : ignorée', r.reason === 'no_alert' && sentMails.length === 1)
  tables = mk(); tables.admin_notifications[0].detail.payment_kind = 'unsuspended'
  r = await sendImmediateAdminAlert(makeDb(tables), { transactionId: TX, callerId: BUYER, kind: 'cancellation' })
  t('autre code d’alerte : ignoré', r.reason === 'no_alert')

  // 4. Litige ouvert (titre fixe, kind dispute_open).
  tables = mk({ admin_notifications: [{ id: 'n2', kind: 'dispute_open', created_at: now(), emailed_at: null, detail: { transaction_id: TX, gravite: 'normal' } }] })
  r = await sendImmediateAdminAlert(makeDb(tables), { transactionId: TX, callerId: SELLER, kind: 'dispute_open' })
  t('litige ouvert : e-mail « Litige ouvert »', r.sent === true && sentMails[1].body.subject === 'PING : Litige ouvert')

  // 5. Comptes .invalid : réservée, aucun e-mail.
  tables = mk(); tables.emails = { [SELLER]: 'qa@ping.invalid' }
  const before = sentMails.length
  r = await sendImmediateAdminAlert(makeDb(tables), { transactionId: TX, callerId: BUYER, kind: 'cancellation' })
  t('compte .invalid : aucun e-mail, alerte réservée', r.reason === 'comptes_demo' && sentMails.length === before && !!tables.admin_notifications[0].emailed_at)

  // 6. Migration 062 absente : repli sur payment_alerts, dédoublonné par notification_log.
  tables = { transactions: [{ id: TX, buyer_id: BUYER, seller_id: SELLER }], payment_alerts: [{ id: 'p1', kind: 'provider_no_show', created_at: now(), detail: { transactionId: TX } }], notification_log: [] }
  db = makeDb(tables, { missing: ['admin_notifications'] })
  r = await sendImmediateAdminAlert(db, { transactionId: TX, callerId: BUYER, kind: 'provider_no_show' })
  t('sans table admin_notifications : repli payment_alerts, 1 e-mail', r.sent === true)
  r = await sendImmediateAdminAlert(db, { transactionId: TX, callerId: BUYER, kind: 'provider_no_show' })
  t('sans table admin_notifications : pas de doublon', r.sent === false && r.reason === 'deja_envoye')
  r = await sendImmediateAdminAlert(makeDb({ transactions: tables.transactions }, { missing: ['admin_notifications', 'payment_alerts'] }), { transactionId: TX, callerId: BUYER, kind: 'cancellation' })
  t('aucune des deux tables : réponse propre', r.sent === false)
  r = await sendImmediateAdminAlert(makeDb({ transactions: tables.transactions }, { missing: ['admin_notifications'] }), { transactionId: TX, callerId: BUYER, kind: 'dispute_open' })
  t('litige sans 062 : réponse propre', r.reason === 'migration_062_absente')

  // 7. Échec Resend : l'alerte est rendue au cron.
  global.fetch = async () => ({ ok: false })
  tables = mk()
  r = await sendImmediateAdminAlert(makeDb(tables), { transactionId: TX, callerId: BUYER, kind: 'cancellation' })
  t('échec Resend : emailed_at remis à null (cron)', r.reason === 'provider_error' && tables.admin_notifications[0].emailed_at === null)
  global.fetch = realFetch

  // 8. Délais des e-mails de report et d'annulation (lecture du code).
  const nsrc = load('src/lib/notifyServer.ts')
  for (const ev of ['reschedule_proposed', 'reschedule_answer', 'cancelled_by_client', 'cancelled_by_provider', 'provider_no_show'])
    t(`${ev} : limite propre à l’événement (non bloquée par un message)`, nsrc.OWN_THROTTLE_EVENTS.includes(ev))
  const canc = fs.readFileSync(path.join(root, 'src/lib/cancellation.ts'), 'utf8')
  t('report proposé : notifyOther juste après la RPC réussie', /propose_reschedule[\s\S]{0,200}if \(r\.ok\) notifyOther\(txId, 'reschedule_proposed'\)/.test(canc))
  t('annulation : notifyOther juste après la RPC réussie', /rpc\('cancel_booking'[\s\S]{0,900}notifyOther\(tx\.id, userId === tx\.buyer_id \? 'cancelled_by_client'/.test(canc))
  const vj = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'))
  t('aucun cron n’envoie les e-mails de report', !JSON.stringify(vj).includes('reschedule'))

  console.log(`\n${ok} OK, ${ko} KO`)
  process.exit(ko ? 1 : 0)
})()
