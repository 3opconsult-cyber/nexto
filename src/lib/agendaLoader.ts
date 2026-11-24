import type { SupabaseClient } from '@supabase/supabase-js'
import { writeScreenCache } from '@/lib/screenCache'
import { fetchSlotsBetween, type Slot } from '@/lib/slots'
import { addDays, startOfDay } from '@/components/calendar/dates'

// Lecture de l'Agenda (/agenda), partagée entre l'écran et le préchargement (audit ergonomie 19/11 ter,
// correction 3) : TabPrefetch et la connexion remplissent le cache de l'onglet, l'écran l'affiche à
// l'ouverture puis relit avec la même fonction. Missions des deux rôles : l'écran filtre selon le mode.
// Aucune donnée en plus : exactement ce que l'écran lisait, sous la RLS du compte connecté.
export const AGENDA_CACHE = 'agenda'
export type AgendaCache = {
  uid: string; txs: any[]; names: Record<string, string>; disputes: any[]; invoices: any[]
  freeSlots: Slot[] | null; isPro: boolean; openRequests: number; offersWaiting: number; rated: string[]
}

export async function loadAgendaSnap(supabase: SupabaseClient, uid: string): Promise<AgendaCache> {
  const from = addDays(startOfDay(new Date()), -7)
  const [{ data }, { data: pp }, slots, { data: revs }, { data: crevs }, { count }] = await Promise.all([
    supabase.from('transactions')
      .select('*, requests(description, category)')
      .or(`buyer_id.eq.${uid},seller_id.eq.${uid}`)
      .order('created_at', { ascending: false }),
    supabase.from('provider_profiles').select('id').eq('id', uid).maybeSingle(),
    fetchSlotsBetween(supabase, uid, from, addDays(from, 130)),
    supabase.from('reviews').select('transaction_id').eq('rater_id', uid),
    supabase.from('client_reviews').select('transaction_id').eq('rater_id', uid),
    supabase.from('requests').select('id', { count: 'exact', head: true }).eq('requester_id', uid).eq('status', 'open'),
  ])
  const list = data ?? []
  const next: AgendaCache = {
    uid, txs: list, names: {}, disputes: [], invoices: [],
    freeSlots: pp && slots ? slots.filter(x => !x.transaction_id) : null, isPro: !!pp,
    openRequests: count || 0, offersWaiting: 0,
    rated: [...(revs ?? []), ...(crevs ?? [])].map((r: any) => r.transaction_id),
  }

  // Le nom de l'interlocuteur remplace l'adresse comme titre (comme la
  // demo, "Sofia M. · Menage") : l'adresse ne s'affiche jamais ici, meme
  // une fois confirmee — inutile de l'exposer dans une liste d'apercu.
  if (list.length) {
    const ids = list.map((t: any) => t.id)
    // Propositions reçues en attente, sur les conversations où l'on est client, au tarif pas encore validé.
    const buyerOpen = list.filter((t: any) => t.buyer_id === uid && t.seller_id !== uid && t.status === 'pending' && !t.price_confirmed)
    const sellerOf = new Map(buyerOpen.map((t: any) => [t.id, t.seller_id]))
    const [{ data: rows }, { data: ds }, { data: inv }, { data: offers }] = await Promise.all([
      supabase.rpc('transaction_counterparts', { p_transaction_ids: ids }),
      supabase.from('disputes')
        .select('id, transaction_id, reason, status, created_at, deadline_at')
        .in('transaction_id', ids)
        .eq('status', 'open')
        .order('created_at', { ascending: false }),
      supabase.from('invoices')
        .select('id, transaction_id, kind, template, number, issued_at, net_cents, issuer_id, client_id')
        .in('transaction_id', ids)
        .order('issued_at', { ascending: false }),
      buyerOpen.length
        ? supabase.from('messages').select('transaction_id, sender_id').eq('kind', 'offer').eq('offer_status', 'pending').in('transaction_id', buyerOpen.map((t: any) => t.id))
        : Promise.resolve({ data: [] as any[] }),
    ])
    ;(rows ?? []).forEach((r: any) => { if (r.full_name) next.names[r.transaction_id] = r.full_name })
    next.disputes = ds ?? []
    next.invoices = inv ?? []
    next.offersWaiting = new Set((offers ?? []).filter((o: any) => o.sender_id && o.sender_id === sellerOf.get(o.transaction_id)).map((o: any) => o.transaction_id)).size
  }
  writeScreenCache(AGENDA_CACHE, uid, next)
  return next
}
