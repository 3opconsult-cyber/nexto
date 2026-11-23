"use client"
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ProviderNearby } from '@/lib/services'
import { Ic, Stars, r1 } from './PingIcons'
import DayTimePicker, { firstFreeTime } from './DayTimePicker'
import '../app/aere.css'

/**
 * « Trouver un prestataire » : parcours en feuille de la carte du particulier, pensé comme un réflexe.
 * 1. De quoi avez-vous besoin ? (trois grosses tuiles ; un appui suffit ; « Plusieurs services » = multi-choix)
 * 2. Quand ? (« Dès que possible » présélectionné ; « Voir les prestataires » sans rien toucher d'autre)
 * 3. Le meilleur choix : UNE carte, UN bouton « Réserver » ; « Voir les autres » ouvre la liste.
 * « Réserver » mène à la réservation existante (/mission/new), préremplie avec le service et le moment.
 * Rien n'est créé ici : aucun prix, aucune règle de réservation n'est calculé dans cette feuille ; le prix affiché
 * est celui de la fiche du prestataire, le même que sur la carte. Adresse du client : jamais montrée (distance seule).
 */
export type FindService = { key: string; label: string; icon: string }
type When = 'asap' | 'today' | 'date'
type Step = 'need' | 'when' | 'result' | 'list'

const C = { navy: '#123644', teal: '#0C8F7E', tealBright: '#12B39C', line: '#DCE5E3', slate: '#4E6470', soft: '#F3F6F5' }
const pad = (n: number) => String(n).padStart(2, '0')
const hm = (v: string) => (v ? v.split('T')[1] : '')
const distLabel = (m: number) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1).replace('.', ',')} km`)
export const priceOf = (p: ProviderNearby, trade: string | null) => {
  // Le prix de la fiche vaut pour le métier principal du prestataire ; pour un autre service, il est annoncé sur l'écran de réservation.
  if (trade && p.trade !== trade) return ''
  if (p.pricing_type === 'devis') return 'Sur devis'
  if (p.base_price_cents > 0) return `${Math.round(p.base_price_cents / 100)} €`
  if (p.hourly_rate_cents) return `${Math.round(p.hourly_rate_cents / 100)} €/h`
  return ''
}

/** Le meilleur choix : parmi les 3 plus proches disponibles maintenant, le mieux noté (à note égale, le plus proche). */
export function bestOf(list: ProviderNearby[]): ProviderNearby | null {
  const near = [...list].filter(p => p.is_active).sort((a, b) => a.distance_m - b.distance_m).slice(0, 3)
  if (!near.length) return null
  return near.reduce((best, p) => ((p.rating || 0) > (best.rating || 0) ? p : best), near[0])
}

export default function FindSheet({ open, onClose, services, pros, acts, newIds, onReserve, onDeposit, embedded = false }: {
  open: boolean
  /** Bureau (>= 1000 px) : le parcours est posé dans le panneau latéral, à côté de la carte, au lieu d'une feuille qui la recouvre. */
  embedded?: boolean
  onClose: () => void
  services: FindService[]
  pros: ProviderNearby[]
  acts: Record<string, string[]>
  newIds: Set<string>
  /** Va à la réservation préremplie. */
  onReserve: (p: ProviderNearby, o: { trades: string[]; labels: string[]; when: string }) => void
  onDeposit: () => void
}) {
  const [step, setStep] = useState<Step>('need')
  const [multi, setMulti] = useState(false)
  const [sel, setSel] = useState<string[]>([])
  const [when, setWhen] = useState<When>('asap')
  const [dateVal, setDateVal] = useState('')
  const boxRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  // Chaque ouverture repart de la première étape (le dernier choix de service n'est pas retenu : un réflexe, pas un formulaire).
  useEffect(() => {
    if (!open) return
    setStep('need'); setMulti(false); setSel([]); setWhen('asap'); setDateVal('')
    boxRef.current?.focus({ preventScroll: true })
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') closeRef.current() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [open])

  const firstAny = useMemo(() => firstFreeTime(8, 20, 21), [open]) // eslint-disable-line react-hooks/exhaustive-deps
  const firstToday = useMemo(() => {
    const v = firstFreeTime(8, 20, 1)
    return v
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  const isToday = (v: string) => { const d = new Date(); return v.startsWith(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`) }
  // Valeur envoyée à la réservation (« AAAA-MM-JJTHH:MM », même format que le sélecteur de la réservation).
  const whenValue = when === 'asap' ? firstAny : when === 'today' ? (dateVal && isToday(dateVal) ? dateVal : firstToday) : dateVal
  const asapTxt = firstAny ? (isToday(firstAny) ? `Aujourd’hui à partir de ${hm(firstAny).replace(':', ' h ').replace(' h 00', ' h')}` : 'Demain matin') : ''

  const labels = sel.map(k => services.find(s => s.key === k)?.label || k)
  // Prestataires qui font TOUS les services choisis ; à défaut (multi-choix), ceux qui en font au moins un.
  const { cands, partial } = useMemo(() => {
    const does = (p: ProviderNearby) => acts[p.id] || (p.trade ? [p.trade] : [])
    const all = pros.filter(p => sel.every(k => does(p).includes(k)))
    if (all.length || sel.length < 2) return { cands: all, partial: false }
    return { cands: pros.filter(p => sel.some(k => does(p).includes(k))), partial: true }
  }, [pros, acts, sel])
  const online = cands.filter(p => p.is_active).sort((a, b) => a.distance_m - b.distance_m)
  const best = bestOf(online)
  const others = online.filter(p => p.id !== best?.id).slice(0, 8)

  function pick(k: string) {
    if (multi) { setSel(s => (s.includes(k) ? s.filter(x => x !== k) : [...s, k])); return }
    setSel([k]); setStep('when')
  }
  function reserve(p: ProviderNearby) {
    const does = acts[p.id] || (p.trade ? [p.trade] : [])
    const trades = sel.filter(k => does.includes(k))
    onReserve(p, { trades: trades.length ? trades : sel, labels, when: whenValue })
  }

  if (!open) return null
  const back: Record<Step, Step | null> = { need: null, when: 'need', result: 'when', list: 'result' }
  const iconBtn: React.CSSProperties = { width: 44, height: 44, border: 0, background: 'none', color: C.navy, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', borderRadius: 12 }
  const bigBtn: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', minHeight: 56, border: 0, borderRadius: 16, background: C.teal, color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 17, cursor: 'pointer', boxShadow: '0 8px 20px rgba(12,143,126,.28)' }
  const ghostBtn: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', minHeight: 52, border: `1.5px solid ${C.line}`, borderRadius: 16, background: '#fff', color: C.navy, fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 16, cursor: 'pointer' }
  const title = step === 'need' ? 'De quoi avez-vous besoin ?' : step === 'when' ? 'Quand ?' : step === 'result' ? 'Le meilleur choix pour vous' : 'Les autres prestataires'

  const whenOpt = (v: When, label: string, sub: string, disabled = false) => (
    <button key={v} type="button" role="radio" aria-checked={when === v} disabled={disabled}
      onClick={() => { setWhen(v); if (v === 'today') setDateVal(firstToday); if (v === 'date' && !dateVal) setDateVal(firstAny) }}
      style={{ display: 'flex', alignItems: 'center', gap: 16, width: '100%', minHeight: 72, padding: '14px 0', textAlign: 'left', cursor: disabled ? 'default' : 'pointer', fontFamily: 'inherit',
        border: 0, borderTop: v === 'asap' ? 0 : `1px solid ${C.line}`, background: 'none', opacity: disabled ? .6 : 1 }}>
      <span aria-hidden="true" style={{ width: 24, height: 24, borderRadius: '50%', border: `2px solid ${when === v ? C.teal : '#9FB3AE'}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
        {when === v && <span style={{ width: 12, height: 12, borderRadius: '50%', background: C.teal }} />}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <b style={{ display: 'block', fontFamily: 'Quicksand, sans-serif', fontSize: 18, lineHeight: 1.4, color: C.navy }}>{label}</b>
        {sub && <small style={{ display: 'block', fontSize: 15, lineHeight: 1.5, color: C.slate, marginTop: 2 }}>{sub}</small>}
      </span>
    </button>
  )

  const proCard = (p: ProviderNearby, big: boolean) => {
    const nm = (p.full_name || '').trim() || 'Prestataire'
    const price = priceOf(p, sel.length === 1 ? sel[0] : null)
    const isNew = newIds.has(p.id)
    return (
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <span aria-hidden="true" style={{ width: big ? 56 : 48, height: big ? 56 : 46, borderRadius: 16, background: 'linear-gradient(160deg,#12B39C,#0C8F7E)', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: big ? 22 : 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>{nm.charAt(0).toUpperCase()}</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <b style={{ display: 'block', fontFamily: 'Quicksand, sans-serif', fontSize: big ? 20 : 17, color: C.navy, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nm}</b>
          <small style={{ display: 'block', fontSize: 15, lineHeight: 1.6, color: C.slate, marginTop: 2 }}>
            {p.rating > 0 ? <><Stars r={p.rating} /> {r1(p.rating)} ({p.reviews_count || 0})</> : <b style={{ color: '#8A6520' }}>Nouveau</b>}
            {' · '}<span style={{ whiteSpace: 'nowrap' }}>à {distLabel(p.distance_m)}</span>
          </small>
          {isNew && <small style={{ display: 'block', fontSize: 15, lineHeight: 1.5, color: '#6F4F12', fontWeight: 600, marginTop: 4 }}>Nouveau · pièces en cours de contrôle</small>}
        </span>
        {price && <b style={{ fontFamily: 'Quicksand, sans-serif', fontSize: big ? 20 : 17, color: C.navy, whiteSpace: 'nowrap' }}>{price}</b>}
      </div>
    )
  }
  const bestDevis = best?.pricing_type === 'devis'
  const bestPrice = best ? priceOf(best, sel.length === 1 ? sel[0] : null) : ''

  const boxStyle: React.CSSProperties = embedded
    ? { outline: 'none', width: '100%', height: '100%', background: '#fff', padding: '8px 20px 24px', overflowY: 'auto', boxSizing: 'border-box' }
    : { outline: 'none', width: '100%', maxWidth: 520, background: '#fff', borderRadius: '22px 22px 0 0', padding: '8px 20px calc(24px + env(safe-area-inset-bottom))', maxHeight: '92vh', overflowY: 'auto', boxSizing: 'border-box' }
  const wrapStyle: React.CSSProperties = embedded
    ? { height: '100%' }
    : { position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(18,54,68,.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }

  return (
    <div role={embedded ? 'region' : 'dialog'} aria-modal={embedded ? undefined : true} aria-label="Trouver un prestataire" data-find-sheet={step} data-find-embedded={embedded ? '' : undefined}
      onClick={embedded ? undefined : e => { e.stopPropagation(); if (e.target === e.currentTarget) onClose() }}
      style={wrapStyle}>
      <div ref={boxRef} tabIndex={-1} className="aere a-lift" style={boxStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginLeft: -8, marginRight: -8 }}>
          {back[step] ? <button type="button" style={iconBtn} aria-label="Retour" onClick={() => setStep(back[step] as Step)}><Ic name="back" size={20} /></button> : <span style={{ width: 8 }} />}
          <h2 style={{ flex: 1, margin: 0, fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 22, lineHeight: 1.5, color: C.navy }}>{title}</h2>
          <button type="button" style={iconBtn} aria-label="Fermer" onClick={onClose}><Ic name="close" size={20} /></button>
        </div>

        {step === 'need' && (
          <>
            <div role="group" aria-label="Services" style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(3, Math.max(1, services.length))}, 1fr)`, gap: 12, margin: '24px 0 20px' }}>
              {services.map(s => {
                const on = sel.includes(s.key)
                return (
                  <button key={s.key} type="button" aria-pressed={multi ? on : undefined} onClick={() => pick(s.key)}
                    style={{ minHeight: 112, padding: '10px 4px', borderRadius: 18, cursor: 'pointer', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 16, color: C.navy,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10,
                      border: on ? `2px solid ${C.tealBright}` : `2px solid ${C.line}`, background: on ? 'rgba(18,179,156,.09)' : '#fff' }}>
                    <span aria-hidden="true" style={{ width: 52, height: 52, borderRadius: 16, background: on ? C.tealBright : 'rgba(18,179,156,.12)', color: on ? '#fff' : C.teal, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Ic name={s.icon} size={30} /></span>
                    {s.label}
                  </button>
                )
              })}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, minHeight: 48 }}>
              <span style={{ fontSize: 16, color: C.slate, fontWeight: 600 }}>Plusieurs services</span>
              <button type="button" role="switch" aria-checked={multi} aria-label="Plusieurs services" onClick={() => { setMulti(m => !m); setSel([]) }}
                style={{ width: 60, minHeight: 44, border: 0, background: 'none', padding: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                <span style={{ width: 48, height: 28, borderRadius: 999, background: multi ? C.tealBright : '#B9C7C4', position: 'relative', transition: 'background .15s' }}>
                  <span style={{ position: 'absolute', top: 3, left: multi ? 23 : 3, width: 22, height: 22, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,.3)', transition: 'left .15s' }} />
                </span>
              </button>
            </div>
            {multi && (
              <button type="button" style={{ ...bigBtn, marginTop: 6, opacity: sel.length ? 1 : .5 }} disabled={!sel.length} onClick={() => setStep('when')}>Continuer</button>
            )}
          </>
        )}

        {step === 'when' && (
          <>
            <div>
            <p style={{ margin: '16px 0 12px', fontSize: 16, color: C.slate }}>{labels.join(' + ')}</p>
            <div role="radiogroup" aria-label="Moment" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {whenOpt('asap', 'Dès que possible', asapTxt)}
              {whenOpt('today', 'Aujourd’hui', firstToday ? 'Choisissez l’heure' : 'Plus d’horaire libre aujourd’hui', !firstToday)}
              {whenOpt('date', 'Choisir une date', dateVal && when === 'date' ? '' : 'Jour et heure')}
            </div>
            {(when === 'today' || when === 'date') && (
              <div style={{ marginTop: 16 }}>
                <DayTimePicker value={whenValue} onChange={v => setDateVal(v)} days={when === 'today' ? 1 : 21} />
              </div>
            )}
            </div>
            <div>
            <button type="button" style={{ ...bigBtn, marginTop: 24, opacity: whenValue ? 1 : .5 }} disabled={!whenValue} onClick={() => setStep('result')}>Voir les prestataires</button>
            </div>
          </>
        )}

        {step === 'result' && (
          <>
            {best ? (
              <>
                <div>
                <p style={{ margin: '10px 0 16px', fontSize: 16, lineHeight: 1.5, color: C.slate }}>
                  {labels.join(' + ')}{whenValue ? ` · ${when === 'asap' ? 'dès que possible' : new Date(whenValue).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}` : ''}
                </p>
                <div style={{ borderRadius: 20, padding: 20, background: 'rgba(18,179,156,.08)' }}>
                  {proCard(best, true)}
                  {partial && <p style={{ margin: '12px 0 0', fontSize: 15, lineHeight: 1.5, color: '#6F4F12', fontWeight: 600 }}>Ne fait pas tout : l’écran suivant précise le service réservé.</p>}
                </div>
                </div>
                <div>
                <button type="button" data-find-reserve style={{ ...bigBtn, marginTop: 20 }} onClick={() => reserve(best)}>{bestDevis ? 'Demander un devis' : `Réserver${bestPrice ? ` · ${bestPrice}` : ''}`}</button>
                {others.length > 0 && <button type="button" style={{ ...ghostBtn, marginTop: 12 }} onClick={() => setStep('list')}>Voir les autres ({others.length})</button>}
                <button type="button" onClick={onDeposit} style={{ display: 'block', width: '100%', minHeight: 52, marginTop: 16, border: 0, background: 'none', color: '#097A6C', fontWeight: 700, fontSize: 16, cursor: 'pointer', fontFamily: 'inherit' }}>Déposer une demande à la place</button>
                </div>
              </>
            ) : (
              <>
                <p style={{ margin: '20px 0 20px', fontSize: 16, color: C.navy, lineHeight: 1.6 }}>Personne n’est en ligne pour ce choix près de vous pour le moment. Déposez une demande : les prestataires proches la verront.</p>
                <button type="button" style={bigBtn} onClick={onDeposit}>Déposer une demande</button>
              </>
            )}
          </>
        )}

        {step === 'list' && (
          <div style={{ marginTop: 6 }}>
            {others.map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 0', borderBottom: `1px solid ${C.line}` }}>
                <div style={{ flex: 1, minWidth: 0 }}>{proCard(p, false)}</div>
                <button type="button" onClick={() => reserve(p)} style={{ minHeight: 48, padding: '0 18px', border: 0, borderRadius: 14, background: C.teal, color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 16, cursor: 'pointer', flex: '0 0 auto' }}>{p.pricing_type === 'devis' ? 'Devis' : 'Réserver'}</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
