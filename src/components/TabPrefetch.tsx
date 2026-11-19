"use client"
import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { sessionUserId } from '@/lib/screenCache'
import { refreshMessagesCache } from '@/lib/messagesList'

// Préchargement des onglets de la barre du bas (audit ergonomie 19/11, correction 3) : le code des
// écrans Carte / Demandes, Messages, Agenda, Profil / Mon entreprise est chargé pendant un temps mort,
// et la liste des conversations est lue d'avance (cache de l'onglet) pour que Messages s'affiche
// sans attente. Seulement pour un compte connecté, au plus une lecture par minute, jamais sur les
// pages d'avant l'application (connexion, présentation).
const ROUTES = ['/map', '/pro/carte', '/messages', '/agenda', '/client/profil', '/pro/dashboard']
const SKIP = /^\/(auth|essai|bienvenue|plaquettes|animation|admin|l\/)/
let lastWarm = 0

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
      // Liste des conversations : relue d'avance hors de Messages (qui la lit lui-même).
      if (path === '/messages' || Date.now() - lastWarm < 60000) return
      lastWarm = Date.now()
      refreshMessagesCache(supabase, uid).catch(() => { })
    })
    return () => { off = true }
  }, [path, router])
  return null
}
