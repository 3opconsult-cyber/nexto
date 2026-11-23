import type { SupabaseClient } from '@supabase/supabase-js'
import { readScreenCache, writeScreenCache } from '@/lib/screenCache'
import { fetchMyDocuments, type DocRowFull } from '@/lib/pieces'
import { canPublish, listingChecks, listingScore, loadListingFacts } from '@/lib/listing'
import { withProTaxStatus, type ProTaxStatus, type Invoice } from '@/lib/invoice-pdf'

// Lectures de Mon entreprise, Revenus et Facturation, partagées entre l'écran et le préchargement
// (audit ergonomie 19/11 bis, correction 3) : TabPrefetch remplit le cache de l'onglet pendant un
// temps mort, l'écran l'affiche à l'ouverture (< 1 s à froid) puis relit avec la même fonction.
// Aucune donnée en plus : exactement ce que l'écran lisait, sous la RLS du compte connecté.

const DONE = ['completed', 'released']

// ---- Mon entreprise (/pro/dashboard) ----
export type DashboardSnap = {
  firstName: string; city: string; pro: any; tx: any[]; docRows: DocRowFull[]
  listingPct: number | null; listingOk?: boolean | null; taxId: string | null; hasIban: boolean
}

/** null : pas encore de profil prestataire (l'écran renvoie vers l'onboarding). */
export async function loadDashboardSnap(supabase: SupabaseClient, id: string, prevListingPct: number | null = null): Promise<DashboardSnap | null> {
  const [profRes, ppRes, txRes, docsRes, privRes] = await Promise.all([
    supabase.from('profiles').select('first_name, city').eq('id', id).maybeSingle(),
    supabase.from('provider_profiles').select('*').eq('id', id).maybeSingle(),
    supabase.from('transactions').select('*, requests(category)').eq('seller_id', id).order('created_at', { ascending: false }),
    fetchMyDocuments(supabase, id),
    supabase.from('provider_private').select('tax_id, iban').eq('id', id).maybeSingle(),
  ])
  const pp = ppRes.data
  if (!pp) return null
  const snap: DashboardSnap = {
    firstName: (profRes.data as any)?.first_name || '', city: (profRes.data as any)?.city || '',
    pro: pp, tx: (txRes.data ?? []) as any[], docRows: docsRes.rows ?? [],
    listingPct: prevListingPct,
    taxId: (privRes.data as any)?.tax_id ?? null, hasIban: !!(privRes.data as any)?.iban,
  }
  writeScreenCache('dashboard', id, snap)
  return snap
}

/** Complétude de l'annonce (même calcul que /pro/annonce), ajoutée au cache de Mon entreprise. */
export async function loadDashboardListing(supabase: SupabaseClient, id: string, snap: DashboardSnap): Promise<{ pct: number; ok: boolean }> {
  const r = await loadListingFacts(supabase, id, snap.pro)
  const pct = listingScore(listingChecks(r.facts))
  const ok = canPublish(r.facts).ok // tarif + position : « Brouillon » tant que ce n'est pas le cas
  writeScreenCache('dashboard', id, { ...snap, listingPct: pct, listingOk: ok })
  return { pct, ok }
}

// ---- Revenus (/pro/revenus) ----
export type RevenusSnap = { m: number; y: number; cy: number; rating: number; reviews: number; sap: string | null; tax: string | null }

export async function loadRevenusSnap(supabase: SupabaseClient, id: string): Promise<RevenusSnap> {
  const [txRes, ppRes, sapRes, privRes] = await Promise.all([
    supabase.from('transactions').select('payout_cents, status, completed_at, created_at').eq('seller_id', id),
    supabase.from('provider_profiles').select('rating, reviews_count').eq('id', id).maybeSingle(),
    // Numéro SAP (migration 013) : requête séparée pour ne rien casser si la colonne n'existe pas encore.
    supabase.from('provider_profiles').select('sap_number').eq('id', id).maybeSingle(),
    supabase.from('provider_private').select('tax_id').eq('id', id).maybeSingle(),
  ])
  const now = new Date()
  const rows = (txRes.data ?? []).filter((t: any) => DONE.includes(t.status))
  let m = 0, y = 0, cy = 0
  rows.forEach((t: any) => {
    const d = new Date(t.completed_at || t.created_at)
    if (d.getFullYear() === now.getFullYear()) {
      y += t.payout_cents || 0
      cy += 1
      if (d.getMonth() === now.getMonth()) m += t.payout_cents || 0
    }
  })
  const pp: any = ppRes.data
  const snap: RevenusSnap = {
    m, y, cy, rating: Number(pp?.rating) || 0, reviews: pp?.reviews_count || 0,
    sap: sapRes.error ? null : ((sapRes.data as any)?.sap_number || ''),
    tax: privRes.error ? null : ((privRes.data as any)?.tax_id || ''),
  }
  writeScreenCache('revenus', id, snap)
  return snap
}

// ---- Facturation d'une mission (/mission/[id]/facture) ----
export type FactureSnap = {
  invoices: Invoice[]; isSeller: boolean; isBuyer: boolean; reviewed: boolean
  txInfo: { self: boolean; completed: boolean; missing?: boolean }
}
export const factureCacheKey = (txId: string) => `facture_${txId}`

export async function loadFactureSnap(supabase: SupabaseClient, uid: string | null, txId: string): Promise<FactureSnap> {
  const [{ data: tx }, { data }, rvRes] = await Promise.all([
    supabase.from('transactions').select('*').eq('id', txId).maybeSingle(),
    supabase.from('invoices').select('*').eq('transaction_id', txId),
    uid ? supabase.from('reviews').select('id').eq('transaction_id', txId).eq('rater_id', uid).limit(1) : Promise.resolve({ data: [] as any[] }),
  ])
  const t: any = tx
  const amBuyer = uid && t ? uid === t.buyer_id : true
  // Prestation d'abord, puis UNIQUEMENT la commission qui concerne le viewer
  // (client = frais de service ; prestataire = commission PING). Jamais les deux — comme Airbnb.
  const mine = amBuyer ? 'commission_client' : 'commission_pro'
  // Factures émises avant la migration 038 : la preuve réelle et le forfait sont repris de la mission.
  const enrich = (v: Invoice): Invoice => {
    if (v.kind !== 'prestation' || !t || !Array.isArray(v.lines) || !v.lines[0]) return v
    const l0 = v.lines[0]
    return { ...v, lines: [{
      ...l0,
      preuve_arrivee: l0.preuve_arrivee ?? t.arrival_proof ?? t.arrival_method ?? null,
      preuve_depart: l0.preuve_depart ?? t.completion_proof ?? null,
      photo_arrivee: l0.photo_arrivee ?? (t.arrival_photo_path ? true : null),
      forfait_cents: l0.forfait_cents ?? t.base_forfait_cents ?? null,
      heures_incluses: l0.heures_incluses ?? t.included_hours ?? null,
    }, ...v.lines.slice(1)] }
  }
  // Forme juridique et TVA (migration 039) : pour une facture émise avant, statut actuel du prestataire,
  // si la base connaît déjà ces colonnes (sinon erreur ignorée, rien ne change).
  let live: ProTaxStatus | null = null
  if (t?.seller_id && (data ?? []).some((v: any) => v.template === 'facture' && v.issuer_snapshot?.forme_juridique == null && v.issuer_snapshot?.tva_regime == null)) {
    const { data: st, error: stErr } = await supabase.from('provider_profiles')
      .select('legal_form, vat_status, vat_number').eq('id', t.seller_id).maybeSingle()
    if (!stErr && st) live = st as ProTaxStatus
  }
  const invoices = ((data ?? []) as Invoice[]).map(enrich).map(v => withProTaxStatus(v, live))
    .filter(v => v.kind === 'prestation' || v.kind === mine)
    .sort((a, b) => (a.kind === 'prestation' ? 0 : 1) - (b.kind === 'prestation' ? 0 : 1))
  const txInfo = !t ? { self: false, completed: false, missing: true }
    : { self: t.buyer_id === t.seller_id, completed: !!t.completed_at || DONE.includes(t.status) }
  const isSeller = !!uid && !!t && uid === t.seller_id
  const isBuyer = !!uid && !!t && uid === t.buyer_id
  const reviewed = isBuyer ? !!(rvRes as any).data?.length : true
  const snap: FactureSnap = { invoices, isSeller, isBuyer, reviewed, txInfo }
  writeScreenCache(factureCacheKey(txId), uid, snap)
  return snap
}

/**
 * Préchargement des factures des dernières missions terminées du mode courant (au plus 3), pour
 * que « Agenda → Factures → facture » s'ouvre sans attente. Ne relit pas une facture déjà en cache.
 */
export async function warmRecentFactures(supabase: SupabaseClient, uid: string, role: 'buyer_id' | 'seller_id'): Promise<string[]> {
  const { data } = await supabase.from('transactions').select('id')
    .eq(role, uid).in('status', DONE).order('completed_at', { ascending: false, nullsFirst: false }).limit(3)
  const ids = ((data ?? []) as { id: string }[]).map(r => r.id)
  await Promise.all(ids.filter(id => !readScreenCache(factureCacheKey(id), uid)).map(id => loadFactureSnap(supabase, uid, id).catch(() => null)))
  return ids
}
