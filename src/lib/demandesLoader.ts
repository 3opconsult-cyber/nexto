import type { SupabaseClient } from '@supabase/supabase-js'
import { writeScreenCache } from '@/lib/screenCache'
import type { OfferMsg } from '@/lib/offers'

// Lecture de « Mes demandes » (/client/demandes), partagée entre l'écran et le préchargement (audit
// ergonomie 19/11 ter, correction 3) : TabPrefetch et la connexion remplissent le cache de l'onglet,
// l'écran l'affiche à l'ouverture puis relit avec la même fonction. Lecture en deux vagues (19/11 bis,
// correction 2) : demandes et transactions du client ensemble, puis noms, propositions, profils et pièces.
// Aucune donnée en plus : exactement ce que l'écran lisait, sous la RLS du compte connecté.
export const DEMANDES_CACHE = 'client_demandes'
export type Tx = {
  id: string; status: string; counterpart: string
  subtotal_cents: number | null; price_confirmed: boolean
  providerId: string | null
  hasPendingOffer: boolean // un devis du prestataire attend la réponse du client
  offer: (OfferMsg & { created_at: string }) | null // la dernière proposition en attente, acceptable d'ici
}
export type ProInfo = { rating: number | null; reviews_count: number; lat: number | null; lng: number | null; bio: string | null; has_identity: boolean; has_rcpro: boolean }

export type DemandesSnap = { rows: any[]; tx: Record<string, Tx[]>; pros: Record<string, ProInfo> }

/** null : lecture des demandes refusée (l'écran garde ce qu'il affiche). `onRows` : demandes dès la 1re vague. */
export async function loadDemandesSnap(supabase: SupabaseClient, uid: string, onRows?: (rows: any[]) => void): Promise<DemandesSnap | null> {
  const [{ data, error: reqErr }, { data: allTx }] = await Promise.all([
    supabase.from('requests').select('*').eq('requester_id', uid).order('created_at', { ascending: false }),
    // Transactions où le client est acheteur (la RLS les lui ouvre), filtrées ensuite sur ses demandes.
    supabase.from('transactions').select('id, request_id, status, seller_id, subtotal_cents, price_confirmed').eq('buyer_id', uid).not('request_id', 'is', null),
  ])
  if (reqErr) return null
  // Seules les demandes publiées (titre saisi dans « Publier une demande », ou encore ouvertes) :
  // les lignes créées automatiquement par « Contacter » ou une réservation directe ne sont pas
  // des demandes du point de vue du client — elles vivent dans Messages et l'Agenda.
  const list = (data ?? []).filter((r: any) => (r.title && r.title.trim()) || r.status === 'open')
  onRows?.(list)
  const ids = new Set(list.map((r: any) => r.id))
  // Une demande ouverte peut recevoir plusieurs propositions (un pro = une
  // transaction) : on les groupe toutes par demande, pas seulement la
  // derniere, sinon les autres propositions disparaissent silencieusement.
  const txs = (allTx ?? []).filter((t: any) => ids.has(t.request_id))
  const txIds = txs.map((t: any) => t.id)
  const proIds = Array.from(new Set(txs.map((t: any) => t.seller_id).filter(Boolean))) as string[]
  const [{ data: names }, { data: offers }, { data: pps }, trusts] = await Promise.all([
    txIds.length ? supabase.rpc('transaction_counterparts', { p_transaction_ids: txIds }) : Promise.resolve({ data: [] as any[] }),
    // Devis du prestataire en attente de réponse : la dernière proposition de chaque conversation,
    // acceptée d'ici par « Accepter ce prestataire » (même logique que le chat, src/lib/offers.ts).
    txIds.length
      ? supabase.from('messages').select('id, transaction_id, sender_id, offer_cents, offer_hourly_cents, offer_included_hours, created_at')
        .eq('kind', 'offer').eq('offer_status', 'pending').in('transaction_id', txIds).order('created_at', { ascending: true })
      : Promise.resolve({ data: [] as any[] }),
    // Note, position, présentation et pièces déclarées des prestataires qui ont répondu.
    proIds.length ? supabase.from('provider_profiles').select('id, rating, reviews_count, lat, lng, bio').in('id', proIds) : Promise.resolve({ data: [] as any[] }),
    Promise.all(proIds.map(id => supabase.rpc('provider_trust_stats', { provider_id: id }))),
  ])
  const nameById: Record<string, string> = {}
  ;(names ?? []).forEach((n: any) => { if (n.full_name) nameById[n.transaction_id] = n.full_name })
  const pendingOffer = new Map<string, OfferMsg & { created_at: string }>()
  const sellerOf: Record<string, string> = {}
  txs.forEach((t: any) => { sellerOf[t.id] = t.seller_id })
  ;(offers ?? []).forEach((o: any) => { if (o.sender_id && o.sender_id === sellerOf[o.transaction_id]) pendingOffer.set(o.transaction_id, o) })
  const grouped: Record<string, Tx[]> = {}
  txs.forEach((t: any) => {
    ;(grouped[t.request_id] ||= []).push({
      id: t.id, status: t.status, counterpart: nameById[t.id] || 'Prestataire',
      subtotal_cents: t.subtotal_cents ?? null, price_confirmed: !!t.price_confirmed,
      providerId: t.seller_id ?? null, hasPendingOffer: pendingOffer.has(t.id), offer: pendingOffer.get(t.id) ?? null,
    })
  })
  const info: Record<string, ProInfo> = {}
  ;(pps ?? []).forEach((p: any) => { info[p.id] = { rating: p.rating, reviews_count: p.reviews_count || 0, lat: p.lat, lng: p.lng, bio: p.bio, has_identity: false, has_rcpro: false } })
  proIds.forEach((id, i) => {
    const tr = (trusts[i] as any)?.data?.[0]
    if (info[id] && tr) { info[id].has_identity = !!tr.has_identity; info[id].has_rcpro = !!tr.has_rcpro }
  })
  const snap: DemandesSnap = { rows: list, tx: grouped, pros: info }
  writeScreenCache(DEMANDES_CACHE, uid, snap)
  return snap
}
