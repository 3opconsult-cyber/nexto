/**
 * Adresse montrée au prestataire tant qu'elle n'est pas validée : la rue et la ville, sans le numéro
 * (Romain 31/10). « 12 bis avenue des Poilus, 06140 Vence » -> « avenue des Poilus, 06140 Vence ».
 */
export function maskAddress(addr: string | null | undefined) {
  const s = String(addr ?? '').trim()
  if (!s) return ''
  return s.replace(/^\s*\d+\s*(?:[-/]\s*\d+\s*)?(?:bis|ter|quater|[a-d])?\b[\s,]*/i, '').trim()
}

export type AddressStatus = 'profil' | 'a_valider' | 'acceptee' | 'refusee'
/** L'adresse exacte n'est transmise au prestataire que si elle est celle du profil ou qu'il l'a acceptée. */
export const addressUsable = (s?: string | null) => !s || s === 'profil' || s === 'acceptee'
