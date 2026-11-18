import type { SupabaseClient } from '@supabase/supabase-js'

// Attestation d'assurance transmise sur demande du client, dans le chat d'une mission.
// Rien n'est rendu public : le prestataire crée lui-même (propriétaire du fichier, bucket privé
// `documents`) un lien signé valable 7 jours, posté dans le fil de CETTE mission seulement.
// Pièce d'assurance = documents.kind 'rcpro' (rubrique « Assurances » de /pro/documents :
// RC pro, décennale ou autre attestation).

export const INSURANCE_REQUEST_BODY = 'Le client demande l’attestation d’assurance du prestataire.'
export const INSURANCE_SENT_PREFIX = 'Attestation d’assurance transmise par le prestataire'
export const INSURANCE_LINK_DAYS = 7
const LINK_SECONDS = INSURANCE_LINK_DAYS * 24 * 3600

export const isInsuranceRequest = (body: string | null | undefined) => !!body && body.startsWith(INSURANCE_REQUEST_BODY)
export const isInsuranceSent = (body: string | null | undefined) => !!body && body.startsWith(INSURANCE_SENT_PREFIX)

// Lien de l'attestation dans un message : seulement un lien signé du bucket `documents` de ce projet
// (un message système peut être posté par n'importe quelle partie : on n'affiche pas un lien arbitraire).
export function insuranceLink(body: string): string | null {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '')
  if (!base) return null
  const m = body.match(/https:\/\/\S+/)
  if (!m) return null
  const url = m[0]
  return url.startsWith(`${base}/storage/v1/object/sign/documents/`) ? url : null
}

export type InsuranceResult = { url: string; until: Date } | { missing: true } | { error: string }

// Côté prestataire : sa pièce d'assurance (reçue ou validée), lien signé de 7 jours.
export async function signMyInsurance(supabase: SupabaseClient, userId: string): Promise<InsuranceResult> {
  const { data: doc, error } = await supabase.from('documents')
    .select('storage_path, status').eq('owner_id', userId).eq('kind', 'rcpro').maybeSingle()
  if (error) return { error: 'Impossible de retrouver votre attestation pour le moment. Réessayez.' }
  if (!doc?.storage_path || !['pending', 'valid'].includes(doc.status)) return { missing: true }
  const { data, error: sErr } = await supabase.storage.from('documents').createSignedUrl(doc.storage_path, LINK_SECONDS)
  if (sErr || !data?.signedUrl) return { error: 'Le lien vers votre attestation n’a pas pu être créé. Réessayez.' }
  return { url: data.signedUrl, until: new Date(Date.now() + LINK_SECONDS * 1000) }
}
