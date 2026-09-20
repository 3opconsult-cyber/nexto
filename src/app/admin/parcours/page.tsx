"use client"
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Profile = { id: string; full_name: string | null; first_name: string | null; last_name: string | null; is_pro: boolean; created_at: string }
type Attribution = { user_id: string; utm_source: string | null; utm_medium: string | null; utm_campaign: string | null; utm_content: string | null; landing_path: string | null; created_at: string }
type Ev = { id: string; user_id: string | null; session_id: string; event_type: string; path: string | null; created_at: string }

function fmt(d: string) {
  return new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

/**
 * "Mapping" simple et visuel demandé par Romain pour recouper les
 * inscriptions et les parcours des testeurs. Deux sources déjà en place,
 * jusque-là sans aucun écran pour les lire :
 * - signup_attributions (date/heure + source de chaque inscription)
 * - events (page_view sur la vraie appli, ajouté à cette occasion — avant,
 *   seule la démo statique l'envoyait)
 */
export default function AdminParcours() {
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [profiles, setProfiles] = useState<Record<string, Profile>>({})
  const [attributions, setAttributions] = useState<Attribution[]>([])
  const [events, setEvents] = useState<Ev[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      setAuthed(!!user)
      if (!user) { setLoading(false); return }

      const [{ data: pros }, { data: attrs }, { data: evs }] = await Promise.all([
        supabase.from('profiles').select('id, full_name, first_name, last_name, is_pro, created_at').order('created_at', { ascending: false }).limit(150),
        supabase.from('signup_attributions').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('events').select('id, user_id, session_id, event_type, path, created_at').order('created_at', { ascending: false }).limit(500),
      ])
      const byId: Record<string, Profile> = {}
      ;(pros ?? []).forEach((p: any) => { byId[p.id] = p })
      setProfiles(byId)
      setAttributions((attrs as Attribution[]) ?? [])
      setEvents((evs as Ev[]) ?? [])
      setLoading(false)
    })
  }, [])

  if (loading) return <div style={{ padding: 40, fontFamily: 'Inter, sans-serif', color: '#6E8592' }}>Chargement…</div>

  if (!authed) {
    return (
      <div style={{ padding: 40, fontFamily: 'Inter, sans-serif', maxWidth: 480 }}>
        <h1 style={{ fontFamily: 'Quicksand, sans-serif', fontSize: 20, color: '#123644' }}>Connexion admin requise</h1>
        <p style={{ fontSize: 14, color: '#6E8592', marginTop: 10, lineHeight: 1.6 }}>
          Connectez-vous avec le compte admin (<code>3op.consult@gmail.com</code>) sur <a href="/auth/login">/auth/login</a>,
          puis revenez sur cette page.
        </p>
      </div>
    )
  }

  // Sessions groupees, la plus recente activite en tete.
  const sessions: Record<string, Ev[]> = {}
  events.forEach(e => { (sessions[e.session_id] ??= []).push(e) })
  const sessionList = Object.entries(sessions)
    .map(([sid, evs]) => ({ sid, evs: evs.slice().sort((a, b) => a.created_at.localeCompare(b.created_at)) }))
    .sort((a, b) => b.evs[b.evs.length - 1].created_at.localeCompare(a.evs[a.evs.length - 1].created_at))

  function nameFor(userId: string | null) {
    if (!userId) return null
    const p = profiles[userId]
    if (!p) return null
    return p.full_name?.trim() || [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || null
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F3F6F5', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ padding: '28px 24px', maxWidth: 960, margin: '0 auto' }}>
        <a href="/admin" style={{ fontSize: 13, fontWeight: 700, color: '#6E8592', textDecoration: 'none' }}>← Retour à l'admin</a>
        <h1 style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 24, color: '#123644', marginTop: 10 }}>
          Mapping — inscriptions &amp; parcours testeurs
        </h1>
        <p style={{ fontSize: 13.5, color: '#6E8592', marginTop: 4 }}>
          Pour recouper : qui s'est inscrit, d'où, et ce qu'il a visité ensuite.
        </p>

        {/* --- Inscriptions --- */}
        <h2 style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 17, color: '#123644', marginTop: 30 }}>
          Inscriptions récentes <span style={{ color: '#9CA3AF', fontWeight: 600, fontSize: 13 }}>({attributions.length})</span>
        </h2>
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {attributions.length === 0 && <p style={{ fontSize: 13.5, color: '#9CA3AF' }}>Aucune inscription tracée pour l'instant.</p>}
          {attributions.map(a => {
            const p = profiles[a.user_id]
            const name = nameFor(a.user_id)
            return (
              <div key={a.user_id + a.created_at} style={{ background: '#fff', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: '#9CA3AF', minWidth: 100 }}>{fmt(a.created_at)}</span>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: '#123644' }}>{name || 'Sans nom'}</span>
                <span style={{ fontSize: 11.5, fontWeight: 700, padding: '2px 9px', borderRadius: 999, background: p?.is_pro ? 'rgba(242,169,59,.15)' : 'rgba(18,179,156,.1)', color: p?.is_pro ? '#8a6520' : '#0C8F7E' }}>
                  {p?.is_pro ? 'Pro' : 'Particulier'}
                </span>
                <span style={{ fontSize: 12, color: '#6E8592', marginLeft: 'auto' }}>
                  {[a.utm_source, a.utm_medium, a.utm_content].filter(Boolean).join(' · ') || 'source directe'}
                </span>
              </div>
            )
          })}
        </div>

        {/* --- Parcours --- */}
        <h2 style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 17, color: '#123644', marginTop: 34 }}>
          Parcours par session <span style={{ color: '#9CA3AF', fontWeight: 600, fontSize: 13 }}>({sessionList.length})</span>
        </h2>
        <p style={{ fontSize: 12.5, color: '#9CA3AF', marginTop: 2 }}>Une session = un navigateur. Un même testeur peut apparaître deux fois (mobile + desktop).</p>
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sessionList.length === 0 && <p style={{ fontSize: 13.5, color: '#9CA3AF' }}>Aucun événement pour l'instant.</p>}
          {sessionList.map(({ sid, evs }) => {
            const uid = evs.find(e => e.user_id)?.user_id ?? null
            const name = nameFor(uid)
            return (
              <div key={sid} style={{ background: '#fff', borderRadius: 12, padding: '12px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#123644' }}>{name || `Session ${sid.slice(0, 8)}`}</span>
                  <span style={{ fontSize: 11.5, color: '#9CA3AF' }}>{evs.length} action{evs.length > 1 ? 's' : ''} · {fmt(evs[0].created_at)} → {fmt(evs[evs.length - 1].created_at)}</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {evs.map(e => (
                    <span key={e.id} title={fmt(e.created_at)}
                      style={{ fontSize: 11.5, fontWeight: 600, padding: '4px 10px', borderRadius: 999, background: e.event_type === 'page_view' ? '#F3F6F5' : 'rgba(18,179,156,.1)', color: e.event_type === 'page_view' ? '#6E8592' : '#0C8F7E' }}>
                      {e.event_type === 'page_view' ? (e.path || '/') : e.event_type}
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
