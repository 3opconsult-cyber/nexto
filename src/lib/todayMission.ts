"use client"
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { roleColumn, type Mode } from '@/lib/mode'
import { getPresenceState, presenceAvailable } from '@/lib/presence'

// « Mission du jour » : la mission confirmée du mode courant qui est en cours, ou prévue aujourd'hui à partir
// de 2 h avant l'heure (ou annoncée « en route »), ou dont l'heure est passée de moins de 12 h sans arrivée.
// Sert au bouton d'accès rapide (barre du bas, menu, barre latérale) et à l'agenda.
export type TodayMission = { id: string; status: string; scheduled_at: string | null; en_route_at: string | null; arrived_at: string | null; urgent: boolean }

const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

export function isTodayMission(t: { status?: string; price_confirmed?: boolean; scheduled_at?: string | null; en_route_at?: string | null; arrived_at?: string | null; completed_at?: string | null }, now = new Date()): boolean {
  if (!t.price_confirmed || t.completed_at || !['pending', 'arrived'].includes(t.status || '')) return false
  if (t.arrived_at || t.en_route_at) return true
  if (!t.scheduled_at) return false
  const at = new Date(t.scheduled_at)
  const diff = at.getTime() - now.getTime()
  return (sameDay(at, now) && diff <= 2 * 3600_000) || (diff < 0 && diff > -12 * 3600_000)
}

export async function fetchTodayMission(mode: Mode): Promise<TodayMission | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('transactions')
    .select('id, status, price_confirmed, scheduled_at, en_route_at, arrived_at, completed_at, buyer_id, seller_id')
    .eq(roleColumn(mode), user.id).eq('price_confirmed', true).in('status', ['pending', 'arrived'])
    .order('scheduled_at', { ascending: true, nullsFirst: false }).limit(30)
  const now = new Date()
  const list = (data ?? []).filter((t: any) => t.buyer_id !== t.seller_id && isTodayMission(t, now))
  if (!list.length) return null
  const pick: any = list.find((t: any) => t.arrived_at) || list.find((t: any) => t.en_route_at) || list[0]
  let urgent = false
  if (mode === 'particulier' && await presenceAvailable(supabase)) {
    const st = await getPresenceState(supabase, pick.id)
    urgent = !!st && Object.values(st.remote || {}).some(r => r?.etat === 'en_attente')
  }
  return { id: pick.id, status: pick.status, scheduled_at: pick.scheduled_at, en_route_at: pick.en_route_at, arrived_at: pick.arrived_at, urgent }
}

/** Mission du jour du mode courant ; rafraîchie à chaque changement de page et toutes les 60 s. */
export function useTodayMission(mode: Mode | null, refreshKey?: string): TodayMission | null {
  const [m, setM] = useState<TodayMission | null>(null)
  useEffect(() => {
    if (!mode) { setM(null); return }
    let alive = true
    const run = () => { fetchTodayMission(mode).then(v => { if (alive) setM(v) }).catch(() => { }) }
    run()
    const iv = setInterval(run, 60000)
    const vis = () => { if (document.visibilityState === 'visible') run() }
    document.addEventListener('visibilitychange', vis)
    return () => { alive = false; clearInterval(iv); document.removeEventListener('visibilitychange', vis) }
  }, [mode, refreshKey])
  return m
}
