"use client"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BackArrow } from '@/components/BackHeader'
import { useMode, roleColumn } from '@/lib/mode'
import ModeHint from '@/components/ModeHint'
import { sessionUserId } from '@/lib/screenCache'
import { readMessagesCache, refreshMessagesCache, type MessagesData } from '@/lib/messagesList'
import { TRADES } from '@/lib/trades'
import { isInsuranceSent } from '@/lib/insurance'
import { rowHasPresence } from '@/lib/presence'
import PresenceTag from '@/components/presence/PresenceTag'
import '../aere.css'

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
  const [showAll, setShowAll] = useState(false)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
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
  const nbConv = visible.filter(r => r.kind === 'mission').length
  return (
    <div className="aere" style={{ minHeight: '100vh', background: '#F3F6F5', fontFamily: 'Inter, sans-serif', paddingBottom: 90 }}>
      <div style={{ padding: '14px 20px', background: '#123644', display: 'flex', alignItems: 'center', gap: 14 }}>
        <span style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,255,255,.1)', display: 'grid', placeItems: 'center' }}><BackArrow fallback={mode === 'pro' ? '/pro/carte' : '/map'} dark /></span>
        <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 20, color: '#fff' }}>Messages</span>
      </div>

      {!loading && isPro && mode && (
        <div style={{ padding: '20px 20px 0' }}>
          <ModeHint mode={mode} otherCount={otherCount} what={otherCount > 1 ? 'conversations' : 'conversation'} />
        </div>
      )}

      {!loading && visible.length > 0 && (
        <div style={{ padding: '24px 20px 0' }}>
          {/* Décompte de la maquette, en simple phrase (plus de cadre). */}
          {mode && <p style={{ margin: '0 0 16px', fontSize: 16, lineHeight: 1.55, color: '#4E6470' }}>{nbConv} conversation{nbConv > 1 ? 's' : ''} dans votre espace {mode === 'pro' ? 'prestataire' : 'particulier'}</p>}
          <div style={{ position: 'relative' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6E8592" strokeWidth="2.2" style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)' }}>
              <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
            </svg>
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Rechercher"
              style={{ width: '100%', boxSizing: 'border-box', minHeight: 52, padding: '12px 16px 12px 44px', borderRadius: 14, border: '1.5px solid #CFDAD7', background: '#fff', fontSize: 16, fontFamily: 'Inter, sans-serif', color: '#123644', outline: 'none' }} />
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            {([['all', 'Tous'], ['unread', 'Non lus']] as const).map(([k, l]) => (
              <button key={k} type="button" onClick={() => setFilter(k)} aria-pressed={filter === k} style={{
                minHeight: 48, padding: '0 22px', borderRadius: 999, border: 'none', cursor: 'pointer',
                fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 16,
                background: filter === k ? '#123644' : '#fff', color: filter === k ? '#fff' : '#123644',
                boxShadow: filter === k ? 'none' : '0 0 0 1px #E7EDEB',
              }}>{l}</button>
            ))}
          </div>
        </div>
      )}

      <div style={{ padding: '28px 20px 16px' }}>
        {loading && <div style={{ textAlign: 'center', padding: 40, color: '#6E8592', fontWeight: 600, fontSize: 16 }}>Chargement…</div>}
        {!loading && visible.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 8px' }}>
            <div style={{ fontWeight: 700, fontSize: 18, color: '#123644' }}>Aucune conversation pour l'instant</div>
            <div style={{ fontSize: 16, lineHeight: 1.55, color: '#4E6470', marginTop: 10 }}>{mode === 'pro' ? 'Elles apparaissent ici quand un client vous écrit ou répond à une demande.' : 'Contactez un prestataire depuis la carte pour démarrer une conversation.'}</div>
            <a href={mode === 'pro' ? '/pro/carte' : '/map'} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 52, padding: '0 28px', marginTop: 20, borderRadius: 999, background: '#0B8374', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 17, textDecoration: 'none' }}>{mode === 'pro' ? 'Voir les demandes' : 'Voir la carte'}</a>
          </div>
        )}
        {!loading && visible.length > 0 && (() => {
          const q = query.trim().toLowerCase()
          const base = filter === 'unread' ? visible.filter(t => t.kind === 'mission' && (unread[t.id] || 0) > 0) : visible
          const filtered = q ? base.filter(t => {
            const name = t.kind === 'support' ? 'Support PING' : t.counterpart
            return (name || '').toLowerCase().includes(q) || (t.lastMessage?.body || '').toLowerCase().includes(q) || (t.kind === 'mission' && missionLine(t).toLowerCase().includes(q))
          }) : base
          // Liste longue : les 8 plus récentes, le reste un appui plus loin (recherche : tout).
          const LIMIT = 8
          const capped = !q && !showAll && filtered.length > LIMIT
          const shown = capped ? filtered.slice(0, LIMIT) : filtered

          if (filtered.length === 0) {
            return (
              <div style={{ textAlign: 'center', padding: '40px 8px' }}>
                <div style={{ fontWeight: 700, fontSize: 18, color: '#4E6470' }}>{q ? `Aucun résultat pour « ${query} »` : 'Aucun message non lu'}</div>
              </div>
            )
          }

          let sections: { label: string; items: any[] }[]
          if (sortMode === 'client') {
            // Regroupe par interlocuteur (toutes missions confondues, classées
            // alphabétiquement) — utile dès qu'un même client/pro revient
            // plusieurs fois et que la vue par date éparpille son historique.
            const byName = new Map<string, any[]>()
            shown.forEach(t => {
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
            // Maquette : un seul intitulé « Les plus récentes d'abord » (liste déjà triée par activité).
            sections = [{ label: "Les plus récentes d'abord", items: shown }]
          }

          const list = sections.map(section => (
            <div key={section.label} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '0' }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#123644', padding: '8px 0', whiteSpace: 'nowrap' }}>{section.label}</div>
                {section === sections[0] && visible.length > 6 && (
                  <button type="button" onClick={() => setSortMode(sortMode === 'date' ? 'client' : 'date')}
                    style={{ minHeight: 48, padding: '0 4px', background: 'none', border: 'none', color: '#0B8374', fontWeight: 700, fontSize: 15, whiteSpace: 'nowrap', cursor: 'pointer' }}>
                    {sortMode === 'date' ? (mode === 'pro' ? 'Trier par client' : 'Trier par prestataire') : 'Trier par date'}
                  </button>
                )}
              </div>
              {section.items.map(t => {
                const name = t.kind === 'support' ? 'Support PING' : t.counterpart
                const nUnread = t.kind === 'mission' ? (unread[t.id] || 0) : 0
                return (
                  <button key={t.id} onClick={() => router.push(t.kind === 'support' ? '/support' : `/mission/${t.id}/chat`)}
                    className="a-row" style={{ alignItems: 'flex-start', padding: '20px 0', minHeight: 88 }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: 15, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 18, color: '#fff',
                      background: t.kind === 'support' ? 'linear-gradient(160deg,#12B39C,#0B8374)' : (t.isSeller ? 'linear-gradient(160deg,#F2A93B,#8A6520)' : 'linear-gradient(160deg,#4E6470,#4c6472)'),
                    }}>{(name || '?').charAt(0).toUpperCase()}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 17, color: '#123644' }}>{name}</span>
                        <span className="a-mini" style={{ color: '#4E6470', fontWeight: 600, flexShrink: 0 }}>
                          {rowTime(new Date(t.lastMessage?.created_at || t.created_at))}
                        </span>
                      </div>
                      {/* Titre de la mission sous le nom (audit 19/11, correction 15) : plus de liste de « Audit P. » identiques. */}
                      {t.kind === 'mission' && (
                        <div style={{ fontSize: 15, lineHeight: 1.5, color: '#4E6470', fontWeight: 500, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{missionLine(t)}</div>
                      )}
                      <div style={{ fontSize: 15, lineHeight: 1.5, color: nUnread > 0 ? '#123644' : '#4E6470', fontWeight: nUnread > 0 ? 700 : 400, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {isInsuranceSent(t.lastMessage?.body) ? 'Attestation d’assurance transmise' : (t.lastMessage?.body || 'Aucun message — ouvrir la conversation')}
                      </div>
                      {/* Présence annoncée par le client (migration 048), comme sur le billet de mission. */}
                      {t.kind === 'mission' && rowHasPresence(t) && t.price_confirmed && t.status === 'pending' && !t.arrived_at && t.scheduled_at && (
                        <div className="a-lift" style={{ marginTop: 10 }}><PresenceTag presence={t.client_presence} asSeller={t.isSeller} /></div>
                      )}
                    </div>
                    {nUnread > 0 && <span aria-label={`${nUnread} non lu${nUnread > 1 ? 's' : ''}`} style={{ minWidth: 24, height: 24, borderRadius: 999, background: '#C73A3F', color: '#fff', font: '700 13px Inter, sans-serif', padding: '0 7px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{nUnread > 9 ? '9+' : nUnread}</span>}
                  </button>
                )
              })}
            </div>
          ))
          return <>{list}{capped && (
            <button type="button" onClick={() => setShowAll(true)} className="a-btn sec" style={{ marginTop: 16 }}>
              Voir les {filtered.length - LIMIT} autres conversations
            </button>
          )}</>
        })()}
      </div>
    </div>
  )
}
