// Virement « non reçu » de bout en bout sur la prod (comptes audit). Nécessite la migration 059 collée ;
// sinon le scénario s'arrête proprement avec « 059 non appliquée » (code de sortie 0).
//   Client : « J'ai fait le virement » -> Prestataire : « Non reçu » (+ précision) -> Client : bandeau, puis
//   « Mon virement est bien parti » -> Prestataire : « Désaccord » -> Prestataire : « Je l'ai reçu ».
// Vérifie aussi que le message système est dans la conversation et que le client ne peut pas contester lui-même.
//   BASE=http://localhost:3000 node scripts/e2e/virement-non-recu.mjs   (défaut : la prod)
//   MISSION=<id> pour imposer une mission terminée dont la prestation est « À régler ».
// Laisse la mission avec la prestation notée reçue (comme les autres scénarios, la donnée reste en base).
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'

const BASE = process.env.BASE || 'https://nexto-eta.vercel.app'
const SB = ['https://wmiawwaxwlvascyflpba.supabase.co', 'sb_publishable_ehRFsNEJD1hnkOyi7vdfEA_NJey8yfP']
const CLIENT = 'audit.client.claude@ping-demo.invalid', PRO = 'audit.pro.claude@ping-demo.invalid', PWD = 'AuditPing2026!'
let ok = 0, ko = 0
const check = (c, m) => { c ? ok++ : ko++; console.log((c ? 'OK    ' : 'ECHEC ') + m) }

// 1. Mission candidate : prestation client -> pro encore à régler, via l'API (RLS : chacun voit ses virements).
const sb = createClient(...SB, { auth: { persistSession: false } })
const { data: s1, error: e1 } = await sb.auth.signInWithPassword({ email: CLIENT, password: PWD })
if (e1) { console.log('Connexion client impossible :', e1.message); process.exit(1) }
const { data: rows, error: e2 } = await sb.from('transfer_payments').select('*').eq('payer_id', s1.user.id).eq('payee', 'pro').in('status', ['a_payer', 'declare_paye']).order('created_at', { ascending: false }).limit(20)
if (e2) { console.log('Lecture des virements impossible :', e2.message); process.exit(1) }
if (rows.length && !('not_received_at' in rows[0])) { console.log('059 non appliquée (colonne not_received_at absente) : scénario ignoré.'); process.exit(0) }
const t0 = process.env.MISSION ? rows.find(r => r.transaction_id === process.env.MISSION) : rows[0]
if (!t0) { console.log('Aucune prestation « À régler » entre les comptes audit : lancer d\'abord scripts/e2e/parcours.mjs (crée une mission terminée et facturée), ou passer MISSION=<id>.'); process.exit(0) }
const MISSION = t0.transaction_id
console.log(`Mission ${MISSION}, virement ${t0.reference} (${t0.amount_cents / 100} €), statut de départ ${t0.status}`)

const b = await chromium.launch()
async function session(email, mode) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } })
  const p = await ctx.newPage(); const errs = []
  p.on('pageerror', e => errs.push(e.message.slice(0, 120)))
  await p.goto(BASE + '/auth/login'); await p.fill('input[type=email]', email); await p.fill('input[type=password]', PWD)
  await p.click('button[type=submit]'); await p.waitForTimeout(4500)
  await p.evaluate(m => { try { localStorage.setItem('ping_mode', m) } catch { } }, mode)
  return { p, ctx, errs }
}
const text = async p => (await p.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
const open = async p => { await p.goto(`${BASE}/mission/${MISSION}/facture`); await p.waitForTimeout(5000) }

// 2. Client : annonce son virement.
const c = await session(CLIENT, 'particulier'); await open(c.p)
if (t0.status === 'a_payer') {
  await c.p.getByRole('button', { name: /J’ai fait le virement/ }).first().click(); await c.p.waitForTimeout(2500)
}
check(/Virement annoncé/.test(await text(c.p)), 'client : le virement de la prestation est « annoncé »')

// 3. Le client ne peut pas se déclarer lui-même « non reçu » (RPC refusée par la base).
const r1 = await sb.rpc('transfer_report_not_received', { p_transfer: t0.id, p_note: 'test' })
check(!!r1.error, 'client : « non reçu » refusé par la base (' + (r1.error?.message || 'aucune erreur') + ')')

// 4. Prestataire : « Non reçu » avec précision.
const pr = await session(PRO, 'pro'); await open(pr.p)
await pr.p.getByRole('button', { name: 'Non reçu', exact: true }).first().click(); await pr.p.waitForTimeout(500)
await pr.p.locator('textarea').first().fill('Rien sur mon relevé (test e2e)')
await pr.p.getByRole('button', { name: /Confirmer : non reçu/ }).click(); await pr.p.waitForTimeout(3000)
let tp = await text(pr.p)
check(/Vous avez indiqué ne rien avoir reçu/.test(tp) && /Non reçu/.test(tp), 'prestataire : la contestation est enregistrée et affichée')

// 5. Client : bandeau + conversation + « Mon virement est bien parti ».
await open(c.p)
let tc = await text(c.p)
check(/indique ne pas avoir reçu ce virement/.test(tc), 'client : bandeau « le prestataire indique ne pas avoir reçu »')
check(/Rien sur mon relevé/.test(tc), 'client : la précision du prestataire est affichée')
await c.p.goto(`${BASE}/mission/${MISSION}/chat`); await c.p.waitForTimeout(5000)
check(/n’a pas reçu le virement de la prestation|n'a pas reçu le virement de la prestation/.test(await text(c.p)), 'client : message système dans la conversation de la mission')
await open(c.p)
await c.p.getByRole('button', { name: /^Mon virement est bien parti$/ }).first().click(); await c.p.waitForTimeout(500)
await c.p.locator('textarea').first().fill('Virement fait ce matin (test e2e)')
await c.p.getByRole('button', { name: /Confirmer : mon virement est bien parti/ }).click(); await c.p.waitForTimeout(3000)
tc = await text(c.p)
check(/Vous maintenez avoir fait ce virement/.test(tc), 'client : désaccord enregistré, PING informé')

// 6. Prestataire : voit le désaccord puis note reçu.
await open(pr.p); tp = await text(pr.p)
check(/Le client maintient avoir fait le virement/.test(tp), 'prestataire : le désaccord est visible')
await pr.p.goto(`${BASE}/pro/paiements`); await pr.p.waitForTimeout(5000)
check(/Virements de vos clients à vérifier/.test(await text(pr.p)), 'prestataire : /pro/paiements liste le virement à vérifier')
await open(pr.p)
await pr.p.getByRole('button', { name: /Je l’ai reçu/ }).first().click(); await pr.p.waitForTimeout(3000)
check(/Noté reçu/.test(await text(pr.p)), 'prestataire : virement noté reçu, désaccord clos')
const { data: fin } = await sb.from('transfer_payments').select('status, not_received_at, reaffirmed_at').eq('id', t0.id).single()
check(fin.status === 'recu' && !!fin.not_received_at && !!fin.reaffirmed_at, 'base : statut recu, historique de la contestation conservé')

for (const x of [c, pr]) check(x.errs.length === 0, 'aucune erreur JavaScript' + (x.errs.length ? ' : ' + x.errs.join(' | ') : ''))
await b.close()
console.log(`\n${ok} vérifications réussies, ${ko} échecs`)
process.exit(ko ? 1 : 0)
