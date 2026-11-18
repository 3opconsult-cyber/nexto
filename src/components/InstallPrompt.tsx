"use client"
import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const KEY = 'ping_install_dismissed'
const PAGES = ['/map', '/client', '/pro/carte', '/pro/dashboard', '/agenda', '/messages']

type BIP = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

// Fenêtre « Installer le raccourci PING » : montrée aux utilisateurs connectés, une fois (fermable).
export default function InstallPrompt() {
  const path = usePathname()
  const [show, setShow] = useState(false)
  const [bip, setBip] = useState<BIP | null>(null)
  const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop'>('desktop')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    try {
      if (localStorage.getItem(KEY)) return
      const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone
      if (standalone) return
    } catch { /* ignore */ }
    const ua = navigator.userAgent
    setPlatform(/iphone|ipad|ipod/i.test(ua) ? 'ios' : /android/i.test(ua) ? 'android' : 'desktop')
    const onBip = (e: Event) => { e.preventDefault(); setBip(e as BIP) }
    window.addEventListener('beforeinstallprompt', onBip)
    return () => window.removeEventListener('beforeinstallprompt', onBip)
  }, [])

  useEffect(() => {
    if (!PAGES.some(p => path === p || path.startsWith(p + '/'))) { setShow(false); return }
    try {
      if (localStorage.getItem(KEY)) return
      // Application deja installee (ouverte depuis sa vignette) : jamais d'invite.
      if (window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone) return
    } catch { /* ignore */ }
    let off = false
    createClient().auth.getSession().then(({ data }) => {
      if (!off && data.session) setTimeout(() => !off && setShow(true), 1500)
    })
    return () => { off = true }
  }, [path])

  // Hauteur du bandeau publiée en --ping-install-lift : les cartes posent leur volet et leurs
  // boutons au-dessus, la bulle verte aussi (rien n'est recouvert tant qu'il est affiché).
  const boxRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const root = document.documentElement
    const el = boxRef.current
    if (!show || !el) { root.style.removeProperty('--ping-install-lift'); return }
    const on = () => root.style.setProperty('--ping-install-lift', `${Math.ceil(el.offsetHeight) + 16}px`)
    on()
    const ro = new ResizeObserver(on)
    ro.observe(el)
    return () => { ro.disconnect(); root.style.removeProperty('--ping-install-lift') }
  }, [show])

  function close() { try { localStorage.setItem(KEY, '1') } catch { /* ignore */ } setShow(false) }
  async function install() {
    if (!bip) return
    await bip.prompt()
    close()
  }
  if (!show) return null

  const steps = platform === 'ios'
    ? ['Ouvrez PING dans Safari.', 'Touchez le bouton Partager (le carré avec une flèche vers le haut).', 'Choisissez « Sur l’écran d’accueil », puis « Ajouter ».']
    : platform === 'android'
      ? ['Touchez le bouton « Installer ».', 'Si rien ne s’affiche : menu du navigateur (trois points), puis « Installer l’application » ou « Ajouter à l’écran d’accueil ».']
      : ['Dans la barre d’adresse de Chrome, cliquez sur l’icône d’installation à droite.', 'Ou menu (trois points), « Enregistrer et partager », « Installer PING ».']
  const canInstall = !!bip && platform !== 'ios'

  // Bandeau compact posé au-dessus de la barre d'onglets : il ne couvre plus l'écran, la page
  // reste utilisable dessous (pas de fond, pas de modale). Les étapes se déplient à la demande.
  return (
    <>
    <style>{`.ping-install{bottom:calc(72px + env(safe-area-inset-bottom,0px))}@media(min-width:1000px){.ping-install{bottom:12px}}`}</style>
    <div role="region" aria-label="Installer le raccourci PING" className="ping-install" style={{ position: 'fixed', left: 0, right: 0, zIndex: 9999, display: 'flex', justifyContent: 'center', padding: '0 10px', pointerEvents: 'none' }}>
      <div ref={boxRef} style={{ pointerEvents: 'auto', width: '100%', maxWidth: 440, background: '#fff', borderRadius: 14, padding: '9px 8px 9px 12px', boxShadow: '0 6px 22px rgba(18,54,68,.18)', border: '1px solid #E7EDEB', fontFamily: 'Inter, sans-serif', color: '#123644' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
            <rect x="6" y="2.5" width="12" height="19" rx="2.5" stroke="#12B39C" strokeWidth="1.8" />
            <path d="M12 7.5v7m0 0-3-3m3 3 3-3" stroke="#12B39C" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14, lineHeight: 1.25 }}>Installer le raccourci PING</div>
            <button onClick={() => setOpen(o => !o)} aria-expanded={open} style={{ border: 0, background: 'transparent', padding: 0, color: '#0C8F7E', fontWeight: 600, fontSize: 12.5, cursor: 'pointer' }}>
              {open ? 'Masquer les étapes' : 'Comment faire'}
            </button>
          </div>
          {canInstall && (
            <button onClick={install} style={{ flexShrink: 0, padding: '8px 13px', border: 0, borderRadius: 999, background: '#0C8F7E', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Installer</button>
          )}
          <button onClick={close} aria-label="Plus tard" title="Plus tard" style={{ flexShrink: 0, width: 34, height: 34, border: 0, borderRadius: '50%', background: '#F3F6F5', color: '#4E6470', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
          </button>
        </div>
        {open && (
          <ol style={{ fontSize: 13, margin: '8px 4px 2px 0', paddingLeft: 20, lineHeight: 1.45, color: '#4E6470' }}>
            {steps.map(s => <li key={s}>{s}</li>)}
          </ol>
        )}
        <button onClick={close} style={{ display: 'block', padding: '4px 0 0', border: 0, background: 'transparent', color: '#4E6470', fontWeight: 600, fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>C’est déjà installé, ne plus afficher</button>
      </div>
    </div>
    </>
  )
}
