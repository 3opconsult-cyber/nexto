"use client"
import { useEffect, useState } from 'react'

// Place de la bulle verte (FeedbackBubble) sur les écrans de carte : elle se range au-dessus des
// boutons de la carte (PING, Recentrer) au lieu de les recouvrir, et se cache quand le volet est
// plein ou qu'un aperçu est ouvert. `bottom` = distance en px depuis le bas de la fenêtre, hors
// bandeau d'installation (la bulle ajoute elle-même --ping-install-lift). null = place par défaut.
// `right` (facultatif) : distance au bord droit, pour la ranger à gauche d'un panneau latéral.
export function useFeedbackBubbleSlot(bottom: number | null, hidden: boolean, right: number | null = null) {
  useEffect(() => {
    const root = document.documentElement
    if (bottom == null) root.style.removeProperty('--ping-fb-bottom')
    else root.style.setProperty('--ping-fb-bottom', `${Math.round(bottom)}px`)
    if (right == null) root.style.removeProperty('--ping-fb-right')
    else root.style.setProperty('--ping-fb-right', `${Math.round(right)}px`)
    if (hidden) root.setAttribute('data-fb-hide', '')
    else root.removeAttribute('data-fb-hide')
  }, [bottom, hidden, right])
  useEffect(() => () => {
    const root = document.documentElement
    root.style.removeProperty('--ping-fb-bottom')
    root.style.removeProperty('--ping-fb-right')
    root.removeAttribute('data-fb-hide')
  }, [])
}

/** true à partir de 1000 px (barre latérale, panneau de détail permanent). */
export function useIsDesktop() {
  const [desk, setDesk] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1000px)')
    const on = () => setDesk(mq.matches)
    on()
    mq.addEventListener?.('change', on)
    return () => mq.removeEventListener?.('change', on)
  }, [])
  return desk
}

/** Hauteur du bandeau d'action posé au-dessus de la barre du bas (--banner-h, BottomTabBar), suivie en direct. */
export function useBannerH() {
  const [h, setH] = useState(0)
  useEffect(() => {
    const root = document.documentElement
    const read = () => setH(parseFloat(root.style.getPropertyValue('--banner-h')) || 0)
    read()
    const mo = new MutationObserver(read)
    mo.observe(root, { attributes: true, attributeFilter: ['style'] })
    return () => mo.disconnect()
  }, [])
  return h
}

/** Hauteur d'un élément, suivie au redimensionnement. */
export function useElementHeight(el: HTMLElement | null) {
  const [h, setH] = useState(0)
  useEffect(() => {
    if (!el) return
    const on = () => setH(el.clientHeight)
    on()
    const ro = new ResizeObserver(on)
    ro.observe(el)
    window.addEventListener('resize', on)
    return () => { ro.disconnect(); window.removeEventListener('resize', on) }
  }, [el])
  return h
}
