// Données FICTIVES de démonstration (demande Romain 30/10/2026) : pour examiner tout le parcours,
// côté client et côté prestataire, sans attendre de vrais utilisateurs.
//
// Tout est marqué : titres « Exemple — … », descriptions « (Donnée fictive de démonstration) », et
// uniquement des comptes @ping-demo.invalid. Suppression : supabase/a_coller/nettoyage_donnees_fictives.sql.
//
// Usage : node factice.mjs   (npm i @supabase/supabase-js@2.45.4)
import { createClient } from '@supabase/supabase-js'

const URL = 'https://wmiawwaxwlvascyflpba.supabase.co'
const KEY = 'sb_publishable_ehRFsNEJD1hnkOyi7vdfEA_NJey8yfP'
const TAG = '(Donnée fictive de démonstration)'
const log = (...a) => console.log('##', ...a)

async function login(email, password, signup) {
  const sb = createClient(URL, KEY, { auth: { persistSession: false } })
  let { data, error } = await sb.auth.signInWithPassword({ email, password })
  if (error && signup) {
    const r = await sb.auth.signUp({ email, password, options: { data: signup } })
    if (r.error) { log('signup', email, r.error.message); return null }
    ;({ data, error } = await sb.auth.signInWithPassword({ email, password }))
  }
  if (error) { log('login', email, error.message); return null }
  return { sb, id: data.user.id, email }
}

const day = 86400000
const at = (d, h, m = 0) => { const x = new Date(Date.now() + d * day); x.setHours(h, m, 0, 0); return x.toISOString() }

const C = await login('audit.client.claude@ping-demo.invalid', 'AuditPing2026!')
const P = await login('audit.pro.claude@ping-demo.invalid', 'AuditPing2026!')
if (!C || !P) throw new Error('comptes audit indisponibles')
const extra = []
for (const [first, last] of [['Sophie', 'Martin'], ['Marc', 'Durand'], ['Léa', 'Bernard']]) {
  const email = `demo.client.${first.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '')}@ping-demo.invalid`
  const u = await login(email, 'DemoPing2026!', { first_name: first, last_name: last, full_name: `${first} ${last}` })
  if (u) extra.push(u)
}
log('clients supplémentaires', extra.map(u => u.email))

const { data: settings } = await C.sb.from('app_settings').select('key, value').in('key', ['commission_buyer_rate', 'commission_seller_rate'])
const rate = Object.fromEntries((settings ?? []).map(r => [r.key, Number(r.value)]))
const BR = rate.commission_buyer_rate ?? 0.08, SR = rate.commission_seller_rate ?? 0.17
const amounts = (sub) => ({ subtotal_cents: sub, buyer_fee_cents: Math.round(sub * BR), seller_fee_cents: Math.round(sub * SR), total_charged_cents: sub + Math.round(sub * BR), payout_cents: sub - Math.round(sub * SR) })

async function msg(u, tx, body, extraCols = {}, when) {
  const row = { transaction_id: tx, sender_id: u.id, body, ...extraCols }
  if (when) row.created_at = when
  let { data, error } = await u.sb.from('messages').insert(row).select('id').single()
  if (error && when) ({ data, error } = await u.sb.from('messages').insert({ ...row, created_at: undefined }).select('id').single())
  if (error) log('message', body.slice(0, 30), error.message)
  return data?.id
}
const sys = (u, tx, body, when) => msg(u, tx, body, { kind: 'system' }, when)

// ---------- 1. Cinq demandes ouvertes, visibles sur la carte des prestataires ----------
const open = [
  { by: C, title: 'Exemple — Ménage complet après déménagement', category: 'menage', urgent: true, addr: 'Valbonne', lat: 43.6417, lng: 7.0094, min: 8000, max: 12000, date: 1, slot: 'matin', freq: 'ponctuel',
    desc: 'Appartement T3 de 68 m² vidé, à rendre propre pour l’état des lieux : cuisine (four, hotte), salle de bain, sols, placards intérieurs. Produits sur place.' },
  { by: C, title: 'Exemple — Repassage chaque semaine (2 paniers)', category: 'repassage', urgent: false, addr: 'Opio', lat: 43.6670, lng: 6.9820, min: 3000, max: 4500, date: 3, slot: 'apres-midi', freq: 'hebdomadaire',
    desc: 'Chemises, draps et linge de maison, environ 2 h par semaine. Fer et table fournis.' },
  { by: extra[0] || C, title: 'Exemple — Nettoyage de vitres, maison 120 m²', category: 'nettoyage', urgent: false, addr: 'Vence', lat: 43.7230, lng: 7.1120, min: 9000, max: 15000, date: 5, slot: 'matin', freq: 'ponctuel',
    desc: '14 fenêtres et 2 baies vitrées, dont 4 à l’étage (accès par l’intérieur). Pas d’échelle sur place.' },
  { by: extra[1] || C, title: 'Exemple — Ménage de bureaux 60 m², urgent', category: 'menage', urgent: true, addr: 'Saint-Paul-de-Vence', lat: 43.6967, lng: 7.1225, min: 6000, max: 9000, date: 0, slot: 'soir', freq: 'ponctuel',
    desc: 'Petit cabinet (3 bureaux, sanitaires, coin cuisine), à faire ce soir après 18 h avant une visite client demain matin.' },
  { by: extra[2] || C, title: 'Exemple — Grand ménage de printemps, maison T4', category: 'menage', urgent: false, addr: 'La Colle-sur-Loup', lat: 43.6862, lng: 7.1036, min: 15000, max: 22000, date: 7, slot: 'matin', freq: 'ponctuel',
    desc: 'Maison de 110 m² sur 2 niveaux : vitres intérieures, plinthes, dessus de meubles, cuisine en profondeur. Un chien calme sur place.' },
]
const openIds = []
for (const o of open) {
  const { data, error } = await o.by.sb.from('requests').insert({
    requester_id: o.by.id, category: o.category, title: o.title, description: `${o.desc} ${TAG}`,
    urgent: o.urgent, address: o.addr, lat: o.lat, lng: o.lng, status: 'open',
    budget_min_cents: o.min, budget_max_cents: o.max, budget_cents: o.max,
    desired_date: at(o.date, 12).slice(0, 10), desired_slot: o.slot, frequency: o.freq,
  }).select('id').single()
  if (error) log('demande', o.title, error.message); else openIds.push({ id: data.id, o })
}
log('demandes ouvertes créées', openIds.length)

// Le prestataire répond aux deux premières demandes du client audit : le client compare et présélectionne.
for (const [i, price, text] of [[0, 9500, 'Bonjour, je peux passer demain matin dès 8 h 30. Forfait 95 € pour le T3, produits fournis si besoin.'], [1, 3500, 'Bonjour, disponible le jeudi après-midi chaque semaine. 35 € les 2 h de repassage.']]) {
  const r = openIds[i]; if (!r) continue
  const { data: tx, error } = await P.sb.rpc('provider_respond_to_request', { p_request_id: r.id })
  if (error) { log('réponse pro', error.message); continue }
  await msg(P, tx, text)
  await msg(P, tx, 'Proposition de tarif', { kind: 'offer', offer_cents: price, offer_status: 'pending' })
}

// ---------- 2. Missions complètes entre le client audit et le prestataire audit ----------
async function mission({ title, category, addr, lat, lng, desc, created }) {
  const { data: req, error: e1 } = await C.sb.from('requests').insert({
    requester_id: C.id, category, title, description: `${desc} ${TAG}`, address: addr, lat, lng, status: 'matched',
  }).select('id').single()
  if (e1) throw new Error('requête ' + e1.message)
  const { data: tx, error: e2 } = await C.sb.from('transactions').insert({
    kind: 'service', buyer_id: C.id, seller_id: P.id, request_id: req.id, status: 'pending', price_confirmed: false, ...amounts(10000),
  }).select('id').single()
  if (e2) throw new Error('mission ' + e2.message)
  return tx.id
}
async function agree(tx, { offer, hourly = null, included = null, when, base }) {
  const oid = await msg(P, tx, 'Voici ma proposition pour cette intervention.', { kind: 'offer', offer_cents: offer, offer_hourly_cents: hourly, offer_included_hours: included, offer_status: 'pending' }, base)
  const { error } = await C.sb.from('transactions').update({
    ...amounts(offer), price_confirmed: true, scheduled_at: when,
    hourly_rate_cents: hourly, included_hours: included, base_forfait_cents: included != null ? offer : null,
  }).eq('id', tx)
  if (error) log('accord', error.message)
  if (oid) await C.sb.from('messages').update({ offer_status: 'accepted' }).eq('id', oid)
  await sys(C, tx, `✓ Rendez-vous fixé : ${new Date(when).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })} — adresse transmise au prestataire`)
}
async function run(tx, { start, minutes, final }) {
  const arrived = new Date(new Date(start).getTime() + 2 * 60000).toISOString()
  let r = await P.sb.from('transactions').update({ en_route_at: new Date(new Date(start).getTime() - 20 * 60000).toISOString(), eta_minutes: 20 }).eq('id', tx)
  if (r.error) log('en route', r.error.message)
  r = await P.sb.from('transactions').update({ arrived_at: arrived, status: 'arrived' }).eq('id', tx)
  if (r.error) log('arrivée', r.error.message)
  await sys(P, tx, `✓ Arrivée scannée à ${new Date(arrived).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })}`)
  if (minutes == null) return
  const done = new Date(new Date(arrived).getTime() + minutes * 60000).toISOString()
  r = await P.sb.from('transactions').update({ completed_at: done, status: 'completed', duration_minutes: minutes, ...(final ? amounts(final) : {}) }).eq('id', tx)
  if (r.error) log('fin', r.error.message)
  await sys(P, tx, `✓ Sortie scannée — ${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} sur place`)
}
async function review(tx, q, s, rec, tip, comment) {
  const { error } = await C.sb.from('reviews').insert({ transaction_id: tx, rater_id: C.id, ratee_id: P.id, stars: Math.round((q + s) / 2), quality_stars: q, service_stars: s, recommend: rec, tip_cents: tip, comment })
  if (error) log('avis', error.message)
}
async function clientReview(tx, a, w, tags, comment, isPublic) {
  const { error } = await P.sb.from('client_reviews').insert({ transaction_id: tx, rater_id: P.id, client_id: C.id, accuracy_stars: a, welcome_stars: w, stars: Math.round((a + w) / 2), recommend: true, tags, comment, is_public: isPublic })
  if (error) log('avis sur client (migration 016 appliquée ?)', error.message)
}

const S = {}
// S1 — terminée, forfait, avis 5 étoiles + pourboire
S.s1 = await mission({ title: 'Exemple — Ménage T3 (forfait)', category: 'menage', addr: '14 rue des Oliviers, 06130 Grasse', lat: 43.6589, lng: 6.9246, desc: 'Ménage complet d’un T3 de 65 m².' })
await msg(C, S.s1, 'Bonjour, seriez-vous disponible la semaine prochaine pour un ménage complet de mon T3 ?')
await msg(P, S.s1, 'Bonjour, oui avec plaisir. Je vous propose un forfait de 90 € pour le T3.')
await agree(S.s1, { offer: 9000, when: at(-5, 9) })
await msg(C, S.s1, 'Parfait, à mardi 9 h. Le code de la porte est donné sur place.')
await run(S.s1, { start: at(-5, 9), minutes: 148 })
await review(S.s1, 5, 5, true, 500, 'Travail impeccable, très ponctuelle et soigneuse. Je recommande.')
await clientReview(S.s1, 5, 5, ['tres_accueillant', 'materiel_fourni'], 'Client très agréable, logement conforme à la description.', true)

// S2 — terminée, forfait 100 € pour 3 h puis 25 €/h : 5 h 10 sur place → 2 h facturées en plus
S.s2 = await mission({ title: 'Exemple — Grand ménage (forfait + heures sup.)', category: 'menage', addr: '3 avenue Thiers, 06130 Grasse', lat: 43.6612, lng: 6.9301, desc: 'Grand ménage d’une maison de 95 m².' })
await msg(C, S.s2, 'Bonjour, c’est pour un grand ménage, la maison est assez encombrée.')
await agree(S.s2, { offer: 10000, included: 3, hourly: 2500, when: at(-2, 14) })
await run(S.s2, { start: at(-2, 14), minutes: 310, final: 15000 })
await review(S.s2, 4, 4, true, 0, 'Très bon travail, un peu plus long que prévu mais tout était justifié.')
await clientReview(S.s2, 3, 4, ['plus_sale', 'demande_incomplete'], 'Note pour moi : prévoir 5 h la prochaine fois, beaucoup plus encombré qu’annoncé.', false)

// S3 — à venir demain, confirmée
S.s3 = await mission({ title: 'Exemple — Repassage (à venir)', category: 'repassage', addr: '8 boulevard Victor Hugo, 06130 Grasse', lat: 43.6560, lng: 6.9230, desc: 'Deux paniers de repassage.' })
await msg(C, S.s3, 'Bonjour, deux paniers de linge, plutôt des chemises.')
await agree(S.s3, { offer: 4500, when: at(1, 10) })

// S4 — en cours (arrivé il y a une heure)
S.s4 = await mission({ title: 'Exemple — Nettoyage en cours', category: 'nettoyage', addr: '21 chemin de la Plaine, 06130 Grasse', lat: 43.6501, lng: 6.9402, desc: 'Nettoyage cuisine et salle de bain.' })
await agree(S.s4, { offer: 7000, when: at(0, new Date().getHours() - 1) })
await run(S.s4, { start: new Date(Date.now() - 65 * 60000).toISOString() })

// S5 — annulée avant le départ
S.s5 = await mission({ title: 'Exemple — Ménage annulé', category: 'menage', addr: '5 rue Droite, 06130 Grasse', lat: 43.6577, lng: 6.9218, desc: 'Ménage d’un studio.' })
await agree(S.s5, { offer: 5000, when: at(2, 9) })
await C.sb.from('transactions').update({ status: 'cancelled' }).eq('id', S.s5)
await sys(C, S.s5, '✕ Réservation annulée par le client.')

// S6 — terminée avec litige ouvert
S.s6 = await mission({ title: 'Exemple — Vitres avec réclamation', category: 'nettoyage', addr: '40 route de Nice, 06130 Grasse', lat: 43.6545, lng: 6.9350, desc: 'Vitres d’une maison, 10 fenêtres.' })
await agree(S.s6, { offer: 8000, when: at(-1, 9) })
await run(S.s6, { start: at(-1, 9), minutes: 120 })
{
  const { error } = await C.sb.from('disputes').insert({ transaction_id: S.s6, opener_id: C.id, reason: 'Deux fenêtres de l’étage n’ont pas été faites.' })
  if (error) log('litige', error.message)
  await sys(C, S.s6, 'Litige ouvert sur cette mission.')
}

// ---------- 3. Contrôle : factures émises sur les missions terminées ----------
for (const k of ['s1', 's2', 's6']) {
  const { data } = await C.sb.from('invoices').select('number, kind, net_cents').eq('transaction_id', S[k])
  log('factures', k, JSON.stringify(data))
}
log('missions', JSON.stringify(S))
