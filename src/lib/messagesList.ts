"use client"
import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchUnreadByTx } from '@/lib/unread'
import { readScreenCache, writeScreenCache } from '@/lib/screenCache'

// Liste des conversations (/messages) en un seul passage (audit ergonomie 19/11, correction 3) :
// avant, une requête « dernier message » PAR mission, en chaîne après les autres (3,3 s mesurées).
// Désormais : 4 lectures en parallèle, puis 3 en parallèle (noms, derniers messages groupés, support).
export type MessagesData = {
  rows: any[]
  unread: Record<string, number>
  isPro: boolean
}

export const MESSAGES_CACHE = 'messages'
const CHUNK = 120
const LIMIT = 1000

// Derniers messages de toutes les missions, lus par paquets (une requête par paquet de missions,
// la plus récente d'abord). Une mission absente d'un paquet complet (LIMIT atteint) est relue seule.
async function lastMessages(supabase: SupabaseClient, ids: string[]) {
  const out: Record<string, { body: string; created_at: string; sender_id: string | null }> = {}
  const chunks: string[][] = []
  for (let i = 0; i < ids.length; i += CHUNK) chunks.push(ids.slice(i, i + CHUNK))
  const results = await Promise.all(chunks.map(c => supabase.from('messages')
    .select('transaction_id, body, created_at, sender_id')
    .in('transaction_id', c).order('created_at', { ascending: false }).limit(LIMIT)))
  const retry: string[] = []
  results.forEach((r, i) => {
    for (const m of (r.data ?? []) as any[]) if (!out[m.transaction_id]) out[m.transaction_id] = m
    if (r.error || (r.data ?? []).length >= LIMIT) retry.push(...chunks[i].filter(id => !out[id]))
  })
  if (retry.length) {
    await Promise.all(retry.map(async id => {
      const { data } = await supabase.from('messages').select('transaction_id, body, created_at, sender_id')
        .eq('transaction_id', id).order('created_at', { ascending: false }).limit(1).maybeSingle()
      if (data) out[id] = data as any
    }))
  }
  return out
}

export async function loadMessagesData(supabase: SupabaseClient, uid: string): Promise<MessagesData> {
  const [ppRes, txRes, convRes, unread] = await Promise.all([
    supabase.from('provider_profiles').select('id').eq('id', uid).maybeSingle(),
    supabase.from('transactions').select('*, requests(title, category)')
      .or(`buyer_id.eq.${uid},seller_id.eq.${uid}`).order('created_at', { ascending: false }),
    supabase.from('admin_conversations').select('id, last_message_at').eq('user_id', uid).maybeSingle(),
    fetchUnreadByTx(supabase),
  ])
  // Embed requests refusé (relation absente) : on relit les missions sans lui, rien d'autre ne change.
  let txs = (txRes.data ?? []) as any[]
  if (txRes.error) {
    const { data } = await supabase.from('transactions').select('*')
      .or(`buyer_id.eq.${uid},seller_id.eq.${uid}`).order('created_at', { ascending: false })
    txs = (data ?? []) as any[]
  }
  const ids = txs.map(t => t.id as string)
  const conv = convRes.data as { id: string; last_message_at: string } | null

  // profiles n'est lisible qu'en libre-service (RLS auth.uid() = id) : le nom
  // de l'interlocuteur passe par une fonction dediee, pas par un embed.
  const [namesRes, lastByTx, supportLast] = await Promise.all([
    ids.length ? supabase.rpc('transaction_counterparts', { p_transaction_ids: ids }) : Promise.resolve({ data: [] as any[] }),
    ids.length ? lastMessages(supabase, ids) : Promise.resolve({} as Record<string, any>),
    conv ? supabase.from('admin_messages').select('body, created_at').eq('conversation_id', conv.id)
      .order('created_at', { ascending: false }).limit(1).maybeSingle() : Promise.resolve({ data: null }),
  ])
  const nameById: Record<string, string> = {}
  ;((namesRes as any).data ?? []).forEach((n: any) => { if (n.full_name) nameById[n.transaction_id] = n.full_name })

  const missions = txs.map(t => {
    const isSeller = t.seller_id === uid
    return { ...t, lastMessage: lastByTx[t.id] ?? null, isSeller, kind: 'mission' as const, counterpart: nameById[t.id] || (isSeller ? 'Client' : 'Prestataire') }
  })
  const supportRow = conv ? { id: conv.id, kind: 'support' as const, lastMessage: (supportLast as any).data ?? null, created_at: conv.last_message_at } : null

  const rows = [...(supportRow ? [supportRow] : []), ...missions].sort((a: any, b: any) => {
    const ta = a.lastMessage?.created_at || a.created_at
    const tb = b.lastMessage?.created_at || b.created_at
    return new Date(tb).getTime() - new Date(ta).getTime()
  })
  return { rows, unread, isPro: !!ppRes.data }
}

// Lecture fraîche + mise en cache (utilisée par l'écran et par le préchargement des onglets).
export async function refreshMessagesCache(supabase: SupabaseClient, uid: string): Promise<MessagesData> {
  const data = await loadMessagesData(supabase, uid)
  writeScreenCache(MESSAGES_CACHE, uid, data)
  return data
}

export const readMessagesCache = (uid: string | null) => readScreenCache<MessagesData>(MESSAGES_CACHE, uid)

// ---------- Rangement de la liste (24/11, remarque de Romain : pas de liste à défilement infini) ----------
export const GROUP_PAGE = 15
export const DATE_GROUPS = ["Aujourd'hui", 'Hier', 'Cette semaine', 'Ce mois-ci', 'Plus ancien'] as const

const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()

// Groupe d'une conversation selon la date de sa dernière activité (dernier message, sinon création).
export function dateGroupOf(iso: string, now: Date = new Date()): (typeof DATE_GROUPS)[number] {
  const d = new Date(iso)
  const n = Math.round((dayStart(now) - dayStart(d)) / 86400000)
  if (n <= 0) return "Aujourd'hui"
  if (n === 1) return 'Hier'
  if (n < 7) return 'Cette semaine'
  if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) return 'Ce mois-ci'
  return 'Plus ancien'
}

export type ConvGroup = { label: string; items: any[] }

// Par date : cinq groupes, la plus récente d'abord ; par nom : une lettre par groupe, ordre alphabétique.
// Les groupes vides n'existent pas. Aucun filtre ici : la page filtre avant (recherche, non lus).
export function groupConversations(rows: any[], sort: 'date' | 'name', now: Date = new Date()): ConvGroup[] {
  const nameOf = (r: any) => (r.kind === 'support' ? 'Support PING' : r.counterpart) || '?'
  const when = (r: any) => r.lastMessage?.created_at || r.created_at
  if (sort === 'name') {
    const sorted = [...rows].sort((a, b) => nameOf(a).localeCompare(nameOf(b), 'fr') || new Date(when(b)).getTime() - new Date(when(a)).getTime())
    const out: ConvGroup[] = []
    sorted.forEach(r => {
      const l = nameOf(r).charAt(0).toUpperCase()
      const last = out[out.length - 1]
      if (last && last.label === l) last.items.push(r); else out.push({ label: l, items: [r] })
    })
    return out
  }
  const sorted = [...rows].sort((a, b) => new Date(when(b)).getTime() - new Date(when(a)).getTime())
  return DATE_GROUPS.map(label => ({ label: label as string, items: sorted.filter(r => dateGroupOf(when(r), now) === label) })).filter(g => g.items.length)
}
