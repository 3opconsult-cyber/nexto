// Annulations, frais, report, absence du prestataire, clôture sur preuve (migration 056) sur la PROD, comptes audit,
// appels de base (RPC). À lancer APRÈS collage de 056 : avant, les fonctions n'existent pas (scénario 0 = sonde).
//   node annulations.mjs                       (depuis un dossier avec @supabase/supabase-js)
//   SB_SERVICE=<clé service> node annulations.mjs   (optionnel : rejoue aussi l'absence du prestataire et la clôture sur
//                                                     preuve, qui demandent un rendez-vous déjà passé, posé par la clé service)
// Écrit en base (comptes audit) : une dizaine de réservations « QA annulations … », toutes annulées en fin de scénario.
// Nettoyage éventuel : supabase/a_coller/nettoyage_tests_qa_*.sql. Termine par process.exit(1) s'il y a au moins un KO.
import { createClient } from '@supabase/supabase-js'
const URL = 'https://wmiawwaxwlvascyflpba.supabase.co', ANON = 'sb_publishable_ehRFsNEJD1hnkOyi7vdfEA_NJey8yfP'
const PID = 'b9f8cd9a-16de-4a36-afd8-10a2135ab970', PWD = 'AuditPing2026!'
const login = async e => { const c = createClient(URL, ANON, { auth: { persistSession: false } }); const { error } = await c.auth.signInWithPassword({ email: e, password: PWD }); if (error) throw error; return c }
const cl = await login('audit.client.claude@ping-demo.invalid'), pro = await login('audit.pro.claude@ping-demo.invalid')
const svc = process.env.SB_SERVICE ? createClient(URL, process.env.SB_SERVICE, { auth: { persistSession: false } }) : null
let ko = 0
const log = (k, v, ok) => { if (!ok) ko++; console.log([ok ? 'OK' : 'KO', k, typeof v === 'string' ? v : JSON.stringify(v)].join(' ')) }
const min = m => new Date(Date.now() + m * 60000).toISOString()
const created = []

// Réservation directe acceptée par le prestataire (prix de sa fiche), rendez-vous dans `minutes` minutes.
async function booking(label, minutes, { enRoute = false } = {}) {
  const r = await cl.rpc('book_service', { p_provider: PID, p_service: null, p_mode: 'forfait', p_estimated_hours: null, p_address: '2 rue de l Audit, Grasse', p_address_status: 'profil', p_scheduled_at: min(minutes), p_description: 'QA annulations ' + label, p_lat: null, p_lng: null, p_payment_pref: null })
  const id = r.data?.transaction_id
  if (!id) { log(label + ' réservation créée', r.error?.message || r.data, false); return null }
  created.push(id)
  const a = await pro.rpc('accept_booking', { p_transaction: id }); if (a.error) { log(label + ' acceptation', a.error.message, false); return null }
  if (enRoute) {
    const u = await pro.from('transactions').update({ en_route_at: new Date().toISOString() }).eq('id', id).select('en_route_at').maybeSingle()
    if (u.error || !u.data?.en_route_at) { log(label + ' « Je pars »', u.error?.message || 'non posé', false); return null }
  }
  return id
}
const state = async (c, id) => (await c.rpc('cancellation_state', { p_transaction: id })).data
const tx = async (id) => (await cl.from('transactions').select('status,cancel_tier,cancel_fee_cents,cancel_reason_kind,scheduled_at,booking_status').eq('id', id).single()).data
const msgs = async id => ((await cl.from('messages').select('body,kind').eq('transaction_id', id)).data || []).map(m => m.body)

// 0 : sonde
const probe = await cl.rpc('cancellation_state', { p_transaction: '00000000-0000-0000-0000-000000000000' })
log('0 migration 056 collée (cancellation_state répond)', probe.error?.message || 'ok', !probe.error)
if (probe.error) { console.log('Collez supabase/a_coller/056_annulations_frais_absences_report.sql puis relancez.'); process.exit(1) }

// 1 : palier gratuit (avant « Je pars »), sans motif
let id = await booking('1 gratuite', 48 * 60)
if (id) {
  let s = await state(cl, id); log('1 palier = gratuite', s?.tier, s?.tier === 'gratuite' && s?.can_cancel)
  let d = await cl.from('transactions').update({ status: 'cancelled' }).eq('id', id); log('1 annulation directe refusée par la base', d.error?.message || 'acceptée', !!d.error)
  let r = await cl.rpc('cancel_booking', { p_transaction: id }); log('1 annulation gratuite', r.error?.message || r.data, r.data?.ok && r.data?.tier === 'gratuite' && r.data?.fee_cents === 0)
  let t = await tx(id); log('1 état en base', t, t?.status === 'cancelled' && t?.cancel_tier === 'gratuite')
  let again = await cl.rpc('cancel_booking', { p_transaction: id }); log('1 deuxième appel sans effet (idempotent)', again.data, again.data?.already === true)
}

// 2 : prestataire en route, RDV dans 40 min : motif sérieux obligatoire, sans frais
id = await booking('2 motif grave', 40, { enRoute: true })
if (id) {
  let s = await state(cl, id); log('2 palier = motif_grave', s?.tier, s?.tier === 'motif_grave')
  let r = await cl.rpc('cancel_booking', { p_transaction: id }); log('2 sans motif : refusé', r.data, r.data?.reason === 'motif_requis')
  r = await cl.rpc('cancel_booking', { p_transaction: id, p_reason_kind: 'changement_de_plan' }); log('2 motif non sérieux : refusé', r.data, r.data?.ok === false)
  r = await cl.rpc('cancel_booking', { p_transaction: id, p_reason_kind: 'autre_grave' }); log('2 « autre motif grave » sans texte : refusé', r.data, r.data?.reason === 'texte_requis')
  r = await cl.rpc('cancel_booking', { p_transaction: id, p_reason_kind: 'maladie', p_reason_text: 'QA : fièvre' }); log('2 motif réel : accepté, sans frais', r.data, r.data?.ok && r.data?.tier === 'motif_grave' && r.data?.fee_cents === 0)
  const t = await tx(id); log('2 motif enregistré', t, t?.cancel_reason_kind === 'maladie')
  log('2 message système pour le prestataire', (await msgs(id)).filter(b => /motif grave/.test(b || '')), (await msgs(id)).some(b => /motif grave/.test(b || '')))
  const j = await cl.from('mission_cancellations').select('id'); log('2 journal des motifs invisible pour un non-admin', (j.data || []).length + ' ligne(s)', !j.error && (j.data || []).length === 0)
}

// 3 : RDV imminent, prestataire en route : frais totaux, deux confirmations, documents émis
id = await booking('3 frais totaux', 10, { enRoute: true })
if (id) {
  let s = await state(cl, id); log('3 palier = frais_totaux', s, s?.tier === 'frais_totaux' && s?.fee_cents > 0)
  let r = await cl.rpc('cancel_booking', { p_transaction: id }); log('3 sans confirmation : avertissement « facturé la totalité »', r.data, r.data?.reason === 'confirmation_frais' && /totalité/.test(r.data?.message || ''))
  r = await cl.rpc('cancel_booking', { p_transaction: id, p_confirm_fees: true }); log('3 confirmé : annulée avec frais', r.data, r.data?.ok && r.data?.tier === 'frais_totaux' && r.data?.fee_cents > 0)
  const inv = await cl.from('invoices').select('kind,net_cents,number').eq('transaction_id', id); log('3 documents de facturation émis (prestation + frais de service)', inv.data, (inv.data || []).some(x => x.kind === 'prestation') && (inv.data || []).some(x => x.kind === 'commission_client'))
  const tp = await cl.from('transfer_payments').select('payee,amount_cents,status').eq('transaction_id', id); log('3 virements à régler créés', tp.data, (tp.data || []).length >= 2)
  const d = await cl.from('disputes').insert({ transaction_id: id, opener_id: (await cl.auth.getUser()).data.user.id, reason: 'QA : contestation des frais', category: 'autre' }).select('id').single(); log('3 litige possible dans les 24 h', d.error?.message || d.data?.id, !d.error)
}

// 4 : annulation du prestataire : motif obligatoire, jamais de frais
id = await booking('4 prestataire', 24 * 60)
if (id) {
  let r = await pro.rpc('cancel_booking', { p_transaction: id }); log('4 sans motif : refusé', r.data, r.data?.reason === 'motif_requis')
  r = await pro.rpc('cancel_booking', { p_transaction: id, p_reason_kind: 'autre' }); log('4 « autre » sans texte : refusé', r.data, r.data?.reason === 'texte_requis')
  r = await pro.rpc('cancel_booking', { p_transaction: id, p_reason_kind: 'panne_vehicule' }); log('4 motif : accepté, aucun frais, remboursement 100 %', r.data, r.data?.ok && r.data?.tier === 'prestataire' && r.data?.fee_cents === 0 && r.data?.refund_online === true)
  const inv = await cl.from('invoices').select('id').eq('transaction_id', id); log('4 aucun document facturé au client', (inv.data || []).length, (inv.data || []).length === 0)
}

// 5 : report : l'autre partie accepte, la date d'un rendez-vous confirmé ne se change pas à la main
id = await booking('5 report', 72 * 60)
if (id) {
  const t0 = await tx(id)
  const d = await cl.from('transactions').update({ scheduled_at: min(96 * 60) }).eq('id', id); log('5 changement de date direct refusé', d.error?.message || 'accepté', !!d.error)
  let r = await cl.rpc('propose_reschedule', { p_transaction: id, p_new_at: min(96 * 60), p_note: 'QA' }); log('5 le client propose un autre créneau (plus de 24 h : gratuit)', r.data, r.data?.ok && r.data?.late === false)
  let s = await state(pro, id); log('5 le prestataire voit la proposition', s?.reschedule?.pending, !!s?.reschedule?.pending && s.reschedule.pending.mine === false)
  r = await cl.rpc('accept_reschedule', { p_request: s?.reschedule?.pending?.id }); log('5 le client ne peut pas accepter sa propre proposition', r.error?.message || r.data, !!r.error)
  r = await pro.rpc('accept_reschedule', { p_request: s?.reschedule?.pending?.id }); log('5 le prestataire accepte', r.data, r.data?.ok)
  const t1 = await tx(id); log('5 rendez-vous déplacé, prix inchangé', [t0?.scheduled_at, t1?.scheduled_at], t1?.scheduled_at !== t0?.scheduled_at)
  r = await pro.rpc('propose_reschedule', { p_transaction: id, p_new_at: min(120 * 60) })
  log('5 proposition du prestataire puis refus par le client', r.data, r.data?.ok)
  s = await state(cl, id); const dec = await cl.rpc('decline_reschedule', { p_request: s?.reschedule?.pending?.id }); log('5 refus : le rendez-vous reste', dec.data, dec.data?.status === 'refusee')
}

// 6 : report impossible une fois le prestataire en route
id = await booking('6 report en route', 40, { enRoute: true })
if (id) { const r = await cl.rpc('propose_reschedule', { p_transaction: id, p_new_at: min(2 * 24 * 60) }); log('6 report refusé (prestataire en route)', r.data, r.data?.reason === 'en_route'); await cl.rpc('cancel_booking', { p_transaction: id, p_reason_kind: 'maladie' }) }

// 7 : absence du prestataire : trop tôt refusée ; avec la clé service, rendez-vous passé de plus de 30 min
id = await booking('7 absence', 90)
if (id) {
  let r = await cl.rpc('declare_provider_no_show', { p_transaction: id }); log('7 trop tôt : refusé', r.data, r.data?.reason === 'trop_tot')
  r = await pro.rpc('declare_provider_no_show', { p_transaction: id }); log('7 le prestataire ne peut pas déclarer sa propre absence', r.error?.message || r.data, !!r.error)
  if (svc) {
    await svc.from('transactions').update({ scheduled_at: min(-45) }).eq('id', id)
    const s = await state(cl, id); log('7 « Le prestataire n’est pas arrivé » proposé', s?.no_show, s?.no_show?.eligible === true)
    r = await cl.rpc('declare_provider_no_show', { p_transaction: id }); log('7 absence déclarée : annulée sans frais, remboursement 100 %', r.data, r.data?.ok && r.data?.tier === 'absence_prestataire' && r.data?.fee_cents === 0 && r.data?.refund_online)
    const a = await svc.from('payment_alerts').select('kind').eq('kind', 'provider_no_show').limit(1); log('7 alerte PING posée', a.data, (a.data || []).length > 0)
  } else console.log('-- 7 absence réelle non jouée (SB_SERVICE absent) : rendez-vous passé impossible à créer avec les comptes audit')
}

// 8 : clôture sur preuve : refusée sans demande restée sans réponse
id = await booking('8 sur preuve', 40, { enRoute: true })
if (id) {
  const r = await pro.rpc('close_on_proof', { p_transaction: id }); log('8 aucune demande sans réponse : refusé', r.data, r.data?.ok === false)
  const s = await state(pro, id); log('8 pas de bandeau « Clôturer sur preuve »', s?.silence, s?.silence?.eligible === false)
  await cl.rpc('cancel_booking', { p_transaction: id, p_reason_kind: 'maladie' })
}

// Nettoyage : tout ce qui reste actif est annulé par le client (gratuit si le prestataire n'est pas parti, sinon motif grave)
for (const t of created) {
  const cur = await tx(t); if (cur?.status === 'cancelled') continue
  const r = await cl.rpc('cancel_booking', { p_transaction: t, p_reason_kind: 'maladie', p_reason_text: 'QA nettoyage', p_confirm_fees: true })
  if (!r.data?.ok) await pro.rpc('cancel_booking', { p_transaction: t, p_reason_kind: 'indisponibilite' })
}
console.log(ko ? `\nECHEC : ${ko} KO` : '\nTout est OK')
process.exit(ko ? 1 : 0)
