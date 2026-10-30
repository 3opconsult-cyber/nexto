"use client"
import { useEffect } from 'react'

// Après une mise en ligne, un onglet resté ouvert peut demander un morceau de l'app qui n'existe plus
// (ChunkLoadError) : Next affiche alors « Application error ». On recharge la page une seule fois.
export default function ChunkReload() {
  useEffect(() => {
    const isChunk = (m: string) => /ChunkLoadError|Loading chunk [\w-]+ failed|Failed to fetch dynamically imported module/i.test(m)
    const reloadOnce = () => {
      try { if (sessionStorage.getItem('ping_chunk_reload')) return; sessionStorage.setItem('ping_chunk_reload', '1') } catch { }
      window.location.reload()
    }
    const onError = (e: ErrorEvent) => { if (isChunk(e.message || '')) reloadOnce() }
    const onRejection = (e: PromiseRejectionEvent) => { if (isChunk(String(e.reason?.message || e.reason || ''))) reloadOnce() }
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    // Page chargée correctement : on réautorise un rechargement pour la prochaine mise en ligne.
    const t = setTimeout(() => { try { sessionStorage.removeItem('ping_chunk_reload') } catch { } }, 10000)
    return () => { window.removeEventListener('error', onError); window.removeEventListener('unhandledrejection', onRejection); clearTimeout(t) }
  }, [])
  return null
}
