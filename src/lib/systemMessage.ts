import type { SupabaseClient } from '@supabase/supabase-js'

// Messages automatiques du fil (réservation confirmée, en route, arrivée, fin, annulation, litige…).
// La RLS de `messages` refuse sender_id NULL : un message système est donc posté au nom de l'utilisateur
// qui déclenche l'action, avec kind = 'system'. L'affichage le traite comme un message de PING (pastille
// centrée), jamais comme une bulle de l'utilisateur.
export async function systemSender(supabase: SupabaseClient) {
  const { data: { user } } = await supabase.auth.getUser()
  return { sender_id: user?.id ?? null, kind: 'system' as const }
}

export const isSystemMessage = (m: { sender_id: string | null; kind?: string | null }) =>
  m.sender_id === null || m.kind === 'system'
