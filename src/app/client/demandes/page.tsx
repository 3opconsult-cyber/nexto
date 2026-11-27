"use client"
import '../../aere.css'
import RequestDetails from '@/components/RequestDetails'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import NavDrawer from '@/components/NavDrawer'
import { acceptOfferMessage } from '@/lib/offers'
import { notifyOther } from '@/lib/notify'
import { systemSender } from '@/lib/systemMessage'
import DayTimePicker, { firstFreeTime } from '@/components/DayTimePicker'
import { readScreenCache, sessionUserId } from '@/lib/screenCache'
import { DEMANDES_CACHE, loadDemandesSnap, type DemandesSnap, type Tx, type ProInfo } from '@/lib/demandesLoader'

const TRAD: Record<string, string> = { menage: 'Ménage', repassage: 'Repassage', nettoyage: 'Nettoyage', vitres: 'Vitres' }
const DONE = ['completed', 'released']
const STATUS: Record<string, string> = { open: 'En attente', matched: 'En cours', completed: 'Terminée', cancelled: 'Annulée' }
function eur(c?: number | null) { return c != null ? `${(c / 100).toFixed(0)} €` : '' }

// Distance à vol d'oiseau en km (haversine) ; null si une position manque.
function distanceKm(a?: number | null, b?: number | null, c?: number | null, d?: number | null) {
  if (a == null || b == null || c == null || d == null) return null
  const R = 6371, rad = Math.PI / 180
  const dLat = (c - a) * rad, dLng = (d - b) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a * rad) * Math.cos(c * rad) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}
const euroFr = (c: number) => (c / 100).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' €'
// Rendez-vous proposé d'office : le jour et le créneau souhaités de la demande (matin 9 h, après-midi
// 14 h, soir 18 h), s'ils sont encore à venir ; sinon le client choisit dans la grille.
const SLOT_HOUR: Record<string, string> = { matin: '09:00', 'apres-midi': '14:00', soir: '18:00' }
function suggestedRdv(r: any): string {
  if (!r?.desired_date) return ''
  const v = `${r.desired_date}T${SLOT_HOUR[r.desired_slot] || '09:00'}`
  const t = new Date(v).getTime()
  return isFinite(t) && t > Date.now() + 30 * 60000 ? v : ''
}
const rdvLabel = (v: string) => new Date(v).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
const hasAddr = (r: any) => !!(r?.address && String(r.address).trim())
const excerpt = (s: string, n = 110) => { const t = s.replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n).trimEnd() + '…' : t }

export default function MesDemandesPage() {
  const router = useRouter()
  const [rows, setRows] = useState<any[]>([])
  const [txByRequest, setTxByRequest] = useState<Record<string, Tx[]>>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [pros, setPros] = useState<Record<string, ProInfo>>({})

  // Lecture en deux vagues au lieu de six en file (audit ergonomie 19/11 bis, correction 2) :
  // demandes et transactions du client ensemble, puis noms, propositions, profils et pièces
  // ensemble. La dernière liste connue (cache de l'onglet) s'affiche dès l'ouverture.
  async function load() {
    const supabase = createClient()
    const uid = await sessionUserId(supabase)
    if (!uid) { router.push('/auth/login'); return }
    const cached = readScreenCache<DemandesSnap>(DEMANDES_CACHE, uid)
    if (cached) {
      setRows(cached.rows || []); setTxByRequest(cached.tx || {}); setPros(cached.pros || {}); setLoading(false)
    }
    const snap = await loadDemandesSnap(supabase, uid, list => setRows(list)).catch(() => null)
    if (!snap) { setLoading(false); return }
    const { rows: list, tx: grouped, pros: info } = snap
    setRows(list)
    setTxByRequest(grouped)
    // Une proposition attend une réponse : sa demande s'ouvre d'office (un appui de moins).
    const withOffer = list.find((r: any) => (grouped[r.id] || []).some(t => t.hasPendingOffer && !t.price_confirmed && t.status !== 'cancelled'))
    if (withOffer) setExpanded(e => e ?? withOffer.id)
    setPros(info)
    setLoading(false)
  }
  useEffect(() => { load() }, []) // eslint-disable-line

  function badge(r: any) {
    const group = txByRequest[r.id] || []
    if (r.status === 'cancelled') return { label: 'Annulée', bg: '#F3F6F5', fg: '#4E6470' }
    if (group.some(t => DONE.includes(t.status))) return { label: 'Terminée', bg: 'rgba(18,179,156,.12)', fg: '#0B8374' }
    if (group.some(t => t.price_confirmed && t.status !== 'cancelled')) return { label: 'Prestataire choisi', bg: 'rgba(18,179,156,.12)', fg: '#0B8374' }
    if (group.length > 0) return { label: `${group.length} proposition${group.length > 1 ? 's' : ''}`, bg: 'rgba(18,179,156,.12)', fg: '#0B8374' }
    if (r.status === 'open') return { label: 'En attente', bg: '#FFF7ED', fg: '#8a6520' }
    return { label: STATUS[r.status] || 'En cours', bg: '#F3F6F5', fg: '#4E6470' }
  }

  // « Accepter ce prestataire » (audit ergonomie 19/11, correction 2) : plus de fenêtre native. Le premier
  // appui ouvre, dans la carte, le récapitulatif du tarif et le choix du rendez-vous (prérempli sur le jour
  // et le créneau souhaités de la demande) ; « Confirmer » accepte vraiment la proposition (prix et
  // commissions figés, règle suprême du tarif), fixe l'heure du rendez-vous et ferme la demande (matched).
  const [acceptErr, setAcceptErr] = useState<Record<string, string>>({})
  const [confirming, setConfirming] = useState<string | null>(null)
  const [rdvAt, setRdvAt] = useState('')
  // Zone de confirmation ramenée dans la vue au toucher de « Accepter ce prestataire » (correction 1 du
  // 19/11 ter) : quand la demande n'est pas en haut de la liste, « Confirmer » tombait sous la barre du bas.
  // block 'end' + scroll-margin-bottom = hauteur de la barre : le bas de la zone s'arrête juste au-dessus.
  const confirmRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!confirming) return
    const id = requestAnimationFrame(() => {
      const el = confirmRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      // Hauteur réelle de la barre du bas (--tabbar-h est un calc() avec env(), mesuré par une sonde).
      const probe = document.createElement('div')
      probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;width:0;height:var(--tabbar-h, 0px)'
      el.appendChild(probe)
      const tab = probe.offsetHeight
      probe.remove()
      // Déjà entièrement visible au-dessus de la barre : rien ne bouge.
      if (r.top >= 0 && r.bottom <= window.innerHeight - tab) return
      el.scrollIntoView({ block: r.height > window.innerHeight - tab ? 'start' : 'end', behavior: 'smooth' })
    })
    return () => cancelAnimationFrame(id)
  }, [confirming])
  function offerShape(t: Tx) {
    if (!t.offer) return ''
    return t.offer.offer_hourly_cents && t.offer.offer_included_hours != null
      ? ` (${t.offer.offer_included_hours} h incluses, puis ${euroFr(t.offer.offer_hourly_cents)}/h)`
      : t.offer.offer_hourly_cents ? ` (estimation, ${euroFr(t.offer.offer_hourly_cents)}/h selon le temps réel)` : ''
  }
  function askAccept(t: Tx, r: any) {
    if (!t.offer?.offer_cents || t.price_confirmed) { router.push(`/mission/${t.id}/chat`); return }
    setAcceptErr(e => ({ ...e, [t.id]: '' }))
    // Rendez-vous prérempli (correction 4) : le jour souhaité de la demande, sinon le premier horaire
    // libre de la grille ; « Confirmer » est actif d'emblée, le client peut toujours changer.
    setRdvAt(suggestedRdv(r) || firstFreeTime())
    setConfirming(t.id)
  }
  async function acceptPro(t: Tx, r: any) {
    if (!t.offer?.offer_cents || t.price_confirmed) { router.push(`/mission/${t.id}/chat`); return }
    const when = hasAddr(r) && rdvAt ? new Date(rdvAt) : null
    if (hasAddr(r) && (!when || isNaN(when.getTime()))) { setAcceptErr(e => ({ ...e, [t.id]: 'Choisissez le jour et l’heure du rendez-vous.' })); return }
    setBusy(t.id); setAcceptErr(e => ({ ...e, [t.id]: '' }))
    const supabase = createClient()
    const res = await acceptOfferMessage(supabase, t.id, t.offer)
    if ('error' in res) { setBusy(''); setAcceptErr(e => ({ ...e, [t.id]: res.error })); return }
    notifyOther(t.id, 'offer')
    // Rendez-vous fixé dans la foulée (le client peut poser scheduled_at sur sa mission). L'adresse est
    // celle de la demande publiée ; elle n'est transmise qu'au prestataire de cette mission.
    let scheduled = false
    if (when) {
      const { data: upd } = await supabase.from('transactions').update({ scheduled_at: when.toISOString() })
        .eq('id', t.id).select('scheduled_at').maybeSingle()
      if (upd?.scheduled_at) {
        scheduled = true
        await supabase.from('messages').insert({
          transaction_id: t.id, ...(await systemSender(supabase)),
          body: `✓ Rendez-vous fixé : ${rdvLabel(upd.scheduled_at)} — adresse transmise au prestataire`,
        })
      }
    }
    setBusy('')
    // Rendez-vous fixé : écran « Commande validée » (sur place ou absent) ; sinon la discussion le demande.
    router.push(scheduled ? `/mission/${t.id}/commande` : `/mission/${t.id}/chat`)
  }

  const [rowErr, setRowErr] = useState<Record<string, string>>({})
  async function cancel(r: any) {
    setBusy(r.id); setRowErr(e => ({ ...e, [r.id]: '' }))
    const supabase = createClient()
    const { error } = await supabase.from('requests').update({ status: 'cancelled' }).eq('id', r.id)
    if (error) setRowErr(e => ({ ...e, [r.id]: 'L’annulation a échoué. Réessayez dans un instant.' }))
    else setRows(rs => rs.map(x => x.id === r.id ? { ...x, status: 'cancelled' } : x))
    setBusy('')
  }
  // Suppression en deux appuis dans la carte (plus de fenêtre native) : « Supprimer » puis « Confirmer la suppression ».
  const [delAsk, setDelAsk] = useState<string | null>(null)
  async function remove(r: any) {
    if (delAsk !== r.id) { setDelAsk(r.id); return }
    setDelAsk(null)
    setBusy(r.id)
    const supabase = createClient()
    const { error } = await supabase.from('requests').delete().eq('id', r.id)
    if (error) { setRowErr(e => ({ ...e, [r.id]: 'Impossible de supprimer : cette demande est liée à une mission. Vous pouvez l’annuler.' })); setBusy(''); return }
    setRows(rs => rs.filter(x => x.id !== r.id))
    setBusy('')
  }

  // Lecture aérée (24/11) : les 5 plus récentes d'abord, le reste derrière « Voir les autres ».
  const [showAll, setShowAll] = useState(false)
  const shownRows = showAll ? rows : rows.slice(0, 5)
  const groups = shownRows.reduce((acc, r) => {
    const key = new Date(r.created_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    ;(acc[key] ||= []).push(r); return acc
  }, {} as Record<string, any[]>)

  return (
    <div className="aere a-lift" style={{ minHeight: '100vh', background: '#fff', fontFamily: 'Inter, sans-serif', paddingBottom: 70 }}>
      <div style={{ padding: '14px 16px', background: '#123644', display: 'flex', alignItems: 'center', gap: 12 }}>
        <NavDrawer />
        <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 17, color: '#fff', flex: 1 }}>Mes demandes</span>
      </div>

      <div style={{ padding: '24px 20px', maxWidth: 720, margin: '0 auto' }}>
        <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 20, lineHeight: 1.5, color: '#123644', marginBottom: 4 }}>Déposez une demande</div>
        <p style={{ fontSize: 15, color: '#4E6470', marginBottom: 20, lineHeight: 1.55 }}>
          Comme une annonce : service, heures ou kilos de linge, fréquence, foyer, paiement. Les prestataires à proximité vous font une proposition chiffrée.
        </p>
        <button onClick={() => router.push('/client/demandes/new')}
          style={{ width: '100%', padding: 14, borderRadius: 999, border: 'none', background: '#0B8374', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 17, cursor: 'pointer', marginBottom: 32, minHeight: 54 }}>
          + Déposer une demande
        </button>

        {loading && <div style={{ textAlign: 'center', padding: 30, color: '#4E6470', fontWeight: 600, fontSize: 15 }}>Chargement…</div>}

        {!loading && rows.length === 0 && (
          <div style={{ textAlign: 'center', padding: 32 }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#123644' }}>Aucune demande pour l&apos;instant</div>
          </div>
        )}

        {!loading && Object.entries(groups).map(([mois, list]: [string, any[]]) => (
          <div key={mois} style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#4E6470', textTransform: 'capitalize', letterSpacing: '.01em', margin: '0 0 8px' }}>{mois}</div>
            {list.map(r => {
              const b = badge(r)
              const group = txByRequest[r.id] || []
              const isDone = group.some(t => DONE.includes(t.status))
              const canCancel = r.status !== 'cancelled' && !isDone
              const isOpen = expanded === r.id
              const budgetTxt = r.budget_min_cents || r.budget_max_cents
                ? `${eur(r.budget_min_cents) || '0 €'} – ${eur(r.budget_max_cents) || eur(r.budget_min_cents)}`
                : (r.budget_cents ? eur(r.budget_cents) : null)
              return (
                <div key={r.id} style={{ background: 'transparent', borderTop: '1px solid #E3EAE8', padding: '20px 0', marginBottom: 0, opacity: busy === r.id ? .5 : 1 }}>
                  <div onClick={() => group.length ? setExpanded(isOpen ? null : r.id) : undefined} style={{ cursor: group.length ? 'pointer' : 'default' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 17, color: '#123644' }}>{r.title || TRAD[r.category] || r.category || 'Demande'}</span>
                      <span className="a-mini" style={{ alignSelf: 'flex-start', fontSize: 13, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: b.bg, color: b.fg, flexShrink: 0, whiteSpace: 'nowrap' }}>{b.label}</span>
                    </div>
                    <div style={{ fontSize: 15, color: '#0B8374', fontWeight: 700, marginTop: 4 }}>{TRAD[r.category] || r.category}</div>
                    {r.description && <div style={{ fontSize: 15, lineHeight: 1.5, color: '#4E6470', marginTop: 4 }}>{r.description}</div>}
                    <RequestDetails request={r} compact />
                    <div style={{ fontSize: 15, color: '#4E6470', marginTop: 6, display: 'flex', justifyContent: 'space-between' }}>
                      <span>{new Date(r.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</span>
                      {budgetTxt ? <b style={{ color: '#123644' }}>{budgetTxt}</b> : null}
                    </div>
                  </div>

                  {isOpen && group.length > 0 && (
                    <div style={{ marginTop: 12, paddingTop: 4, display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {group.map(t => {
                        const p = t.providerId ? pros[t.providerId] : undefined
                        const km = p ? distanceKm(r.lat, r.lng, p.lat, p.lng) : null
                        const cancelled = t.status === 'cancelled'
                        const tag = { fontSize: 10.5, fontWeight: 700, padding: '3px 8px', borderRadius: 999, background: 'rgba(18,179,156,.12)', color: '#0B8374' } as const
                        return (
                          <div key={t.id} style={{ padding: 12, borderRadius: 12, background: '#F3F6F5', border: '1px solid #E7EDEB', opacity: cancelled ? .6 : 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontFamily: 'Quicksand, sans-serif', fontSize: 14, fontWeight: 700, color: '#123644' }}>{t.counterpart}</div>
                                <div style={{ fontSize: 11.5, color: '#4E6470', marginTop: 2 }}>
                                  {p && p.reviews_count > 0 && p.rating ? `★ ${Number(p.rating).toFixed(1).replace('.', ',')} · ${p.reviews_count} avis` : 'Pas encore d’avis'}
                                  {km != null ? ` · ${(km < 10 ? km.toFixed(1) : Math.round(km).toString()).replace('.', ',')} km` : ''}
                                </div>
                              </div>
                              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                {!t.price_confirmed && t.offer?.offer_cents ? (
                                  <>
                                    <div style={{ fontFamily: 'Quicksand, sans-serif', fontSize: 17, fontWeight: 700, color: '#123644' }}>{euroFr(t.offer.offer_cents)}</div>
                                    <div style={{ fontSize: 10.5, fontWeight: 700, color: '#8a6520' }}>proposition à accepter</div>
                                  </>
                                ) : t.subtotal_cents && t.subtotal_cents > 0 ? (
                                  <>
                                    <div style={{ fontFamily: 'Quicksand, sans-serif', fontSize: 17, fontWeight: 700, color: '#123644' }}>{euroFr(t.subtotal_cents)}</div>
                                    {!t.price_confirmed && <div style={{ fontSize: 10.5, fontWeight: 700, color: '#8a6520' }}>à valider</div>}
                                  </>
                                ) : (
                                  <div style={{ fontSize: 11.5, fontWeight: 700, color: '#8a6520' }}>Prix à fixer</div>
                                )}
                              </div>
                            </div>
                            {p && (p.has_identity || p.has_rcpro) && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                                {p.has_identity && <span style={tag}>Pièce d’identité fournie</span>}
                                {p.has_rcpro && <span style={tag}>Assurance renseignée</span>}
                              </div>
                            )}
                            {p?.bio && p.bio.trim() && <div style={{ fontSize: 12, color: '#4E6470', marginTop: 8, lineHeight: 1.45 }}>{excerpt(p.bio)}</div>}
                            {cancelled ? (
                              <div style={{ fontSize: 11.5, fontWeight: 700, color: '#4E6470', marginTop: 10 }}>Conversation annulée</div>
                            ) : (
                              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                                <button onClick={() => router.push(`/mission/${t.id}/chat`)}
                                  style={{ flex: 1, minHeight: 44, padding: '0 10px', borderRadius: 999, border: '1px solid #E7EDEB', background: '#fff', color: '#123644', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>
                                  Voir la discussion
                                </button>
                                {t.hasPendingOffer && !t.price_confirmed && confirming !== t.id && (
                                  <button onClick={() => askAccept(t, r)} disabled={busy === t.id}
                                    style={{ flex: 1, minHeight: 44, padding: '0 10px', borderRadius: 999, border: 'none', background: '#0B8374', color: '#fff', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', opacity: busy === t.id ? .6 : 1 }}>
                                    Accepter ce prestataire
                                  </button>
                                )}
                              </div>
                            )}
                            {!cancelled && t.hasPendingOffer && !t.price_confirmed && t.offer?.offer_cents && confirming === t.id && (
                              <div ref={confirmRef} style={{ marginTop: 10, background: '#fff', border: '1.5px solid #12B39C', borderRadius: 12, padding: 12, scrollMarginBottom: 'calc(var(--tabbar-h, 0px) + 12px)', scrollMarginTop: 12 }}>
                                <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14, color: '#123644' }}>
                                  Accepter {t.counterpart} à {euroFr(t.offer.offer_cents)}{offerShape(t)} ?
                                </div>
                                <p style={{ fontSize: 12, color: '#4E6470', margin: '3px 0 10px', lineHeight: 1.5 }}>Le tarif sera fixé : seul un litige pourra le rouvrir.</p>
                                {hasAddr(r) ? (
                                  <>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: '#4E6470', textTransform: 'uppercase', letterSpacing: '.03em', marginBottom: 6 }}>Rendez-vous</div>
                                    <DayTimePicker value={rdvAt} onChange={setRdvAt} />
                                  </>
                                ) : (
                                  <p style={{ fontSize: 12, color: '#4E6470', margin: '0 0 6px' }}>Vous indiquerez ensuite l’adresse et l’heure dans la discussion.</p>
                                )}
                                {acceptErr[t.id] && <div role="alert" style={{ fontSize: 12, color: '#B3402F', fontWeight: 600, marginTop: 6 }}>{acceptErr[t.id]}</div>}
                                {/* Collant au-dessus de la barre du bas (correction 5) : « Confirmer » reste visible
                                    pendant le choix du rendez-vous, sans défilement. */}
                                <div style={{ display: 'flex', gap: 8, position: 'sticky', bottom: 'var(--tabbar-h, 0px)', zIndex: 5, background: '#fff', margin: '10px -12px -12px', padding: '10px 12px 12px', borderTop: '1px solid #EEF2F1', borderRadius: '0 0 12px 12px' }}>
                                  <button type="button" onClick={() => setConfirming(null)} disabled={busy === t.id}
                                    style={{ flex: '0 0 auto', minHeight: 44, padding: '0 16px', borderRadius: 999, border: '1px solid #E7EDEB', background: '#fff', color: '#123644', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>
                                    Annuler
                                  </button>
                                  <button type="button" onClick={() => acceptPro(t, r)} disabled={busy === t.id || (hasAddr(r) && !rdvAt)}
                                    style={{ flex: 1, minHeight: 44, padding: '0 10px', borderRadius: 999, border: 'none', background: '#0B8374', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: busy === t.id || (hasAddr(r) && !rdvAt) ? .55 : 1 }}>
                                    {busy === t.id ? 'Acceptation…' : `Confirmer · ${euroFr(t.offer.offer_cents)}`}
                                  </button>
                                </div>
                              </div>
                            )}
                            {confirming !== t.id && acceptErr[t.id] && <div role="alert" style={{ fontSize: 12, color: '#B3402F', fontWeight: 600, marginTop: 6 }}>{acceptErr[t.id]}</div>}
                            {!cancelled && t.hasPendingOffer && !t.price_confirmed && confirming !== t.id && (
                              <div style={{ fontSize: 10.5, color: '#4E6470', marginTop: 6 }}>En acceptant, le tarif est fixé et vous choisissez le rendez-vous.</div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 14, marginTop: 10, paddingTop: 10, borderTop: 'none' }}>
                    {canCancel && <button type="button" onClick={() => cancel(r)} style={{ minHeight: 44, padding: '0 4px', border: 'none', background: 'none', fontSize: 15, fontWeight: 700, color: '#8a6520', cursor: 'pointer' }}>Annuler</button>}
                    <button type="button" onClick={() => remove(r)} style={{ minHeight: 44, padding: '0 4px', border: 'none', background: 'none', fontSize: 15, fontWeight: 700, color: '#B3402F', cursor: 'pointer', marginLeft: 'auto' }}>{delAsk === r.id ? 'Confirmer la suppression' : 'Supprimer'}</button>
                    {delAsk === r.id && <button type="button" onClick={() => setDelAsk(null)} style={{ minHeight: 44, padding: '0 4px', border: 'none', background: 'none', fontSize: 15, fontWeight: 700, color: '#4E6470', cursor: 'pointer' }}>Garder</button>}
                  </div>
                  {rowErr[r.id] && <div role="alert" style={{ fontSize: 12, color: '#B3402F', fontWeight: 600, marginTop: 4 }}>{rowErr[r.id]}</div>}
                </div>
              )
            })}
          </div>
        ))}

        {!loading && !showAll && rows.length > 5 && (
          <button type="button" onClick={() => setShowAll(true)} className="a-link" style={{ width: '100%', justifyContent: 'center', minHeight: 52, marginBottom: 20 }}>
            Voir les {rows.length - 5} autres
          </button>
        )}

        {!loading && rows.length > 0 && (
          <p style={{ fontSize: 15, color: '#4E6470', lineHeight: 1.55, textAlign: 'center', marginTop: 4 }}>
            Votre adresse exacte reste masquée tant que vous n&apos;avez pas accepté une proposition.
          </p>
        )}
      </div>
    </div>
  )
}
