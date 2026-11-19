"use client"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import NavDrawer from '@/components/NavDrawer'
import { useMode, roleColumn } from '@/lib/mode'
import ModeHint from '@/components/ModeHint'
import { sessionUserId } from '@/lib/screenCache'
import { readMessagesCache, refreshMessagesCache, type MessagesData } from '@/lib/messagesList'
import { TRADES } from '@/lib/trades'
import { isInsuranceSent } from '@/lib/insurance'
import { rowHasPresence } from '@/lib/presence'
import PresenceTag from '@/components/presence/PresenceTag'

// Repères type messagerie (WhatsApp) plutôt qu'une date brute sur chaque ligne :
// plus lisible dès qu'il y a beaucoup de conversations (demande de Romain, 26/10).
function startOfDay(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()) }
function daysAgo(d: Date) { return Math.round((startOfDay(new Date()).getTime() - startOfDay(d).getTime()) / 86400000) }
function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1) }

function sectionLabel(d: Date) {
  const n = daysAgo(d)
  if (n <= 0) return "Aujourd'hui"
  if (n === 1) return 'Hier'
  if (n < 7) return 'Cette semaine'
  const now = new Date()
  if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) return 'Ce mois-ci'
  return cap(d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }))
}

function rowTime(d: Date) {
  const n = daysAgo(d)
  if (n <= 0) return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  if (n === 1) return 'Hier'
  if (n < 7) return cap(d.toLocaleDateString('fr-FR', { weekday: 'short' }))
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

// « Ménage 2 h · ven. 21 nov. » : titre de la demande (ou service), puis date du rendez-vous (ou de la demande).
function missionLine(t: any) {
  const what = (t.requests?.title || '').trim() || (t.requests?.category ? (TRADES[t.requests.category] || t.requests.category) : 'Mission')
  const d = t.scheduled_at ? new Date(t.scheduled_at) : null
  const when = d ? d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }) : 'date à fixer'
  return `${what} · ${t.status === 'cancelled' ? 'annulée' : when}`
}

export default function MessagesPage() {
  const router = useRouter()
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [sortMode, setSortMode] = useState<'date' | 'client'>('date')
  const [uid, setUid] = useState('')
  const [unread, setUnread] = useState<Record<string, number>>({})
  const [isPro, setIsPro] = useState<boolean | null>(null)
  const [mode, setMode] = useMode(isPro)

  useEffect(() => {
    const supabase = createClient()
    let alive = true
    const apply = (d: MessagesData) => { setRows(d.rows); setUnread(d.unread); setIsPro(d.isPro); setLoading(false) }
    ;(async () => {
      // Session locale (sans aller-retour réseau) : la dernière liste connue s'affiche tout de suite,
      // la lecture fraîche la remplace dès qu'elle arrive (audit ergonomie 19/11, correction 3).
      const id = await sessionUserId(supabase)
      if (!alive) return
      if (!id) { router.push('/auth/login'); return }
      setUid(id)
      const cached = readMessagesCache(id)
      if (cached) apply(cached)
      try {
        const fresh = await refreshMessagesCache(supabase, id)
        if (alive) apply(fresh)
      } catch { if (alive) setLoading(false) }
    })()
    return () => { alive = false }
  }, [router])


  // Comme sur Airbnb (voyageur / hôte) : les conversations du mode affiché uniquement ; le support reste visible partout.
  // Conversation vide (« Contacter » ou réponse à une demande abandonnés sans rien écrire) : ni message
  // ni devis (un devis est un message), prix non fixé, encore en attente. Elle n'apparaît pas ici ;
  // le prestataire la retrouve dans « Propositions envoyées » sur /pro/carte (lot 16).
  const isEmpty = (r: any) => r.kind === 'mission' && !r.lastMessage && !r.price_confirmed && r.status === 'pending'
  const listed = rows.filter(r => !isEmpty(r))
  const visible = mode ? listed.filter(r => r.kind === 'support' || r[roleColumn(mode)] === uid) : []
  const otherCount = mode ? listed.filter(r => r.kind === 'mission' && r.buyer_id !== r.seller_id && r[roleColumn(mode === 'pro' ? 'particulier' : 'pro')] === uid).length : 0
  return (
    <div style={{ minHeight: '100vh', background: '#F3F6F5', fontFamily: 'Inter, sans-serif', paddingBottom: 70 }}>
      <div style={{ padding: '14px 16px', background: '#123644', display: 'flex', alignItems: 'center', gap: 12 }}>
        <NavDrawer />
        <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 17, color: '#fff' }}>Messages</span>
      </div>

      {!loading && isPro && mode && (
        <div style={{ padding: '12px 16px 0' }}>
          <ModeHint mode={mode} otherCount={otherCount} what={otherCount > 1 ? 'conversations' : 'conversation'} />
        </div>
      )}

      {!loading && visible.length > 0 && (
        <div style={{ padding: '12px 16px 0' }}>
          <div style={{ position: 'relative' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6E8592" strokeWidth="2.2" style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)' }}>
              <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
            </svg>
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Rechercher"
              style={{ width: '100%', boxSizing: 'border-box', minHeight: 44, padding: '11px 14px 11px 36px', borderRadius: 12, border: '1px solid #E7EDEB', background: '#fff', fontSize: 13, fontFamily: 'Inter, sans-serif', color: '#123644', outline: 'none' }} />
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
            {(['date', 'client'] as const).map(m => (
              <button key={m} onClick={() => setSortMode(m)} style={{
                minHeight: 44, padding: '0 15px', borderRadius: 999, border: 'none', cursor: 'pointer',
                fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 12.5,
                background: sortMode === m ? '#123644' : '#fff', color: sortMode === m ? '#fff' : '#4E6470',
                boxShadow: sortMode === m ? 'none' : '0 0 0 1px #E7EDEB',
              }}>{m === 'date' ? 'Trier par date' : mode === 'pro' ? 'Trier par client' : 'Trier par prestataire'}</button>
            ))}
          </div>
        </div>
      )}

      <div style={{ padding: 16 }}>
        {loading && <div style={{ textAlign: 'center', padding: 40, color: '#6E8592', fontWeight: 600, fontSize: 13 }}>Chargement…</div>}
        {!loading && visible.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, background: '#fff', borderRadius: 16, border: '1px solid #E7EDEB' }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#4E6470' }}>Aucune conversation pour l'instant</div>
            <div style={{ fontSize: 11.5, color: '#6E8592', marginTop: 4 }}>Elles apparaissent ici dès le premier message échangé.</div>
          </div>
        )}
        {!loading && visible.length > 0 && (() => {
          const q = query.trim().toLowerCase()
          const filtered = q ? visible.filter(t => {
            const name = t.kind === 'support' ? 'Support PING' : t.counterpart
            return (name || '').toLowerCase().includes(q) || (t.lastMessage?.body || '').toLowerCase().includes(q) || (t.kind === 'mission' && missionLine(t).toLowerCase().includes(q))
          }) : visible

          if (filtered.length === 0) {
            return (
              <div style={{ textAlign: 'center', padding: 40, background: '#fff', borderRadius: 16, border: '1px solid #E7EDEB' }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#4E6470' }}>Aucun résultat pour « {query} »</div>
              </div>
            )
          }

          let sections: { label: string; items: any[] }[]
          if (sortMode === 'client') {
            // Regroupe par interlocuteur (toutes missions confondues, classées
            // alphabétiquement) — utile dès qu'un même client/pro revient
            // plusieurs fois et que la vue par date éparpille son historique.
            const byName = new Map<string, any[]>()
            filtered.forEach(t => {
              const name = t.kind === 'support' ? 'Support PING' : (t.counterpart || '?')
              if (!byName.has(name)) byName.set(name, [])
              byName.get(name)!.push(t)
            })
            sections = Array.from(byName.entries())
              .sort((a, b) => a[0].localeCompare(b[0], 'fr'))
              .map(([label, items]) => ({ label: items.length > 1 ? `${label} · ${items.length} missions` : label, items }))
          } else {
            // Sections type messagerie (Aujourd'hui / Hier / Cette semaine / …) :
            // regroupe les lignes déjà triées par activité, sans casser l'ordre.
            sections = []
            filtered.forEach(t => {
              const d = new Date(t.lastMessage?.created_at || t.created_at)
              const label = sectionLabel(d)
              const current = sections[sections.length - 1]
              if (current && current.label === label) current.items.push(t)
              else sections.push({ label, items: [t] })
            })
          }

          return sections.map(section => (
            <div key={section.label} style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6E8592', textTransform: 'uppercase', letterSpacing: 0.4, padding: '6px 2px' }}>
                {section.label}
              </div>
              {section.items.map(t => {
                const name = t.kind === 'support' ? 'Support PING' : t.counterpart
                const nUnread = t.kind === 'mission' ? (unread[t.id] || 0) : 0
                return (
                  <button key={t.id} onClick={() => router.push(t.kind === 'support' ? '/support' : `/mission/${t.id}/chat`)}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', background: '#fff', border: t.kind === 'support' ? '1px solid #12B39C' : '1px solid #E7EDEB', borderRadius: 14, padding: 12, marginBottom: 10, cursor: 'pointer' }}>
                    <div style={{
                      width: 42, height: 42, borderRadius: 13, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15.5, color: '#fff',
                      background: t.kind === 'support' ? 'linear-gradient(160deg,#12B39C,#0C8F7E)' : (t.isSeller ? 'linear-gradient(160deg,#F2A93B,#8A6520)' : 'linear-gradient(160deg,#4E6470,#4c6472)'),
                    }}>{(name || '?').charAt(0).toUpperCase()}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13.5, color: '#123644' }}>{name}{nUnread > 0 && <span aria-label={`${nUnread} non lu${nUnread > 1 ? 's' : ''}`} style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#C0503A', marginLeft: 7, verticalAlign: 'middle' }} />}</span>
                        <span style={{ fontSize: 10.5, color: '#6E8592', fontWeight: 600, flexShrink: 0 }}>
                          {rowTime(new Date(t.lastMessage?.created_at || t.created_at))}
                        </span>
                      </div>
                      {/* Titre de la mission sous le nom (audit 19/11, correction 15) : plus de liste de « Audit P. » identiques. */}
                      {t.kind === 'mission' && (
                        <div style={{ fontSize: 11.5, color: '#0B6F63', fontWeight: 700, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{missionLine(t)}</div>
                      )}
                      <div style={{ fontSize: 12, color: nUnread > 0 ? '#123644' : '#4E6470', fontWeight: nUnread > 0 ? 700 : 400, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {isInsuranceSent(t.lastMessage?.body) ? 'Attestation d’assurance transmise' : (t.lastMessage?.body || 'Aucun message — ouvrir la conversation')}
                      </div>
                      {/* Présence annoncée par le client (migration 048), comme sur le billet de mission. */}
                      {t.kind === 'mission' && rowHasPresence(t) && t.price_confirmed && t.status === 'pending' && !t.arrived_at && t.scheduled_at && (
                        <div style={{ marginTop: 5 }}><PresenceTag presence={t.client_presence} asSeller={t.isSeller} /></div>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          ))
        })()}
      </div>
    </div>
  )
}
