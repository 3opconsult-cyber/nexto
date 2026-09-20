"use client"
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { trackEvent } from '@/lib/tracking'

/**
 * Les démos statiques (public/app.html, client.html) envoient déjà un
 * page_view à chaque écran — la vraie application, elle, n'envoyait
 * quasiment rien (seulement quelques événements nommés ponctuels). Sans
 * ça, impossible de reconstituer le parcours réel d'un testeur : d'où
 * l'absence de "mapping" demandée.
 */
export default function PageViewTracker() {
  const pathname = usePathname()

  useEffect(() => {
    trackEvent('page_view')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  return null
}
