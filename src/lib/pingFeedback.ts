"use client"
import { useCallback, useEffect, useRef, useState } from 'react'

// Bouton PING des deux cartes (24/11) : un appui relance la recherche autour de soi ET le dit.
//  busy  : l'onde du bouton tourne (au moins WAVE_MS, même si la réponse est immédiate) ;
//  shown : la ligne « Actualisé : N ... » reste affichée SHOWN_MS après la réponse (le N est lu à l'affichage,
//          donc il suit la liste fraîchement reçue) ;
//  failed: la relecture a échoué (réseau) : la ligne le dit au lieu de faire croire à une mise à jour.
export const WAVE_MS = 1100
export const SHOWN_MS = 3000

export function usePingFeedback() {
  const [busy, setBusy] = useState(false)
  const [shown, setShown] = useState(false)
  const [failed, setFailed] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const alive = useRef(true)
  useEffect(() => () => { alive.current = false; if (timer.current) clearTimeout(timer.current) }, [])

  const run = useCallback(async (reload: () => Promise<unknown>) => {
    if (busy) return
    setBusy(true); setShown(false); setFailed(false)
    if (timer.current) clearTimeout(timer.current)
    const t0 = Date.now()
    let ok = true
    try { await reload() } catch { ok = false }
    const wait = Math.max(0, WAVE_MS - (Date.now() - t0))
    setTimeout(() => {
      if (!alive.current) return
      setBusy(false); setFailed(!ok); setShown(true)
      timer.current = setTimeout(() => { if (alive.current) { setShown(false); setFailed(false) } }, SHOWN_MS)
    }, wait)
  }, [busy])

  return { busy, shown, failed, run }
}
