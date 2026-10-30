"use client"
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Profile = { id: string; full_name: string | null; first_name: string | null; last_name: string | null; phone_enc: string | null; address: string | null; city: string | null; is_pro: boolean }
type Ev = { id: string; user_id: string | null; session_id: string; event_type: string; path: string | null; created_at: string; metadata: any }

function fmt(d: string) {
  return new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}
function duree(startIso: string, endIso: string) {
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime()
  const min = Math.round(ms / 60000)
  if (min < 1) return '< 1 min'
  if (min < 60) return `${min} min`
  return `${Math.floor(min / 60)} h ${min % 60} min`
}

/**
 * "Onglet de lecture des visites" demandé par Romain : contrairement à
 * /admin/parcours (le détail technique, événement par événement), ici une
 * ligne = une visite, lisible côté commercial : qui (nom/coordonnées si
 * connu), combien de temps passé, combien de pages vues, et les
 * commentaires laissés via la bulle de feedback.
 */
export default function AdminVisites() {
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [profiles, setProfiles] = useState<Record<string, Profile>>({})
  const [events, setEvents] = useState<Ev[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      setAuthed(!!user)
      if (!user) { setLoading(false); return }
      const [{ data: pros }, { data: evs }] = await Promise.all([
        supabase.from('profiles').select('id, full_name, first_name, last_name, phone_enc, address, city, is_pro').limit(300),
        supabase.from('events').select('id, user_id, session_id, event_type, path, created_at, metadata').order('created_at', { ascending: false }).limit(1000),
      ])
      const byId: Record<string, Profile> = {}
      ;(pros ?? []).forEach((p: any) => { byId[p.id] = p })
      setProfiles(byId)
      setEvents((evs as Ev[]) ?? [])
      setLoading(false)
    })
  }, [])

  if (loading) return <div style={{ padding: 40, fontFamily: 'Inter, sans-serif', color: '#4E6470' }}>Chargement…</div>

  if (!authed) {
    return (
      <div style={{ padding: 40, fontFamily: 'Inter, sans-serif', maxWidth: 480 }}>
        <h1 style={{ fontFamily: 'Quicksand, sans-serif', fontSize: 20, color: '#123644' }}>Connexion admin requise</h1>
        <p style={{ fontSize: 14, color: '#4E6470', marginTop: 10, lineHeight: 1.6 }}>
          Connectez-vous avec le compte admin (<code>3op.consult@gmail.com</code>) sur <a href="/auth/login">/auth/login</a>,
          puis revenez sur cette page.
        </p>
      </div>
    )
  }

  const sessions: Record<string, Ev[]> = {}
  events.forEach(e => { (sessions[e.session_id] ??= []).push(e) })

  const visits = Object.entries(sessions).map(([sid, evs]) => {
    const sorted = evs.slice().sort((a, b) => a.created_at.localeCompare(b.created_at))
    const uid = sorted.find(e => e.user_id)?.user_id ?? null
    const profile = uid ? profiles[uid] : null
    const pageViews = sorted.filter(e => e.event_type === 'page_view')
    const comments = sorted.filter(e => e.event_type === 'feedback_note')
    const name = profile ? (profile.full_name?.trim() || [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim() || null) : null
    const coords = profile ? [profile.phone_enc, [profile.address, profile.city].filter(Boolean).join(', ')].filter(Boolean) : []
    return {
      sid, sorted, name, coords,
      role: profile ? (profile.is_pro ? 'Pro' : 'Particulier') : null,
      pageCount: pageViews.length,
      comments,
      debut: sorted[0].created_at,
      fin: sorted[sorted.length - 1].created_at,
    }
  }).sort((a, b) => b.fin.localeCompare(a.fin))

  return (
    <div style={{ minHeight: '100vh', background: '#F3F6F5', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ padding: '28px 24px', maxWidth: 960, margin: '0 auto' }}>
        <a href="/admin" style={{ fontSize: 13, fontWeight: 700, color: '#4E6470', textDecoration: 'none' }}>← Retour à l'admin</a>
        <h1 style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 24, color: '#123644', marginTop: 10 }}>
          Visites
        </h1>
        <p style={{ fontSize: 13.5, color: '#4E6470', marginTop: 4 }}>
          Une ligne = une visite : qui (si connu), temps passé, pages vues, commentaires laissés.
        </p>

        <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {visits.length === 0 && <p style={{ fontSize: 13.5, color: '#6E8592' }}>Aucune visite pour l'instant.</p>}
          {visits.map(v => (
            <div key={v.sid} style={{ background: '#fff', borderRadius: 14, padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15, color: '#123644' }}>
                  {v.name || `Visiteur anonyme (${v.sid.slice(0, 8)})`}
                </span>
                {v.role && (
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 999, background: v.role === 'Pro' ? 'rgba(242,169,59,.15)' : 'rgba(18,179,156,.1)', color: v.role === 'Pro' ? '#8a6520' : '#0C8F7E' }}>
                    {v.role}
                  </span>
                )}
                <span style={{ fontSize: 12, color: '#6E8592', marginLeft: 'auto' }}>{fmt(v.debut)}</span>
              </div>

              {v.coords.length > 0 && (
                <div style={{ fontSize: 12.5, color: '#4E6470', marginTop: 6 }}>{v.coords.join(' · ')}</div>
              )}

              <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 12.5, color: '#4E6470', fontWeight: 600 }}>
                <span>⏱ {duree(v.debut, v.fin)}</span>
                <span>{v.pageCount} page{v.pageCount > 1 ? 's' : ''} vue{v.pageCount > 1 ? 's' : ''}</span>
                <span>{v.comments.length} commentaire{v.comments.length > 1 ? 's' : ''}</span>
              </div>

              {v.comments.map(c => (
                <div key={c.id} style={{ marginTop: 10, padding: '10px 12px', borderRadius: 10, background: 'rgba(242,169,59,.1)', borderLeft: '3px solid #F2A93B' }}>
                  <div style={{ fontSize: 13, color: '#123644', fontStyle: 'italic' }}>« {c.metadata?.text || '(vide)'} »</div>
                  <div style={{ fontSize: 11, color: '#6E8592', marginTop: 3 }}>sur {c.path || '/'} · {fmt(c.created_at)}</div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
