"use client"
import { useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { Ic } from './PingIcons'
import { geocodeAddress } from '@/lib/geocode'
import { readPositionOnce, saveLocationChoice, accuracyText, type Point } from '@/lib/location'
import { geoMessage, APPROX_ACCURACY_M, type GeoFail } from '@/lib/position'

// Encart affiché AVANT la fenêtre de localisation du navigateur (qc-production B2) :
// pourquoi PING demande la position, ce qu'il n'en fait pas, et une issue sans GPS (choisir une ville).

const CITIES: { label: string; lat: number; lng: number }[] = [
  { label: 'Nice', lat: 43.7102, lng: 7.262 },
  { label: 'Cannes', lat: 43.5528, lng: 7.0174 },
  { label: 'Antibes', lat: 43.5808, lng: 7.1251 },
  { label: 'Grasse', lat: 43.6584, lng: 6.9225 },
  { label: 'Cagnes-sur-Mer', lat: 43.6644, lng: 7.1489 },
  { label: 'Menton', lat: 43.7747, lng: 7.4975 },
  { label: 'Fréjus', lat: 43.4331, lng: 6.7370 },
]

type LocateResult = { ok: true; accuracyM: number } | { ok: false; reason: GeoFail }

/**
 * « Utiliser ma position » dans la feuille de la carte (24/11) : un relevé précis unique (jamais de suivi), la précision
 * affichée telle quelle (« ±40 m »), ou « Position approximative » avec où réactiver « Position précise » sur le téléphone.
 */
export function MyPositionRow({ onLocate, initialAccuracyM = null }: { onLocate: () => Promise<LocateResult>; initialAccuracyM?: number | null }) {
  const [busy, setBusy] = useState(false)
  const [res, setRes] = useState<LocateResult | null>(null)
  async function go() {
    setBusy(true); setRes(null)
    const r = await onLocate()
    setBusy(false); setRes(r)
  }
  const acc = res ? (res.ok === true ? res.accuracyM : null) : initialAccuracyM
  const approx = acc != null && acc > APPROX_ACCURACY_M
  return (
    <div data-my-position style={{ margin: '0 0 24px' }}>
      <button type="button" onClick={go} disabled={busy} data-use-position
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, width: '100%', minHeight: 52, border: 'none', borderRadius: 14, background: '#E8F6F3', color: '#0B8374', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 16, cursor: busy ? 'wait' : 'pointer' }}>
        <Ic name="loc" size={20} />{busy ? 'Localisation en cours…' : res && res.ok !== true ? 'Réessayer ma position' : 'Utiliser ma position'}
      </button>
      {res && res.ok !== true && (
        <p role="alert" style={{ margin: '12px 0 0', fontSize: 15, lineHeight: 1.5, color: '#B3402F', whiteSpace: 'pre-line' }}>{geoMessage(res.reason)}</p>
      )}
      {acc != null && !approx && (
        <p role="status" data-position-precision style={{ margin: '12px 0 0', fontSize: 15, lineHeight: 1.5, color: '#123644' }}>Position trouvée ({accuracyText(acc)}). Un seul relevé, jamais suivie ni partagée.</p>
      )}
      {acc != null && approx && (
        <div role="status" data-position-precision style={{ margin: '12px 0 0', fontSize: 15, lineHeight: 1.5, color: '#123644' }}>
          <b>Position approximative ({accuracyText(acc)}) : activez Position précise dans Réglages.</b>
          <span style={{ display: 'block', marginTop: 6, color: '#4E6470' }}>iPhone : Réglages, Confidentialité et sécurité, Service de localisation, votre navigateur (Safari…), puis « Position précise ».</span>
          <span style={{ display: 'block', marginTop: 6, color: '#4E6470' }}>Android (Chrome) : Paramètres, Position, « Utiliser la position précise ». Puis touchez « Utiliser ma position ».</span>
        </div>
      )}
      {acc == null && !res && <p style={{ margin: '10px 0 0', fontSize: 15, lineHeight: 1.5, color: '#4E6470' }}>Un seul relevé, jamais suivie ni partagée.</p>}
    </div>
  )
}

export const LOCATION_WHY ='Pour vous montrer ce qui est près de vous, PING a besoin de votre position (jamais suivie, jamais partagée).'

export default function LocationAsk({ onChoose, onClose, overlay = true, modal = false, allowCity = true, title = 'Où êtes-vous ?', text = LOCATION_WHY, gpsLabel = 'Utiliser ma position', remember = true }: {
  onChoose: (p: Point, label?: string) => void
  onClose?: () => void
  overlay?: boolean
  /** Fenêtre bloquante (fond grisé). Par défaut, encart flottant non bloquant en haut de l'écran
   *  (audit ergonomie 18/11) : la carte et « Déposer une demande », en bas, restent utilisables. */
  modal?: boolean
  /** « Choisir une ville » : faux quand la position sert à placer une annonce (une ville ne doit
   *  jamais déplacer l'annonce du client, seulement le centre d'une carte). */
  allowCity?: boolean
  title?: string
  text?: string
  gpsLabel?: string
  /** Retenir le choix sur l'appareil (cartes). Faux pour un usage ponctuel (formulaire). */
  remember?: boolean
}) {
  const [cityMode, setCityMode] = useState(false)
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function useGps() {
    setBusy(true); setErr('')
    try {
      const p = await readPositionOnce()
      if (remember) saveLocationChoice({ kind: 'gps' })
      onChoose(p)
    } catch (e: any) { setErr(e?.message || 'Position indisponible.'); setCityMode(true) }
    setBusy(false)
  }
  function pick(c: { label: string; lat: number; lng: number }) {
    if (remember) saveLocationChoice({ kind: 'city', ...c })
    onChoose({ lat: c.lat, lng: c.lng }, c.label)
  }
  async function searchCity() {
    const label = q.trim()
    if (label.length < 2) { setErr('Indiquez une ville.'); return }
    setBusy(true); setErr('')
    const g = await geocodeAddress(label)
    setBusy(false)
    if (!g) { setErr('Ville introuvable. Essayez avec le code postal.'); return }
    pick({ label, ...g })
  }

  const card: CSSProperties = {
    background: '#fff', border: '1px solid var(--line, #E7EDEB)', borderRadius: 18, padding: 18,
    boxShadow: overlay ? '0 18px 50px rgba(18,54,68,.22)' : 'none', width: '100%', maxWidth: 400, pointerEvents: 'auto',
    fontFamily: "var(--fb, 'Inter', system-ui, sans-serif)", color: 'var(--ink, #123644)', position: 'relative',
  }
  const btn: CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', minHeight: 46,
    borderRadius: 14, fontFamily: "var(--fh, 'Quicksand', system-ui, sans-serif)", fontWeight: 700, fontSize: 15,
    cursor: busy ? 'wait' : 'pointer', border: 'none',
  }
  const body = (
    <div style={card} role={modal ? 'dialog' : 'region'} aria-modal={(overlay && modal) || undefined} aria-labelledby="loc-ask-t">
      {onClose && (
        <button type="button" onClick={onClose} aria-label={modal ? 'Fermer' : 'Plus tard'}
          style={{ position: 'absolute', top: 4, right: 4, width: 44, height: 44, border: 'none', background: 'transparent', color: '#4E6470', cursor: 'pointer', fontSize: 18 }}>✕</button>
      )}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', paddingRight: onClose ? 34 : 0 }}>
        <span style={{ flex: '0 0 auto', width: 40, height: 40, borderRadius: 12, background: 'rgba(18,179,156,.12)', color: 'var(--tealD, #0B8374)', display: 'grid', placeItems: 'center' }}>
          <Ic name="loc" size={22} />
        </span>
        <div>
          <div id="loc-ask-t" style={{ fontFamily: "var(--fh, 'Quicksand', system-ui, sans-serif)", fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{title}</div>
          <p style={{ fontSize: 13.5, lineHeight: 1.45, color: '#4E6470', margin: 0 }}>{text}</p>
        </div>
      </div>

      {!cityMode || !allowCity ? (
        <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>
          <button type="button" onClick={useGps} disabled={busy} style={{ ...btn, background: 'var(--btnFill, #0B8374)', color: '#fff' }}>
            <Ic name="loc" size={18} /> {busy ? 'Localisation…' : gpsLabel}
          </button>
          {allowCity ? (
            <button type="button" onClick={() => { setCityMode(true); setErr('') }} disabled={busy}
              style={{ ...btn, background: '#fff', color: 'var(--ink, #123644)', border: '1.5px solid var(--line, #E7EDEB)' }}>
              Choisir une ville
            </button>
          ) : onClose && (
            <button type="button" onClick={onClose} disabled={busy}
              style={{ ...btn, background: '#fff', color: 'var(--ink, #123644)', border: '1.5px solid var(--line, #E7EDEB)' }}>
              Corriger l&apos;adresse
            </button>
          )}
        </div>
      ) : (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {CITIES.map(c => (
              <button key={c.label} type="button" onClick={() => pick(c)}
                style={{ background: '#fff', border: '1px solid var(--line, #E7EDEB)', borderRadius: 999, padding: '0 14px', minHeight: 40, fontSize: 13, fontWeight: 600, color: 'var(--ink, #123644)', cursor: 'pointer' }}>
                {c.label}
              </button>
            ))}
          </div>
          <form onSubmit={e => { e.preventDefault(); searchCity() }} style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Autre ville ou code postal" aria-label="Ville ou code postal"
              style={{ flex: 1, minWidth: 0, minHeight: 44, border: '1.5px solid var(--line, #E7EDEB)', borderRadius: 12, padding: '0 12px', fontSize: 15, color: 'var(--ink, #123644)' }} />
            <button type="submit" disabled={busy} style={{ ...btn, width: 'auto', padding: '0 16px', background: 'var(--btnFill, #0B8374)', color: '#fff' }}>
              {busy ? '…' : 'OK'}
            </button>
          </form>
          <button type="button" onClick={useGps} disabled={busy}
            style={{ marginTop: 6, background: 'none', border: 'none', color: 'var(--tealD, #0B8374)', fontWeight: 600, fontSize: 13.5, cursor: 'pointer', padding: 0, minHeight: 44 }}>
            {gpsLabel} plutôt
          </button>
        </div>
      )}
      {err && <p role="alert" style={{ marginTop: 10, fontSize: 13, color: 'var(--danger, #B3402F)', lineHeight: 1.4 }}>{err}</p>}
    </div>
  )
  if (!overlay) return body
  // Portail vers <body> : un ancêtre transformé (coque de la carte) casserait position:fixed.
  if (modal) return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(18,54,68,.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      {body}
    </div>,
    document.body,
  )
  // Encart non bloquant, posé sous la barre du haut et les puces de la carte : pas de fond, le reste
  // de l'écran (carte, volet, « Déposer une demande » en bas) reste touchable.
  return createPortal(
    <div style={{ position: 'fixed', left: 0, right: 0, top: 'calc(env(safe-area-inset-top, 0px) + 176px)', zIndex: 1300, display: 'flex', justifyContent: 'center', padding: '0 12px', pointerEvents: 'none' }}>
      {body}
    </div>,
    document.body,
  )
}
