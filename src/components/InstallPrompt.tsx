"use client"
import { useEffect, useState } from 'react'
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
    try { if (localStorage.getItem(KEY)) return } catch { /* ignore */ }
    let off = false
    createClient().auth.getSession().then(({ data }) => {
      if (!off && data.session) setTimeout(() => !off && setShow(true), 1500)
    })
    return () => { off = true }
  }, [path])

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
      ? ['Touchez le bouton « Installer » ci-dessous.', 'Si rien ne s’affiche : menu du navigateur (trois points), puis « Installer l’application » ou « Ajouter à l’écran d’accueil ».']
      : ['Dans la barre d’adresse de Chrome, cliquez sur l’icône d’installation à droite.', 'Ou menu (trois points), « Enregistrer et partager », « Installer PING ».']

  return (
    <>
    <style>{`.ping-install{bottom:calc(76px + env(safe-area-inset-bottom,0px))}@media(min-width:1000px){.ping-install{bottom:12px}}`}</style>
    <div role="dialog" aria-label="Installer le raccourci PING" className="ping-install" style={{ position: 'fixed', left: 0, right: 0, zIndex: 9999, display: 'flex', justifyContent: 'center', padding: 12, pointerEvents: 'none' }}>
      <div style={{ pointerEvents: 'auto', width: '100%', maxWidth: 420, background: '#fff', borderRadius: 20, padding: 18, boxShadow: '0 10px 40px rgba(18,54,68,.25)', border: '1px solid #E7EDEB', fontFamily: 'Inter, sans-serif', color: '#123644' }}>
        <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 20, marginBottom: 6 }}>Installer le raccourci PING sur votre écran</div>
        <p style={{ fontSize: 14, color: '#4E6470', margin: '0 0 12px' }}>En quelques secondes, plus rapide que le téléchargement d&apos;une application.</p>
        <ol style={{ fontSize: 14, margin: '0 0 16px', paddingLeft: 20, lineHeight: 1.5 }}>
          {steps.map(s => <li key={s}>{s}</li>)}
        </ol>
        {bip && platform !== 'ios' && (
          <button onClick={install} style={{ width: '100%', padding: 13, border: 0, borderRadius: 14, background: '#12B39C', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer', marginBottom: 8 }}>Installer</button>
        )}
        <button onClick={close} style={{ width: '100%', padding: 12, border: '1.5px solid #E7EDEB', borderRadius: 14, background: '#fff', color: '#123644', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Plus tard</button>
        <button onClick={close} style={{ width: '100%', padding: 10, marginTop: 6, border: 0, background: 'transparent', color: '#4E6470', fontWeight: 600, fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}>C’est déjà installé, ne plus afficher</button>
      </div>
    </div>
    </>
  )
}
