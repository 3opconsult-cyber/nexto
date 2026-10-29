"use client"
import { useCallback, useEffect, useState } from 'react'

// Mode courant de l'utilisateur, comme « voyageur / hôte » sur Airbnb : un même compte peut être
// client et prestataire, mais chaque écran partagé (agenda, messages, litiges, opérations) ne montre
// que les missions du mode affiché. Même clé que DesktopShell et NavDrawer.
export type Mode = 'particulier' | 'pro'

export function readMode(): Mode {
  try { return localStorage.getItem('ping_mode') === 'pro' ? 'pro' : 'particulier' } catch { return 'particulier' }
}

export function writeMode(m: Mode) {
  try { localStorage.setItem('ping_mode', m) } catch { }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('ping-mode'))
}

// Côté de la transaction correspondant au mode : le client achète, le prestataire vend.
export function roleColumn(m: Mode): 'buyer_id' | 'seller_id' {
  return m === 'pro' ? 'seller_id' : 'buyer_id'
}

// null tant que le mode n'est pas lu (évite d'afficher puis de retirer des données au premier rendu).
// `isPro` : un compte sans profil prestataire est toujours en mode particulier.
export function useMode(isPro: boolean | null): [Mode | null, (m: Mode) => void] {
  const [mode, setMode] = useState<Mode | null>(null)
  useEffect(() => {
    if (isPro === null) return
    const sync = () => setMode(isPro ? readMode() : 'particulier')
    sync()
    window.addEventListener('ping-mode', sync)
    window.addEventListener('storage', sync)
    return () => { window.removeEventListener('ping-mode', sync); window.removeEventListener('storage', sync) }
  }, [isPro])
  const change = useCallback((m: Mode) => writeMode(m), [])
  return [mode, change]
}
