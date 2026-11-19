"use client"
import type { SupabaseClient } from '@supabase/supabase-js'
import { warmProCarte, warmClientMap } from '@/lib/carteLoaders'
import { refreshMessagesCache } from '@/lib/messagesList'
import { loadAgendaSnap } from '@/lib/agendaLoader'
import { loadDemandesSnap } from '@/lib/demandesLoader'

// Lectures lancées dès la connexion réussie (audit ergonomie 19/11 ter, corrections 2 et 3), en parallèle
// du journal de connexion et du choix de l'espace d'arrivée : la liste de la carte d'arrivée d'abord
// (demandes autour de soi pour un prestataire, prestataires autour de soi sinon), puis, en parallèle,
// Messages, Agenda et, côté particulier, Mes demandes. Tout va dans le cache de l'onglet (lié au compte) ;
// chaque écran l'affiche à l'ouverture puis relit comme avant. Aucun échec ne remonte.
export async function warmAfterLogin(supabase: SupabaseClient, uid: string): Promise<void> {
  const [{ data: prof }, { data: pp }] = await Promise.all([
    supabase.from('profiles').select('is_admin, is_pro').eq('id', uid).maybeSingle(),
    supabase.from('provider_profiles').select('id').eq('id', uid).maybeSingle(),
  ])
  if ((prof as any)?.is_admin) return
  const proHome = !!(prof as any)?.is_pro && !!pp
  const main = proHome ? warmProCarte(supabase, uid) : warmClientMap(uid)
  refreshMessagesCache(supabase, uid).catch(() => { })
  loadAgendaSnap(supabase, uid).catch(() => { })
  if (!proHome) loadDemandesSnap(supabase, uid).catch(() => { })
  // Seule la carte est attendue (la connexion patiente au plus un instant avant de rediriger).
  try { await main } catch { /* la carte relira elle-même */ }
}
