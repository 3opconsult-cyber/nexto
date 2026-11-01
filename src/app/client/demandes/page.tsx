"use client"
import RequestDetails from '@/components/RequestDetails'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import NavDrawer from '@/components/NavDrawer'

const TRAD: Record<string, string> = { menage: 'Ménage', repassage: 'Repassage', nettoyage: 'Nettoyage', vitres: 'Vitres' }
const DONE = ['completed', 'released']
const STATUS: Record<string, string> = { open: 'En attente', matched: 'En cours', completed: 'Terminée', cancelled: 'Annulée' }
function eur(c?: number | null) { return c != null ? `${(c / 100).toFixed(0)} €` : '' }

type Tx = {
  id: string; status: string; counterpart: string
  subtotal_cents: number | null; price_confirmed: boolean
  providerId: string | null
  hasPendingOffer: boolean // un devis du prestataire attend la réponse du client (acceptation dans le chat)
}
type ProInfo = { rating: number | null; reviews_count: number; lat: number | null; lng: number | null; bio: string | null; has_identity: boolean; has_rcpro: boolean }

// Distance à vol d'oiseau en km (haversine) ; null si une position manque.
function distanceKm(a?: number | null, b?: number | null, c?: number | null, d?: number | null) {
  if (a == null || b == null || c == null || d == null) return null
  const R = 6371, rad = Math.PI / 180
  const dLat = (c - a) * rad, dLng = (d - b) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a * rad) * Math.cos(c * rad) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}
const euroFr = (c: number) => (c / 100).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' €'
const excerpt = (s: string, n = 110) => { const t = s.replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n).trimEnd() + '…' : t }

export default function MesDemandesPage() {
  const router = useRouter()
  const [rows, setRows] = useState<any[]>([])
  const [txByRequest, setTxByRequest] = useState<Record<string, Tx[]>>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [pros, setPros] = useState<Record<string, ProInfo>>({})

  async function load() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }
    const { data } = await supabase.from('requests')
      .select('*').eq('requester_id', user.id).order('created_at', { ascending: false })
    // Seules les demandes publiées (titre saisi dans « Publier une demande », ou encore ouvertes) :
    // les lignes créées automatiquement par « Contacter » ou une réservation directe ne sont pas
    // des demandes du point de vue du client — elles vivent dans Messages et l'Agenda.
    const list = (data ?? []).filter((r: any) => (r.title && r.title.trim()) || r.status === 'open')
    setRows(list)
    const ids = list.map((r: any) => r.id)
    if (ids.length) {
      // Une demande ouverte peut recevoir plusieurs propositions (un pro = une
      // transaction) : on les groupe toutes par demande, pas seulement la
      // derniere, sinon les autres propositions disparaissent silencieusement.
      const { data: txs } = await supabase.from('transactions').select('id, request_id, status, seller_id, subtotal_cents, price_confirmed').in('request_id', ids)
      const { data: names } = txs?.length
        ? await supabase.rpc('transaction_counterparts', { p_transaction_ids: txs.map((t: any) => t.id) })
        : { data: [] }
      const nameById: Record<string, string> = {}
      ;(names ?? []).forEach((n: any) => { if (n.full_name) nameById[n.transaction_id] = n.full_name })
      // Devis du prestataire en attente de réponse (lecture seule : l'acceptation se fait dans le chat).
      const pendingOffer = new Set<string>()
      if (txs?.length) {
        const { data: offers } = await supabase.from('messages').select('transaction_id, sender_id')
          .eq('kind', 'offer').eq('offer_status', 'pending').in('transaction_id', txs.map((t: any) => t.id))
        const sellerOf: Record<string, string> = {}
        txs.forEach((t: any) => { sellerOf[t.id] = t.seller_id })
        ;(offers ?? []).forEach((o: any) => { if (o.sender_id && o.sender_id === sellerOf[o.transaction_id]) pendingOffer.add(o.transaction_id) })
      }
      const grouped: Record<string, Tx[]> = {}
      ;(txs ?? []).forEach((t: any) => {
        if (!t.request_id) return
        ;(grouped[t.request_id] ||= []).push({
          id: t.id, status: t.status, counterpart: nameById[t.id] || 'Prestataire',
          subtotal_cents: t.subtotal_cents ?? null, price_confirmed: !!t.price_confirmed,
          providerId: t.seller_id ?? null, hasPendingOffer: pendingOffer.has(t.id),
        })
      })
      setTxByRequest(grouped)

      // Note, position, présentation et pièces déclarées des prestataires qui ont répondu.
      const proIds = Array.from(new Set((txs ?? []).map((t: any) => t.seller_id).filter(Boolean))) as string[]
      if (proIds.length) {
        const [{ data: pps }, trusts] = await Promise.all([
          supabase.from('provider_profiles').select('id, rating, reviews_count, lat, lng, bio').in('id', proIds),
          Promise.all(proIds.map(id => supabase.rpc('provider_trust_stats', { provider_id: id }))),
        ])
        const info: Record<string, ProInfo> = {}
        ;(pps ?? []).forEach((p: any) => { info[p.id] = { rating: p.rating, reviews_count: p.reviews_count || 0, lat: p.lat, lng: p.lng, bio: p.bio, has_identity: false, has_rcpro: false } })
        proIds.forEach((id, i) => {
          const tr = trusts[i]?.data?.[0]
          if (info[id] && tr) { info[id].has_identity = !!tr.has_identity; info[id].has_rcpro = !!tr.has_rcpro }
        })
        setPros(info)
      }
    }
    setLoading(false)
  }
  useEffect(() => { load() }, []) // eslint-disable-line

  function badge(r: any) {
    const group = txByRequest[r.id] || []
    if (r.status === 'cancelled') return { label: 'Annulée', bg: '#F3F6F5', fg: '#4E6470' }
    if (group.some(t => DONE.includes(t.status))) return { label: 'Terminée', bg: 'rgba(18,179,156,.12)', fg: '#0C8F7E' }
    if (group.length > 0) return { label: `${group.length} proposition${group.length > 1 ? 's' : ''}`, bg: 'rgba(18,179,156,.12)', fg: '#0C8F7E' }
    if (r.status === 'open') return { label: 'En attente', bg: '#FFF7ED', fg: '#8a6520' }
    return { label: STATUS[r.status] || 'En cours', bg: '#F3F6F5', fg: '#4E6470' }
  }

  async function cancel(r: any) {
    setBusy(r.id)
    const supabase = createClient()
    const { error } = await supabase.from('requests').update({ status: 'cancelled' }).eq('id', r.id)
    if (error) alert('L’annulation a échoué. Réessayez dans un instant.')
    else setRows(rs => rs.map(x => x.id === r.id ? { ...x, status: 'cancelled' } : x))
    setBusy('')
  }
  async function remove(r: any) {
    if (!confirm('Supprimer définitivement cette demande ?')) return
    setBusy(r.id)
    const supabase = createClient()
    const { error } = await supabase.from('requests').delete().eq('id', r.id)
    if (error) { alert('Impossible de supprimer : cette demande est liée à une mission. Vous pouvez l’annuler.'); setBusy(''); return }
    setRows(rs => rs.filter(x => x.id !== r.id))
    setBusy('')
  }

  const groups = rows.reduce((acc, r) => {
    const key = new Date(r.created_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    ;(acc[key] ||= []).push(r); return acc
  }, {} as Record<string, any[]>)

  return (
    <div style={{ minHeight: '100vh', background: '#F3F6F5', fontFamily: 'Inter, sans-serif', paddingBottom: 70 }}>
      <div style={{ padding: '14px 16px', background: '#123644', display: 'flex', alignItems: 'center', gap: 12 }}>
        <NavDrawer />
        <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 17, color: '#fff', flex: 1 }}>Mes demandes</span>
      </div>

      <div style={{ padding: 16, maxWidth: 720, margin: '0 auto' }}>
        <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 17, color: '#123644', marginBottom: 4 }}>Déposez une demande</div>
        <p style={{ fontSize: 12.5, color: '#4E6470', marginBottom: 14, lineHeight: 1.5 }}>
          Comme une annonce : service, heures ou kilos de linge, fréquence, foyer, paiement. Les prestataires à proximité vous font une proposition chiffrée.
        </p>
        <button onClick={() => router.push('/client/demandes/new')}
          style={{ width: '100%', padding: 14, borderRadius: 999, border: 'none', background: '#12B39C', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14, cursor: 'pointer', marginBottom: 18 }}>
          + Déposer une demande
        </button>

        {loading && <div style={{ textAlign: 'center', padding: 30, color: '#6E8592', fontWeight: 600, fontSize: 13 }}>Chargement…</div>}

        {!loading && rows.length === 0 && (
          <div style={{ textAlign: 'center', padding: 32, background: '#fff', borderRadius: 16, border: '1px solid #E7EDEB' }}>
            <div style={{ fontWeight: 700, fontSize: 13.5, color: '#123644' }}>Aucune demande pour l&apos;instant</div>
          </div>
        )}

        {!loading && Object.entries(groups).map(([mois, list]: [string, any[]]) => (
          <div key={mois} style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#4E6470', textTransform: 'uppercase', letterSpacing: '.04em', margin: '0 0 10px 2px' }}>{mois}</div>
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
                <div key={r.id} style={{ background: '#fff', border: '1px solid #E7EDEB', borderRadius: 14, padding: 14, marginBottom: 10, opacity: busy === r.id ? .5 : 1 }}>
                  <div onClick={() => group.length ? setExpanded(isOpen ? null : r.id) : undefined} style={{ cursor: group.length ? 'pointer' : 'default' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13.5, color: '#123644' }}>{r.title || TRAD[r.category] || r.category || 'Demande'}</span>
                      <span style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: b.bg, color: b.fg, flexShrink: 0, whiteSpace: 'nowrap' }}>{b.label}</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#0C8F7E', fontWeight: 700, marginTop: 3 }}>{TRAD[r.category] || r.category}</div>
                    {r.description && <div style={{ fontSize: 11.5, color: '#4E6470', marginTop: 3 }}>{r.description}</div>}
                    <RequestDetails request={r} compact />
                    <div style={{ fontSize: 11, color: '#6E8592', marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
                      <span>{new Date(r.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</span>
                      {budgetTxt ? <b style={{ color: '#123644' }}>{budgetTxt}</b> : null}
                    </div>
                  </div>

                  {isOpen && group.length > 0 && (
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #F1F5F4', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {group.map(t => {
                        const p = t.providerId ? pros[t.providerId] : undefined
                        const km = p ? distanceKm(r.lat, r.lng, p.lat, p.lng) : null
                        const cancelled = t.status === 'cancelled'
                        const tag = { fontSize: 10.5, fontWeight: 700, padding: '3px 8px', borderRadius: 999, background: 'rgba(18,179,156,.12)', color: '#0C8F7E' } as const
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
                                {t.subtotal_cents && t.subtotal_cents > 0 ? (
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
                              <div style={{ fontSize: 11.5, fontWeight: 700, color: '#6E8592', marginTop: 10 }}>Conversation annulée</div>
                            ) : (
                              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                                <button onClick={() => router.push(`/mission/${t.id}/chat`)}
                                  style={{ flex: 1, padding: '9px 10px', borderRadius: 999, border: '1px solid #DCE5E3', background: '#fff', color: '#123644', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>
                                  Voir la discussion
                                </button>
                                {t.hasPendingOffer && (
                                  <button onClick={() => router.push(`/mission/${t.id}/chat`)}
                                    style={{ flex: 1, padding: '9px 10px', borderRadius: 999, border: 'none', background: '#12B39C', color: '#fff', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>
                                    Accepter ce prestataire
                                  </button>
                                )}
                              </div>
                            )}
                            {!cancelled && t.hasPendingOffer && (
                              <div style={{ fontSize: 10.5, color: '#6E8592', marginTop: 6 }}>Vous confirmez le devis dans la discussion.</div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 14, marginTop: 10, paddingTop: 10, borderTop: '1px solid #F1F5F4' }}>
                    {canCancel && <span onClick={() => cancel(r)} style={{ fontSize: 12, fontWeight: 700, color: '#8a6520', cursor: 'pointer' }}>Annuler</span>}
                    <span onClick={() => remove(r)} style={{ fontSize: 12, fontWeight: 700, color: '#c0503a', cursor: 'pointer', marginLeft: 'auto' }}>Supprimer</span>
                  </div>
                </div>
              )
            })}
          </div>
        ))}

        {!loading && rows.length > 0 && (
          <p style={{ fontSize: 10.5, color: '#6E8592', lineHeight: 1.5, textAlign: 'center', marginTop: 4 }}>
            Votre adresse exacte reste masquée tant que vous n&apos;avez pas accepté une proposition.
          </p>
        )}
      </div>
    </div>
  )
}
