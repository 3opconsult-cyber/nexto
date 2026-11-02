// « Mon annonce » du prestataire (migration 026) : accroche, rayon, galerie, points forts, et la jauge
// de complétude. Une seule source pour la page /pro/annonce, la carte de Mon entreprise et la fiche
// publique /pro/[id] — ne pas redéfinir ces listes dans un écran.

export const LISTING_BUCKET = 'listing'
export const GALLERY_MAX = 6
export const HEADLINE_MAX = 90
export const BIO_MIN = 80

// URL publique d'une photo de la galerie (bucket public `listing`, chemin `<uid>/…`).
export function listingPhotoUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '')
  return `${base}/storage/v1/object/public/${LISTING_BUCKET}/${path.split('/').map(encodeURIComponent).join('/')}`
}

// Points forts : formulations déclaratives (« fourni », « possible »), jamais « garanti » ni « certifié ».
export const HIGHLIGHTS: { key: string; label: string }[] = [
  { key: 'materiel', label: 'Matériel fourni' },
  { key: 'produits', label: 'Produits ménagers fournis' },
  { key: 'eco', label: 'Produits écologiques' },
  { key: 'repassage_domicile', label: 'Repassage à domicile' },
  { key: 'linge_collecte', label: 'Linge récupéré et rapporté' },
  { key: 'regulier', label: 'Interventions régulières' },
  { key: 'week_end', label: 'Disponible le week-end' },
  { key: 'cles', label: 'Remise des clés possible' },
  { key: 'animaux', label: 'À l’aise avec les animaux' },
  { key: 'cesu', label: 'Accepte le CESU' },
  { key: 'anglais', label: 'Parle anglais' },
]
export const highlightLabel = (k: string) => HIGHLIGHTS.find(h => h.key === k)?.label || k

export const RADIUS_CHOICES = [5, 10, 15, 20, 30, 50]

type Cols = { pricing_type?: string | null; base_price_cents?: number | null; hourly_rate_cents?: number | null; price_cents?: number | null }
// Un tarif « existe » s'il porte un prix, ou s'il est explicitement sur devis.
export const hasPrice = (c: Cols) =>
  c.pricing_type === 'devis' || (c.base_price_cents ?? 0) > 0 || (c.hourly_rate_cents ?? 0) > 0 || (c.price_cents ?? 0) > 0

export type ListingCheck = { key: string; label: string; done: boolean; href?: string; anchor?: string; hint: string }

// Page de retour transmise aux écrans de saisie (?retour=) pour afficher « Retour à mon annonce ».
export const LISTING_RETURN = '/pro/annonce'
const back = (path: string) => `${path}?retour=${encodeURIComponent(LISTING_RETURN)}`

export type ListingFacts = {
  photo: boolean
  bioLength: number
  tarifs: number
  placed: boolean
  slots: number
  identity: boolean
}

export function listingChecks(f: ListingFacts): ListingCheck[] {
  return [
    { key: 'photo', label: 'Une photo', done: f.photo, anchor: 'ann-photos', hint: 'Une photo de couverture ou un logo.' },
    { key: 'bio', label: `Une présentation d’au moins ${BIO_MIN} caractères`, done: f.bioLength >= BIO_MIN, anchor: 'ann-bio', hint: f.bioLength ? `${f.bioLength} / ${BIO_MIN} caractères pour l’instant.` : 'Quelques phrases sur vous et votre façon de travailler.' },
    { key: 'tarif', label: 'Au moins un tarif', done: f.tarifs > 0, href: back('/pro/tarifs'), hint: 'Indispensable pour être réservé.' },
    { key: 'position', label: 'Votre position sur la carte', done: f.placed, href: back('/pro/onboarding'), hint: 'Votre adresse, pour apparaître près des clients.' },
    { key: 'creneau', label: 'Au moins un créneau libre', done: f.slots > 0, href: back('/pro/disponibilites'), hint: 'Les clients réservent directement un créneau.' },
    { key: 'identite', label: 'Pièce d’identité fournie', done: f.identity, href: back('/pro/documents'), hint: 'Affichée « fournie » sur votre annonce.' },
  ]
}

export function listingScore(checks: ListingCheck[]): number {
  return Math.round((checks.filter(c => c.done).length / checks.length) * 100)
}

// Minimum pour mettre l'annonce en ligne : un tarif et une position (le reste améliore l'annonce).
export function canPublish(f: ListingFacts): { ok: boolean; missing: string[] } {
  const missing: string[] = []
  if (f.tarifs === 0) missing.push('au moins un tarif')
  if (!f.placed) missing.push('votre position sur la carte')
  return { ok: missing.length === 0, missing }
}

// Charge ce qu'il faut pour la jauge (et l'aperçu) : tarifs, créneaux libres à venir, pièce d'identité.
// `pp` : la ligne provider_profiles déjà chargée par l'écran appelant.
export async function loadListingFacts(supabase: any, uid: string, pp: any) {
  const now = new Date()
  const in60 = new Date(now.getTime() + 60 * 86400000)
  const [{ data: services }, { data: slots }, { data: docs }] = await Promise.all([
    supabase.from('services')
      .select('id, name, description, pricing_type, base_price_cents, included_hours, hourly_rate_cents, price_cents')
      .eq('provider_id', uid).order('created_at'),
    supabase.from('provider_slots').select('id, starts_at, duration_minutes, transaction_id')
      .eq('provider_id', uid).is('transaction_id', null)
      .gte('starts_at', now.toISOString()).lt('starts_at', in60.toISOString()).order('starts_at').limit(50),
    supabase.from('documents').select('kind, status').eq('owner_id', uid),
  ])
  const docMap: Record<string, string> = {}
  ;((docs as any[]) ?? []).forEach(d => { docMap[d.kind] = d.status })
  const provided = (k: string) => docMap[k] === 'valid' || docMap[k] === 'pending'
  const svc = ((services as any[]) ?? [])
  const facts: ListingFacts = {
    photo: !!(pp?.photo_url || pp?.logo_url),
    bioLength: (pp?.bio || '').trim().length,
    tarifs: (pp && hasPrice(pp) ? 1 : 0) + svc.filter(hasPrice).length,
    placed: pp?.lat != null && pp?.lng != null,
    slots: ((slots as any[]) ?? []).length,
    identity: provided('identite'),
  }
  return { facts, services: svc, slots: ((slots as any[]) ?? []), hasIdentity: provided('identite'), hasRcpro: provided('rcpro') }
}
