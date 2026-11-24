// Tests du calcul de facture (src/lib/billing.ts) et des PDF (src/lib/invoice-pdf.ts), sans réseau ni framework.
//   node scripts/tests/facturation/run.cjs
// 1. Calcul pur : forfait + heures incluses + dépassement, seuil « heure entamée », horaire pur, forfait seul,
//    commissions figées, arrondis en centimes.
// 2. Parité avec la fonction SQL `_presence_amounts` (migration 038, celle qui fait foi en production) si un
//    PostgreSQL local est disponible (variable PGTEST_DSN, ou serveur local avec l'utilisateur postgres) ; sinon ignoré.
// 3. PDF : en-tête entreprise avec SIRET (facture) / récapitulatif particulier sans SIRET / relevé PING.
const ts = require('typescript'), fs = require('fs'), path = require('path'), assert = require('assert')
const { execFileSync, spawnSync } = require('child_process')
const root = path.join(__dirname, '../../..')
const out = path.join(__dirname, '.build'); fs.mkdirSync(out, { recursive: true })
const tr = (f, rewrite = s => s) => ts.transpileModule(rewrite(fs.readFileSync(path.join(root, f), 'utf8')),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
fs.writeFileSync(path.join(out, 'billing.cjs'), tr('src/lib/billing.ts'))
// presence.ts importe '@/lib/netError' depuis le 23/11 : transpilé à côté, chemin réécrit (24/11).
fs.writeFileSync(path.join(out, 'netError.cjs'), tr('src/lib/netError.ts'))
fs.writeFileSync(path.join(out, 'presence.cjs'), tr('src/lib/presence.ts', s => s.replace("from '@/lib/netError'", "from './netError.cjs'")))
fs.writeFileSync(path.join(out, 'proStatus.cjs'), tr('src/lib/proStatus.ts'))
fs.writeFileSync(path.join(out, 'invoice-pdf.cjs'), tr('src/lib/invoice-pdf.ts',
  s => s.replace("from './presence'", "from './presence.cjs'").replace("from './proStatus'", "from './proStatus.cjs'")))
const { billedHours, computeFinalAmounts } = require(path.join(out, 'billing.cjs'))

let ok = 0, ko = 0
const show = (name, e) => { if (!e) { ok++; console.log('  OK  ' + name) } else { ko++; console.log('  KO  ' + name + '\n      ' + String(e.message).split('\n').join('\n      ')) } }
const t = (name, fn) => { try { fn(); show(name) } catch (e) { show(name, e) } }
const ta = async (name, fn) => { try { await fn(); show(name) } catch (e) { show(name, e) } }
const HM = (h, m) => h * 60 + m
const LIVE = { buyer: 0.08, seller: 0.17 }
const KEYS = ['subtotal_cents', 'buyer_fee_cents', 'seller_fee_cents', 'total_charged_cents', 'payout_cents']

// Fiches de prix de test, avec les frais figés à la réservation (8 % client, 17 % prestataire).
const frozen = (subtotal, b = 0.08, s = 0.17) => ({ subtotal_cents: subtotal, buyer_fee_cents: Math.round(subtotal * b), seller_fee_cents: Math.round(subtotal * s),
  total_charged_cents: subtotal + Math.round(subtotal * b), payout_cents: subtotal - Math.round(subtotal * s) })
const forfait90 = { ...frozen(9000), hourly_rate_cents: 2500, base_forfait_cents: 9000, included_hours: 2 }

console.log('\n1. billedHours (seuil heure entamée)')
t('3 h 10 avec seuil 15 : 3 h', () => assert.strictEqual(billedHours(HM(3, 10), 15), 3))
t('3 h 20 avec seuil 15 : 4 h', () => assert.strictEqual(billedHours(HM(3, 20), 15), 4))
t('seuil exact (3 h 15, seuil 15) : 4 h', () => assert.strictEqual(billedHours(HM(3, 15), 15), 4))
t('0 minute : 0 h', () => assert.strictEqual(billedHours(0, 10), 0))

console.log('\n2. Forfait 2 h pour 90 € + dépassement 25 €/h (seuil 10 min)')
const cas = [['3 h sur place : base + 1 h', HM(3, 0), 11500, 1], ['2 h 05 : sous le seuil, rien en plus', HM(2, 5), 9000, 0], ['2 h 09 : sous le seuil', HM(2, 9), 9000, 0],
  ['2 h 10 : seuil atteint, 1 h en plus', HM(2, 10), 11500, 1], ['2 h 40 : 1 h en plus (pas 2)', HM(2, 40), 11500, 1], ['3 h 09 : 1 h en plus', HM(3, 9), 11500, 1],
  ['3 h 10 : 2 h en plus', HM(3, 10), 14000, 2], ['1 h seulement : le forfait reste dû en entier', HM(1, 0), 9000, 0], ['0 min : forfait', 0, 9000, 0]]
for (const [nom, mins, sub, bh] of cas) t(nom + ' = ' + sub / 100 + ' EUR', () => {
  const r = computeFinalAmounts(forfait90, mins, 10, LIVE)
  assert.strictEqual(r.subtotal_cents, sub); assert.strictEqual(r.billed_hours, bh); assert.strictEqual(r.recalcule, true)
})
t('seuil par défaut (15) : 2 h 10 ne donne pas d\'heure en plus', () => assert.strictEqual(computeFinalAmounts(forfait90, HM(2, 10), 15, LIVE).subtotal_cents, 9000))

console.log('\n3. Horaire pur (25 EUR/h, minimum 1 h)')
const horaire = { ...frozen(2500), hourly_rate_cents: 2500, base_forfait_cents: null, included_hours: null }
for (const [nom, mins, sub] of [['20 min : minimum 1 h', 20, 2500], ['0 min : minimum 1 h', 0, 2500], ['1 h 05 (seuil 10) : 1 h', HM(1, 5), 2500], ['1 h 10 : 2 h', HM(1, 10), 5000], ['3 h : 3 h', HM(3, 0), 7500]])
  t(nom, () => assert.strictEqual(computeFinalAmounts(horaire, mins, 10, LIVE).subtotal_cents, sub))

console.log('\n4. Forfait seul (aucun tarif horaire) : jamais ajusté')
const seul = { ...frozen(9000), hourly_rate_cents: null, base_forfait_cents: null, included_hours: null }
for (const mins of [10, HM(2, 0), HM(5, 0), HM(12, 0)]) t(`${mins} min sur place : 90,00 EUR inchangé, frais figés`, () => {
  const r = computeFinalAmounts(seul, mins, 10, LIVE)
  assert.strictEqual(r.recalcule, false); assert.strictEqual(r.subtotal_cents, 9000); assert.strictEqual(r.buyer_fee_cents, 720)
  assert.strictEqual(r.seller_fee_cents, 1530); assert.strictEqual(r.total_charged_cents, 9720); assert.strictEqual(r.payout_cents, 7470)
})
t('hourly_rate_cents = 0 traité comme forfait seul', () => assert.strictEqual(computeFinalAmounts({ ...seul, hourly_rate_cents: 0 }, HM(4, 0), 10, LIVE).recalcule, false))

console.log('\n5. Cas réel du 17/09 : forfait 80 EUR / 3 h incluses / 5 h sur place à 15 EUR/h')
const reel = { ...frozen(8000), hourly_rate_cents: 1500, base_forfait_cents: 8000, included_hours: 3 }
t('80 + 2 h x 15 = 110,00 EUR', () => { const r = computeFinalAmounts(reel, HM(5, 0), 15, LIVE); assert.strictEqual(r.subtotal_cents, 11000); assert.strictEqual(r.billed_hours, 2) })
t('commissions 8 % / 17 % : 8,80 / 18,70, total client 118,80, net prestataire 91,30', () => {
  const r = computeFinalAmounts(reel, HM(5, 0), 15, LIVE)
  assert.deepStrictEqual([r.buyer_fee_cents, r.seller_fee_cents, r.total_charged_cents, r.payout_cents], [880, 1870, 11880, 9130])
})

console.log('\n6. Commissions figées et arrondis')
t('taux figés à 5 % / 11 % à la réservation : le réglage du jour (8 / 17) est ignoré (5,50 et 12,10 du 17/09)', () => {
  const tx = { ...frozen(8000, 0.05, 0.11), hourly_rate_cents: 1500, base_forfait_cents: 8000, included_hours: 3 }
  const r = computeFinalAmounts(tx, HM(5, 0), 15, LIVE)
  assert.deepStrictEqual([r.subtotal_cents, r.buyer_fee_cents, r.seller_fee_cents], [11000, 550, 1210])
})
t('sous-total d\'origine nul : repli sur les taux du jour', () => {
  const r = computeFinalAmounts({ hourly_rate_cents: 2000, subtotal_cents: 0, buyer_fee_cents: 0, seller_fee_cents: 0 }, HM(2, 0), 15, LIVE)
  assert.deepStrictEqual([r.subtotal_cents, r.buyer_fee_cents, r.seller_fee_cents], [4000, 320, 680])
})
t('arrondi au centime : 33,33 EUR/h x 1 h, frais 2,67 (2,6664) et 5,67 (5,6661)', () => {
  const tx = { ...frozen(3333), hourly_rate_cents: 3333, base_forfait_cents: null, included_hours: null }
  const r = computeFinalAmounts(tx, HM(1, 0), 10, LIVE)
  assert.deepStrictEqual([r.subtotal_cents, r.buyer_fee_cents, r.seller_fee_cents, r.total_charged_cents, r.payout_cents], [3333, 267, 567, 3600, 2766])
})
t('1 000 cas aléatoires : montants entiers, total = sous-total + frais client, net = sous-total - commission', () => {
  let seed = 7; const rnd = n => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) % n
  for (let i = 0; i < 1000; i++) {
    const hr = 500 + rnd(9000), inc = rnd(4), base = hr * inc + rnd(3000)
    const tx = { ...frozen(base, 0.08, 0.17), hourly_rate_cents: hr, base_forfait_cents: rnd(2) ? base : null, included_hours: rnd(2) ? inc : null }
    const r = computeFinalAmounts(tx, rnd(600), 10, LIVE)
    for (const k of KEYS) assert.ok(Number.isInteger(r[k]), k)
    assert.strictEqual(r.total_charged_cents, r.subtotal_cents + r.buyer_fee_cents); assert.strictEqual(r.payout_cents, r.subtotal_cents - r.seller_fee_cents)
  }
})

// ---------- Parité avec la fonction SQL ----------
function parity() {
  console.log('\n7. Parité avec public._presence_amounts (migration 038) sur PostgreSQL local')
  const dsn = process.env.PGTEST_DSN
  let uid
  if (!dsn && process.getuid && process.getuid() === 0) { try { uid = Number(execFileSync('id', ['-u', 'postgres']).toString()) } catch { uid = undefined } }
  const base = dsn ? [dsn] : ['-d', 'postgres']
  const run = (extra) => spawnSync('psql', [...base, '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', ...extra], { encoding: 'utf8', uid })
  const probe = run(['-c', 'select 1'])
  if (probe.status !== 0) { console.log('  --  PostgreSQL local indisponible : parité SQL ignorée (' + String(probe.stderr || probe.error).trim().split('\n')[0] + ')'); return }
  const mig = fs.readFileSync(path.join(root, 'supabase/migrations/038_arrivee_depart_securise.sql'), 'utf8')
  const fns = [mig.match(/create or replace function public\._presence_setting_num[\s\S]*?\$\$;/)[0], mig.match(/create or replace function public\._presence_amounts[\s\S]*?end \$\$;/)[0]]
    .map(s => s.replace(/public\./g, 'parite.').replace(/search_path = public/g, 'search_path = parite'))
  const cases = []; let seed = 11; const rnd = n => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) % n
  for (let i = 0; i < 400; i++) {
    const hr = rnd(10) ? 500 + rnd(9000) : 0, inc = rnd(4), sub = hr * inc + rnd(3000) + 100, f = rnd(2)
    const b = [0.05, 0.08, 0.1][rnd(3)], s = [0.11, 0.17, 0.2][rnd(3)]
    cases.push({ i, hr, base: f ? sub : null, inc: f ? inc : null, sub, b: Math.round(sub * b), s: Math.round(sub * s), thr: [10, 15, 0, 30][rnd(4)], mins: rnd(900) })
  }
  const id = c => `'00000000-0000-0000-0000-${String(c.i).padStart(12, '0')}'`
  let sql = 'drop schema if exists parite cascade; create schema parite; set search_path = parite;\n'
    + 'create table app_settings(key text primary key, value jsonb);\n'
    + 'create table transactions(id uuid primary key, arrived_at timestamptz, hourly_rate_cents bigint, base_forfait_cents bigint, included_hours int, subtotal_cents bigint, buyer_fee_cents bigint, seller_fee_cents bigint, total_charged_cents bigint, payout_cents bigint);\n'
    + fns.join('\n') + '\n'
  for (const c of cases) sql += `insert into transactions values (${id(c)}, '2026-01-01 10:00+00', ${c.hr}, ${c.base ?? 'null'}, ${c.inc ?? 'null'}, ${c.sub}, ${c.b}, ${c.s}, ${c.sub + c.b}, ${c.sub - c.s});\n`
  for (const thr of [10, 15, 0, 30]) {
    sql += `delete from app_settings; insert into app_settings values ('billing_hour_threshold_minutes', '${thr}'::jsonb);\n`
    for (const c of cases.filter(c => c.thr === thr)) sql += `select ${c.i} || ' ' || parite._presence_amounts(${id(c)}, '2026-01-01 10:00+00'::timestamptz + interval '${c.mins} minutes')::text;\n`
  }
  const file = path.join(out, 'parite.sql'); fs.writeFileSync(file, sql)
  if (uid !== undefined) { fs.chmodSync(out, 0o755); fs.chmodSync(file, 0o644) }
  const r = run(['-f', file])
  if (r.status !== 0) { show('exécution SQL', new Error(r.stderr)); return }
  const res = {}
  for (const l of r.stdout.split('\n').filter(l => /^\d+ \{/.test(l))) res[Number(l.split(' ')[0])] = JSON.parse(l.slice(l.indexOf(' ') + 1))
  let diff = 0
  for (const c of cases) {
    const tx = { hourly_rate_cents: c.hr, base_forfait_cents: c.base, included_hours: c.inc, subtotal_cents: c.sub, buyer_fee_cents: c.b, seller_fee_cents: c.s, total_charged_cents: c.sub + c.b, payout_cents: c.sub - c.s }
    const a = computeFinalAmounts(tx, c.mins, c.thr, LIVE), q = res[c.i]
    for (const k of KEYS) if (Number(q[k]) !== a[k]) { diff++; if (diff <= 5) console.log('      écart', JSON.stringify(c), k, 'SQL', q[k], 'TS', a[k]) }
  }
  t(`${cases.length} cas aléatoires (4 seuils, forfait/horaire/forfait seul) : TS = SQL sur les 5 montants`, () => assert.strictEqual(diff, 0, diff + ' écart(s)'))
  run(['-c', 'drop schema if exists parite cascade'])
}

// ---------- PDF ----------
async function pdf() {
  console.log('\n8. PDF : facture entreprise (SIRET) / récapitulatif particulier (sans SIRET) / relevé PING')
  const { buildInvoicePdf, docTitle } = require(path.join(out, 'invoice-pdf.cjs'))
  const { PDFDocument } = require('pdf-lib')
  const zlib = require('zlib')
  // Texte d'un PDF produit par pdf-lib : chaînes hexadécimales (polices standard, WinAnsi), flux éventuellement compressés.
  async function textOf(blob) {
    const doc = await PDFDocument.load(Buffer.from(await blob.arrayBuffer()), { updateMetadata: false })
    let all = ''
    doc.context.enumerateIndirectObjects().forEach(([, o]) => {
      if (!o.contents) return
      const s = Buffer.from(o.contents); let d = s
      try { d = zlib.inflateSync(s) } catch (e) { d = s }
      all += d.toString('latin1') + '\n'
    })
    const lines = [...all.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)].map(m => Buffer.from(m[1], 'hex').toString('latin1'))
    return { doc, text: lines.join('\n').replace(/[  ]/g, ' ') }
  }
  const lineF = { prestation: 'Ménage', duree_min: 300, montant_cents: 11000 }
  const facture = { number: 'FACT-2026-0001', kind: 'prestation', template: 'facture', issued_at: '2026-11-20T10:00:00Z', net_cents: 11000,
    issuer_snapshot: { nom: 'Marie Durand', enseigne: 'Eclat Services', siret: '123 456 789 00012', adresse: '1 rue des Fleurs', ville: '06000 Nice' },
    client_snapshot: { nom: 'Client Test', adresse: '2 avenue Bleue', ville: '06100 Nice' }, lines: [lineF],
    legal: { franchise_tva: 'TVA non applicable, art. 293 B du CGI', categorie_operation: 'Prestation de services', penalites: 'Pénalités de retard : 3 fois le taux légal.' } }
  const recap = { ...facture, number: 'RECAP-2026-0002', template: 'recapitulatif', issuer_snapshot: { nom: 'Paul Martin', adresse: '3 rue Haute', ville: '06300 Nice' },
    legal: { avertissement: 'Ce document n\'est pas une facture : l\'intervenant est un particulier non immatriculé.', declaration: 'À déclarer par l\'intervenant.' } }
  const commission = { number: 'PING-C-2026-0003', kind: 'commission_client', template: 'commission', issued_at: '2026-11-20T10:00:00Z', net_cents: 880,
    issuer_snapshot: { nom: 'PING' }, client_snapshot: { nom: 'Client Test' }, lines: [{ libelle: 'Frais de service', montant_cents: 880 }], legal: { taux: '8.0 %' } }

  await ta('facture : titre « Facture », en-tête au nom de l\'enseigne, SIRET, 110,00 EUR, jamais « PING »', async () => {
    assert.strictEqual(docTitle(facture), 'Facture')
    const { doc, text } = await textOf(await buildInvoicePdf(facture))
    assert.ok(text.includes('Eclat Services'), 'enseigne absente'); assert.ok(text.includes('SIRET 123 456 789 00012'), 'SIRET absent')
    assert.ok(text.includes('FACTURE'), 'titre absent'); assert.ok(text.includes('110,00'), 'montant absent')
    assert.ok(!/\bping\b/i.test(text), 'PING ne doit pas apparaître sur la facture du prestataire')
    assert.ok(!/Particulier/.test(text), 'mention particulier sur une facture')
    assert.ok(/Eclat Services/.test(doc.getAuthor() || ''), 'auteur des métadonnées : ' + doc.getAuthor())
    assert.ok(!/ping/i.test((doc.getProducer() || '') + (doc.getCreator() || '')), 'PING dans les métadonnées')
  })
  await ta('récapitulatif particulier : aucun SIRET, bandeau « pas une facture », « non immatriculé », « Montant perçu »', async () => {
    assert.strictEqual(docTitle(recap), "Récapitulatif d'intervention")
    const { text } = await textOf(await buildInvoicePdf(recap))
    assert.ok(!/SIRET/.test(text), 'SIRET sur un récapitulatif de particulier'); assert.ok(/non immatricul/.test(text), 'mention non immatriculé absente')
    assert.ok(/pas une facture/.test(text), 'bandeau absent'); assert.ok(/Montant per/.test(text), '« Montant perçu » absent')
    assert.ok(!/\bFACTURE\b/.test(text), 'le mot FACTURE en titre')
  })
  await ta('relevé PING (société non immatriculée) : « Immatriculation en cours », jamais de SIRET inventé, producteur PING', async () => {
    assert.strictEqual(docTitle(commission), 'Relevé de frais de service PING')
    const { doc, text } = await textOf(await buildInvoicePdf(commission))
    assert.ok(!/SIRET/.test(text), 'SIRET inventé'); assert.ok(/Immatriculation en cours/.test(text)); assert.ok(text.includes('8,80'))
    assert.strictEqual(doc.getProducer(), 'PING')
  })
  await ta('le même relevé PING avec un SIRET devient une « Facture »', async () => {
    assert.strictEqual(docTitle({ ...commission, issuer_snapshot: { nom: 'PING SAS', siret: '999 999 999 00019' } }), 'Facture')
  })
  await ta('forme : désignation longue coupée à la ligne, accents des mentions légales, pied « fait foi » réservé au relevé PING, « Prélevés » remplacé', async () => {
    const long = { ...lineF, date: '20/11/2026', forfait_cents: 9000, heures_incluses: 3, taux_horaire_cents: 2500, arrivee: '2026-11-20T08:00:00Z', depart: '2026-11-20T13:00:00Z' }
    const legal = { ...facture.legal, penalites: 'En cas de retard de paiement, penalites au taux de 3 fois le taux d\'interet legal, exigibles sans rappel prealable.',
      indemnite_recouvrement: 'Indemnite forfaitaire pour frais de recouvrement : 40 EUR.', escompte: 'Pas d\'escompte pour paiement anticipe. é è ê à ç ô' }
    const f = await textOf(await buildInvoicePdf({ ...facture, lines: [long], legal }))
    if (process.env.PDF_DUMP) console.log(f.text)
    assert.ok(/puis\n25,00 .? de l'heure/.test(f.text), 'fin de la ligne de tarif absente (coupée ?)')
    assert.ok(f.text.includes('pénalités') && f.text.includes('intérêt légal') && f.text.includes('préalable') && f.text.includes('Indemnité') && f.text.includes('anticipé'), 'accents')
    assert.ok(f.text.includes('é è ê à ç ô'), 'é è ê à ç ô non imprimés')
    assert.ok(!/fait foi/.test(f.text), '« fait foi » sur la facture du prestataire')
    const c = await textOf(await buildInvoicePdf({ ...commission, lines: [{ libelle: 'Frais de mise en relation', detail: 'Prélevés sur l\'intervention du 20/11/2026', montant_cents: 880 }] }))
    assert.ok(/fait foi/.test(c.text), '« fait foi » absent du relevé PING sans SIRET')
    assert.ok(!/Prélev/.test(c.text) && c.text.includes('À régler par virement, intervention du 20/11/2026'), c.text)
    assert.ok(c.text.includes('Frais de service PING'))
    const cs = await textOf(await buildInvoicePdf({ ...commission, issuer_snapshot: { nom: 'PING SAS', siret: '999 999 999 00019' } }))
    assert.ok(!/fait foi/.test(cs.text), '« fait foi » sur une facture PING avec SIRET')
  })
  await ta('facture >= 1 000 EUR (espace fine des milliers) : le PDF se construit et affiche 1 234,56', async () => {
    const { text } = await textOf(await buildInvoicePdf({ ...facture, net_cents: 123456, lines: [{ ...lineF, montant_cents: 123456 }] }))
    assert.ok(text.includes('1 234,56'), text.slice(0, 200))
  })
}

parity()
pdf().then(() => { console.log(`\n${ok} OK, ${ko} KO`); process.exit(ko ? 1 : 0) }, e => { console.error(e); process.exit(1) })
