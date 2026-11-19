"use client"
import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { sessionUserId, readScreenCache, screenCacheAge } from '@/lib/screenCache'
import { readMode, roleColumn } from '@/lib/mode'
import { refreshMessagesCache, MESSAGES_CACHE } from '@/lib/messagesList'

// Préchargement des onglets de la barre du bas (audit ergonomie 19/11, correction 3) : le code des
// écrans Carte / Demandes, Messages, Agenda, Profil / Mon entreprise est chargé pendant un temps mort,
// et la liste des conversations est lue d'avance (cache de l'onglet) pour que Messages s'affiche
// sans attente. Seulement pour un compte connecté, au plus une lecture par minute, jamais sur les
// pages d'avant l'application (connexion, présentation).
// Correction 3 du 19/11 bis : en espace prestataire, Mon entreprise et Revenus sont aussi lus d'avance,
// et dans les deux espaces les factures des 3 dernières missions terminées (code de l'écran compris),
// pour que ces écrans s'ouvrent en moins d'une seconde même à la première visite.
// Correction 3 du 19/11 ter : Agenda (les deux espaces), Messages et Mes demandes (particulier) sont aussi
// lus d'avance (et dès la connexion, src/lib/loginWarm.ts) ; une lecture de moins d'une minute n'est pas refaite.
const ROUTES = ['/map', '/pro/carte', '/messages', '/agenda', '/client/demandes', '/client/profil', '/pro/dashboard', '/pro/revenus']
const fresh = (key: string, uid: string) => { const a = screenCacheAge(key, uid); return a != null && a < 60000 }
const SKIP = /^\/(auth|essai|bienvenue|plaquettes|animation|admin|l\/)/
let lastWarm = 0
let lastData = 0

export default function TabPrefetch() {
  const router = useRouter()
  const path = usePathname() || ''
  useEffect(() => {
    if (SKIP.test(path) || path === '/') return
    let off = false
    const idle = (cb: () => void) => {
      const w = window as unknown as { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number }
      if (w.requestIdleCallback) w.requestIdleCallback(cb, { timeout: 2500 }); else setTimeout(cb, 1200)
    }
    idle(async () => {
      if (off) return
      const supabase = createClient()
      const uid = await sessionUserId(supabase)
      if (off || !uid) return
      for (const r of ROUTES) if (r !== path) { try { router.prefetch(r) } catch { /* rien */ } }
      if (Date.now() - lastData > 60000) {
        lastData = Date.now()
        const mode = readMode()
        // Chargé à la demande : ces lectures ne pèsent pas sur le code commun de toutes les pages.
        import('@/lib/screenLoaders').then(async L => {
          if (off) return
          if (mode === 'pro') {
            if (path !== '/pro/dashboard' && !readScreenCache('dashboard', uid)) L.loadDashboardSnap(supabase, uid).catch(() => { })
            if (path !== '/pro/revenus' && !readScreenCache('revenus', uid)) L.loadRevenusSnap(supabase, uid).catch(() => { })
          }
          if (path !== '/agenda' && !fresh('agenda', uid)) import('@/lib/agendaLoader').then(A => A.loadAgendaSnap(supabase, uid)).catch(() => { })
          if (mode !== 'pro' && path !== '/client/demandes' && !fresh('client_demandes', uid)) import('@/lib/demandesLoader').then(D => D.loadDemandesSnap(supabase, uid)).catch(() => { })
          const ids = await L.warmRecentFactures(supabase, uid, roleColumn(mode)).catch(() => [] as string[])
          for (const id of ids) { try { router.prefetch(`/mission/${id}/facture`) } catch { /* rien */ } }
        }).catch(() => { })
      }
      // Liste des conversations : relue d'avance hors de Messages (qui la lit lui-même).
      if (path === '/messages' || Date.now() - lastWarm < 60000 || fresh(MESSAGES_CACHE, uid)) return
      lastWarm = Date.now()
      refreshMessagesCache(supabase, uid).catch(() => { })
    })
    return () => { off = true }
  }, [path, router])
  return null
}
