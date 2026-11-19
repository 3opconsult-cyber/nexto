"use client"
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { sessionUserId } from '@/lib/screenCache'
import type { Mode } from '@/lib/mode'

// « Notez … » (audit ergonomie 19/11 bis, correction 14) : après la fin d'une mission, le client voit
// au-dessus de la barre du bas un bandeau qui ouvre directement l'avis (chat?avis) : 3 appuis au lieu de 5.
// Une seule fois par mission : retiré dès qu'il est touché ou fermé, et au plus 24 h après sa première
// apparition (localStorage, par appareil). Seulement pour une mission terminée depuis moins de 7 jours,
// achetée par le compte (espace particulier), sans avis de sa part.
export type RatePrompt = { id: string; name: string }

const KEY = 'ping_rate_prompt'
const SHOW_MS = 24 * 3600_000
const RECENT_MS = 7 * 24 * 3600_000
let memo: { uid: string; at: number; value: RatePrompt | null } | null = null

type Seen = Record<string, { first: number; done?: boolean }>
function readSeen(): Seen {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {} } catch { return {} }
}
function writeSeen(v: Seen) {
  try { localStorage.setItem(KEY, JSON.stringify(v)) } catch { }
}
function allowed(id: string, now = Date.now()) {
  const s = readSeen()[id]
  return !s || (!s.done && now - s.first < SHOW_MS)
}

/** « Prénom N. » : jamais le nom complet dans un bandeau visible de loin. */
export function shortName(full: string | null | undefined) {
  const p = String(full || '').trim().split(/\s+/).filter(Boolean)
  if (!p.length) return 'votre prestataire'
  return p.length > 1 ? `${p[0]} ${p[1][0].toUpperCase()}.` : p[0]
}

async function fetchRatePrompt(): Promise<RatePrompt | null> {
  const supabase = createClient()
  const uid = await sessionUserId(supabase)
  if (!uid) return null
  if (memo && memo.uid === uid && Date.now() - memo.at < 60000) return memo.value && allowed(memo.value.id) ? memo.value : null
  const since = new Date(Date.now() - RECENT_MS).toISOString()
  const { data: txs } = await supabase.from('transactions').select('id, buyer_id, seller_id, completed_at')
    .eq('buyer_id', uid).in('status', ['completed', 'released']).gte('completed_at', since)
    .order('completed_at', { ascending: false }).limit(5)
  const list = ((txs ?? []) as any[]).filter(t => t.buyer_id !== t.seller_id && allowed(t.id))
  let value: RatePrompt | null = null
  if (list.length) {
    const ids = list.map(t => t.id)
    const [{ data: rv }, { data: names }] = await Promise.all([
      supabase.from('reviews').select('transaction_id').eq('rater_id', uid).in('transaction_id', ids),
      supabase.rpc('transaction_counterparts', { p_transaction_ids: ids }),
    ])
    const rated = new Set(((rv ?? []) as any[]).map(r => r.transaction_id))
    const t = list.find(x => !rated.has(x.id))
    if (t) value = { id: t.id, name: shortName(((names ?? []) as any[]).find(n => n.transaction_id === t.id)?.full_name) }
  }
  memo = { uid, at: Date.now(), value }
  return value
}

export function useRatePrompt(mode: Mode, pathname: string): [RatePrompt | null, (how: 'open' | 'close') => void] {
  const [p, setP] = useState<RatePrompt | null>(null)
  useEffect(() => {
    if (mode !== 'particulier') { setP(null); return }
    let alive = true
    fetchRatePrompt().then(v => {
      if (!alive) return
      if (v) {
        const s = readSeen()
        if (!s[v.id]) { s[v.id] = { first: Date.now() }; writeSeen(s) }
      }
      setP(v)
    }).catch(() => { })
    return () => { alive = false }
  }, [mode, pathname])
  const done = useCallback((_how: 'open' | 'close') => {
    setP(cur => {
      if (cur) {
        const s = readSeen()
        s[cur.id] = { first: s[cur.id]?.first ?? Date.now(), done: true }
        writeSeen(s)
      }
      return null
    })
  }, [])
  return [p, done]
}
