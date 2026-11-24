"use client"
import { useCallback, useState, type CSSProperties } from 'react'
import { createClient } from '@/lib/supabase/client'
import { canPublish, loadListingFacts } from '@/lib/listing'

// Interrupteur « Visible / Masqué » du prestataire (24/11) : bascule RÉELLEMENT provider_profiles.is_active, la colonne
// qui décide de l'apparition sur la carte des clients (providers_nearby). Mêmes garde-fous que /pro/annonce (setOnline)
// et que MonAnnonceCard : compte suspendu = jamais remis en ligne ; remise en ligne seulement avec un tarif et une
// position (canPublish) ; masquer = un appui, sans confirmation (réversible, rien n'est supprimé).

export function useVisibility({ proId, active, setActive, pro, suspended }: {
  proId: string | null; active: boolean; setActive: (v: boolean) => void; pro?: any; suspended?: boolean
}) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const toggle = useCallback(async () => {
    if (!proId || busy) return
    const next = !active
    setMsg('')
    const sb = createClient()
    if (next) {
      setBusy(true)
      try {
        // Ligne complète (tarif, position, suspension) : celle déjà chargée par la page, sinon une lecture.
        const row = pro ?? (await sb.from('provider_profiles').select('*').eq('id', proId).maybeSingle()).data
        if (suspended || row?.payments_suspended_at) { setBusy(false); setMsg('Votre compte est suspendu : vous ne pouvez pas être remis en ligne. Contactez le support PING.'); return }
        const r = await loadListingFacts(sb, proId, row || {})
        const { ok, missing } = canPublish(r.facts)
        if (!ok) { setBusy(false); setMsg(`Pour être visible, il manque : ${missing.join(' et ')}. Complétez-le dans Mon annonce.`); return }
      } catch { setBusy(false); setMsg('Vérification impossible pour le moment. Réessayez.'); return }
    }
    setBusy(true)
    const { error } = await sb.from('provider_profiles').update({ is_active: next }).eq('id', proId)
    setBusy(false)
    if (error) { setMsg(/suspendu/i.test(error.message) ? 'Compte suspendu : contactez le support PING pour le réactiver.' : 'Le changement n’a pas pu être enregistré. Réessayez dans un instant.'); return }
    setActive(next)
  }, [proId, busy, active, setActive, pro, suspended])
  return { toggle, busy, msg, clear: () => setMsg('') }
}

export const VISIBLE_TXT = 'Les clients vous voient'
export const HIDDEN_TXT = 'Vous êtes masqué'

/** Interrupteur très visible : mot d’état, texte d’état, curseur 52 x 30 dans une zone de toucher de 60 x 44. */
export default function VisibilitySwitch({ active, busy = false, onToggle, style, onDark = false }: {
  active: boolean; busy?: boolean; onToggle: () => void; style?: CSSProperties; onDark?: boolean
}) {
  const ink = onDark && !active ? '#fff' : '#123644'
  return (
    <button type="button" role="switch" aria-checked={active} data-visibility-switch={active ? 'visible' : 'masque'} disabled={busy}
      aria-label={active ? 'Visible : les clients vous voient. Appuyez pour vous masquer.' : 'Masqué : les clients ne vous voient pas. Appuyez pour être visible.'}
      onClick={onToggle}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, minHeight: 64, boxSizing: 'border-box', padding: '8px 12px 8px 18px', borderRadius: 999,
        border: active ? 'none' : onDark ? '1.5px solid rgba(255,255,255,.55)' : '1.5px solid #CBD7D4',
        background: active ? '#F2A93B' : onDark ? 'rgba(255,255,255,.1)' : '#fff', color: ink, textAlign: 'left',
        fontFamily: 'Quicksand, sans-serif', cursor: busy ? 'wait' : 'pointer', opacity: busy ? .75 : 1,
        boxShadow: onDark ? 'none' : '0 8px 20px rgba(20,50,60,.25)', ...style,
      }}>
      <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <b data-visibility-word style={{ fontSize: 17, lineHeight: 1.2, fontWeight: 700 }}>{active ? 'Visible' : 'Masqué'}</b>
        <span data-visibility-text style={{ fontSize: 15, lineHeight: 1.3, fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>{active ? VISIBLE_TXT : HIDDEN_TXT}</span>
      </span>
      <span aria-hidden style={{ width: 60, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
        <span style={{ width: 52, height: 30, borderRadius: 999, background: active ? 'rgba(255,255,255,.6)' : '#cdd6d3', position: 'relative', transition: 'background .2s' }}>
          <span style={{ position: 'absolute', top: 3, left: active ? 25 : 3, width: 24, height: 24, borderRadius: 999, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.25)', transition: 'left .2s' }} />
        </span>
      </span>
    </button>
  )
}
