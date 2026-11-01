"use client"
import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { roleColumn, type Mode } from '@/lib/mode'

// Messages non lus : RPC unread_counts() (migration 028) = messages de l'autre partie plus récents que
// la dernière lecture notée dans message_reads. Rien n'est modifié sur `messages`.
export const UNREAD_EVENT = 'ping-unread'

// { identifiant de mission → nombre de non lus }, toutes missions confondues.
export async function fetchUnreadByTx(supabase: SupabaseClient): Promise<Record<string, number>> {
  const { data, error } = await supabase.rpc('unread_counts')
  if (error || !data) return {}
  const out: Record<string, number> = {}
  for (const r of data as { transaction_id: string; n: number }[]) if (r.n > 0) out[r.transaction_id] = Number(r.n)
  return out
}

// Total du mode courant : pro = missions où l'on est prestataire, particulier = où l'on est client.
export async function fetchUnreadTotal(supabase: SupabaseClient, mode: Mode): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 0
  const byTx = await fetchUnreadByTx(supabase)
  const ids = Object.keys(byTx)
  if (!ids.length) return 0
  const col = roleColumn(mode)
  const { data: txs } = await supabase.from('transactions').select('id').in('id', ids).eq(col, user.id)
  return (txs ?? []).reduce((s: number, t: { id: string }) => s + (byTx[t.id] || 0), 0)
}

// Note la conversation comme lue (aujourd'hui, ou à la date du dernier message vu si l'horloge retarde).
export async function markRead(supabase: SupabaseClient, userId: string, transactionId: string, latestMessageAt?: string | null) {
  const now = Date.now()
  const last = latestMessageAt ? new Date(latestMessageAt).getTime() : 0
  const { error } = await supabase.from('message_reads').upsert(
    { user_id: userId, transaction_id: transactionId, last_read_at: new Date(Math.max(now, last)).toISOString() },
    { onConflict: 'user_id,transaction_id' },
  )
  if (!error && typeof window !== 'undefined') window.dispatchEvent(new Event(UNREAD_EVENT))
}

// Pastille de l'onglet Messages : se met à jour à chaque changement de page, toutes les 30 s,
// au retour sur l'onglet du navigateur et quand une conversation est lue.
export function useUnreadTotal(mode: Mode | null, refreshKey?: string): number {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!mode) return
    let alive = true
    const supabase = createClient()
    const run = () => { fetchUnreadTotal(supabase, mode).then(v => { if (alive) setN(v) }).catch(() => { }) }
    run()
    const iv = setInterval(run, 30000)
    const vis = () => { if (document.visibilityState === 'visible') run() }
    window.addEventListener(UNREAD_EVENT, run)
    document.addEventListener('visibilitychange', vis)
    return () => { alive = false; clearInterval(iv); window.removeEventListener(UNREAD_EVENT, run); document.removeEventListener('visibilitychange', vis) }
  }, [mode, refreshKey])
  return n
}
