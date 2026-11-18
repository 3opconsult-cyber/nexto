// Prestations du catalogue d'un prestataire (table `services`, écran « Mes tarifs »).
//
// Demande Romain 18/11 : plusieurs prestations, chacune avec son métier, son nom, sa manière de
// tarifer (forfait, forfait + heures incluses, à l'heure, sur devis), son prix, une description
// courte, une photo facultative, et masquable.
//
// Colonnes `trade`, `photo_path`, `hidden` : migration 041 (supabase/migrations/041_prestations_photos.sql),
// PAS forcément appliquée. Toute lecture essaie d'abord avec elles et retombe sur les colonnes
// d'avant (008) si la base répond « colonne inconnue » : l'app marche avant et après la migration.
// Sans la colonne `trade`, le métier est déduit du nom (tradeOfServiceName) ; sans `hidden`, rien
// n'est masqué ; sans `photo_path`, aucune photo.
import { TRADES, tradeOfServiceName } from './trades'

export const SERVICE_PHOTO_BUCKET = 'service-photos'
export const SERVICE_PHOTO_MAX_BYTES = 5 * 1024 * 1024

const BASE_COLS = 'id, provider_id, name, description, pricing_type, base_price_cents, included_hours, hourly_rate_cents, price_cents, created_at'
const EXT_COLS = `${BASE_COLS}, trade, photo_path, hidden`

export type Prestation = {
  id: string
  provider_id: string
  name: string
  description: string | null
  pricing_type: 'forfait' | 'horaire' | 'devis'
  base_price_cents: number
  included_hours: number | null
  hourly_rate_cents: number | null
  price_cents: number | null
  /** Métier (clé de TRADES) : colonne `trade` si présente, sinon déduit du nom. */
  trade: string | null
  photo_path: string | null
  hidden: boolean
}

function normalize(r: any): Prestation {
  return {
    ...r,
    description: r.description ?? null,
    trade: r.trade || tradeOfServiceName(r.name),
    photo_path: r.photo_path ?? null,
    hidden: r.hidden === true,
  }
}

// Erreur PostgREST « colonne inconnue » (migration 041 absente) : 42703 côté Postgres, PGRST204 côté cache.
const missingColumn = (e: any) => !!e && (e.code === '42703' || e.code === 'PGRST204' || /column .* does not exist|Could not find the/i.test(e.message || ''))

/** `ext` : vrai si la migration 041 est en base (métier, photo et « masquée » enregistrables). */
export async function fetchPrestations(
  supabase: any, providerId: string, opts: { visibleOnly?: boolean } = {},
): Promise<{ rows: Prestation[]; ext: boolean; error: boolean }> {
  let ext = true
  let { data, error } = await supabase.from('services').select(EXT_COLS).eq('provider_id', providerId).order('created_at')
  if (missingColumn(error)) {
    ext = false
    ;({ data, error } = await supabase.from('services').select(BASE_COLS).eq('provider_id', providerId).order('created_at'))
  }
  let rows = ((data as any[]) ?? []).map(normalize)
  if (opts.visibleOnly) rows = rows.filter(r => !r.hidden)
  return { rows, ext, error: !!error }
}

export async function fetchPrestation(supabase: any, id: string): Promise<Prestation | null> {
  let { data, error } = await supabase.from('services').select(EXT_COLS).eq('id', id).maybeSingle()
  if (missingColumn(error)) ({ data } = await supabase.from('services').select(BASE_COLS).eq('id', id).maybeSingle())
  return data ? normalize(data) : null
}

/** Nom affiché : libellé du métier si le nom est une clé (« menage » → « Ménage »). */
export const prestationName = (p: { name: string }) => TRADES[p.name] || p.name

/**
 * URL publique de la photo (bucket public `service-photos`), ou null. Construite sans client Supabase
 * (appelable pendant le rendu, y compris au pré-rendu du build où le client n'existe pas).
 */
export function prestationPhotoUrl(path: string | null | undefined): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!path || !base) return null
  return `${base.replace(/\/$/, '')}/storage/v1/object/public/${SERVICE_PHOTO_BUCKET}/${path.split('/').map(encodeURIComponent).join('/')}`
}

/**
 * Dépose la photo sous `<uid>/<id prestation>/<horodatage>.<ext>` (la politique de stockage de la
 * migration 041 n'autorise l'écriture que dans le dossier de son propre uid). Renvoie le chemin, ou
 * un message lisible (bucket absent tant que la migration n'est pas appliquée, fichier trop lourd…).
 */
export async function uploadPrestationPhoto(supabase: any, uid: string, serviceId: string, file: File): Promise<{ path?: string; error?: string }> {
  if (!file.type.startsWith('image/')) return { error: 'Choisissez une image (JPEG, PNG ou WebP).' }
  if (file.size > SERVICE_PHOTO_MAX_BYTES) return { error: 'Photo trop lourde (5 Mo au maximum).' }
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
  const path = `${uid}/${serviceId}/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from(SERVICE_PHOTO_BUCKET).upload(path, file, { contentType: file.type, upsert: false })
  if (error) {
    return { error: /bucket/i.test(error.message || '') ? 'Les photos de prestation ne sont pas encore activées.' : 'La photo n’a pas pu être envoyée. Réessayez.' }
  }
  return { path }
}

/** Retire l'ancienne photo du stockage (échec silencieux : elle n'est plus référencée de toute façon). */
export async function removePrestationPhoto(supabase: any, path: string | null | undefined) {
  if (!path) return
  try { await supabase.storage.from(SERVICE_PHOTO_BUCKET).remove([path]) } catch { /* rien */ }
}
