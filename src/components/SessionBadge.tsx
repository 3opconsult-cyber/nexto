"use client"
import { useEffect, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { createClient } from '@/lib/supabase/client'
import { sessionUserId } from '@/lib/screenCache'
import { useMode, type Mode } from '@/lib/mode'
import Modal from '@/components/Modal'

// Pastille de session (24/11) : « Prestataire » (teal) ou « Particulier » (navy), seulement quand le compte a les
// deux espaces. Un appui l'explique et ouvre le MENU, où se fait la bascule (règle : la bascule reste uniquement
// dans le menu ; cette pastille ne change jamais d'espace elle-même).
// `space` : espace de l'écran affiché (carte du prestataire = pro) ; par défaut le mode de src/lib/mode.ts (`ping_mode`).

let hasProCache: { uid: string; v: boolean } | null = null

export default function SessionBadge({ space, style, onDark = false }: { space?: Mode; style?: CSSProperties; onDark?: boolean }) {
  const [hasPro, setHasPro] = useState<boolean | null>(null)
  const [open, setOpen] = useState(false)
  const [mode] = useMode(hasPro)
  useEffect(() => {
    let off = false
    const sb = createClient()
    sessionUserId(sb).then(async uid => {
      if (off || !uid) return
      if (hasProCache?.uid === uid) { setHasPro(hasProCache.v); return }
      const { data } = await sb.from('provider_profiles').select('id').eq('id', uid).maybeSingle()
      hasProCache = { uid, v: !!data }
      if (!off) setHasPro(!!data)
    })
    return () => { off = true }
  }, [])
  const shown: Mode | null = hasPro ? (space ?? mode) : null
  if (!shown) return null
  const pro = shown === 'pro'
  const label = pro ? 'Prestataire' : 'Particulier'
  const other = pro ? 'Particulier' : 'Prestataire'

  function openMenu() {
    setOpen(false)
    // Le menu est celui de la page (bouton « Menu ») : on l'ouvre, on ne bascule rien ici.
    setTimeout(() => { (document.querySelector('button.app-burger[aria-label="Menu"]') as HTMLButtonElement | null)?.click() }, 60)
  }

  return (
    <>
      <button type="button" data-session-badge={shown} onClick={() => setOpen(true)} aria-label={`Session ${label}. Appuyez pour comprendre comment changer d’espace.`}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 44, padding: '0 16px', borderRadius: 999,
          border: onDark && !pro ? '1.5px solid rgba(255,255,255,.5)' : 'none',
          background: pro ? '#0B8374' : '#123644', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15,
          lineHeight: 1, cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 4px 12px rgba(18,54,68,.22)', ...style,
        }}>
        <span aria-hidden style={{ width: 9, height: 9, borderRadius: 999, background: pro ? '#F2A93B' : '#12B39C', flex: '0 0 auto' }} />
        {label}
      </button>
      {open && typeof document !== 'undefined' && createPortal(<Modal open={open} onClose={() => setOpen(false)} title={`Vous êtes dans votre espace ${label.toLowerCase()}`}
        footer={<>
          <button type="button" onClick={openMenu} data-session-open-menu
            style={{ minHeight: 52, border: 'none', borderRadius: 14, background: '#0B8374', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 17, cursor: 'pointer' }}>Ouvrir le menu</button>
          <button type="button" onClick={() => setOpen(false)}
            style={{ minHeight: 48, border: 'none', borderRadius: 14, background: '#F0F4F3', color: '#123644', fontWeight: 700, fontSize: 16, cursor: 'pointer', fontFamily: 'inherit' }}>Fermer</button>
        </>}>
        <p style={{ fontSize: 16, lineHeight: 1.55, margin: '4px 0 16px', color: '#123644' }}>
          Votre compte a deux espaces : <b>Particulier</b> (vous réservez) et <b>Prestataire</b> (vous proposez vos services). Ici, vous êtes en <b>{label}</b>.
        </p>
        <p style={{ fontSize: 16, lineHeight: 1.55, margin: '0 0 16px', color: '#4E6470' }}>
          Pour passer en {other}, ouvrez le menu : le changement d’espace se fait uniquement là.
        </p>
      </Modal>, document.body)}
    </>
  )
}
