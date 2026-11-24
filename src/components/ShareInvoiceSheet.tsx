"use client"
import { useEffect, useState } from 'react'
import { downloadBlob, mailtoUrl, whatsappUrl, smsUrl, shareFiles } from '@/lib/invoiceShare'

/**
 * Transmettre une ou plusieurs factures. Sur téléphone, « Partager » ouvre la feuille de partage du
 * système (WhatsApp, SMS, e-mail… avec le PDF joint). Sinon : le PDF est téléchargé et le message
 * pré-rempli s'ouvre dans l'application choisie, il ne reste qu'à joindre le fichier.
 *
 * 24/11/2026 (remarques de Romain) : « Envoyer à mon comptable » toujours proposé, adresse mémorisée sur
 * l'appareil seulement ; « Copier le lien » quand un lien existe. Le texte envoyé (dans l'URL wa.me ou
 * mailto) ne contient jamais de téléphone ni d'adresse : seulement titre, numéro, montant et lien.
 * Utilisé par : src/app/documents/page.tsx, src/components/FacturesList.tsx, src/app/mission/[id]/facture/page.tsx.
 */
const ACCOUNTANT_KEY = 'ping_comptable_email'

const I = {
  share: <><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" /></>,
  down: <><path d="M12 3v12M7 10l5 5 5-5" /><path d="M5 21h14" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></>,
  acc: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 7h8M8 11h2M12 11h2M16 11h0M8 15h2M12 15h2M8 18h8" /></>,
  wa: <><path d="M21 12a9 9 0 0 1-13.4 7.9L3 21l1.2-4.4A9 9 0 1 1 21 12z" /><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-1 1c-1-.5-1.5-1-2-2l1-1-1-2L9 9.5z" /></>,
  sms: <><path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /><path d="M8 9h8M8 13h5" /></>,
  csv: <><path d="M6 2h9l3 3v17H6z" /><path d="M9 10h6M9 14h6M9 18h4" /></>,
  link: <><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>,
}
const Ico = ({ d }: { d: JSX.Element }) => (
  <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>{d}</svg>
)
const okEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())

export default function ShareInvoiceSheet({ open, onClose, title, subject, text, getFiles, csv, accountant = false, link }: {
  open: boolean; onClose: () => void
  title: string; subject: string; text: string
  getFiles: () => Promise<File[]>
  csv?: () => { blob: Blob; name: string }
  /** Ouvre directement la saisie de l'adresse du comptable (envoi d'un mois entier). */
  accountant?: boolean
  /** Lien PING du document (copié par « Copier le lien »). */
  link?: string
}) {
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')
  const [email, setEmail] = useState('')
  const [askAcc, setAskAcc] = useState(false)
  const [done, setDone] = useState('')

  useEffect(() => {
    if (!open) return
    setErr(''); setDone(''); setBusy('')
    let saved = ''
    try { saved = localStorage.getItem(ACCOUNTANT_KEY) || '' } catch { }
    setEmail(saved); setAskAcc(accountant && !okEmail(saved))
  }, [open, accountant])

  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [open, onClose])

  if (!open) return null

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key); setErr(''); setDone('')
    try { await fn() } catch { setErr('Le document n’a pas pu être préparé. Réessayez.') }
    setBusy('')
  }
  async function downloadAll() {
    const files = await getFiles()
    for (let i = 0; i < files.length; i++) { if (i) await new Promise(r => setTimeout(r, 400)); downloadBlob(files[i], files[i].name) }
    if (csv) { const c = csv(); downloadBlob(c.blob, c.name) }
    return files.length
  }
  const nativeShare = () => run('share', async () => {
    const files = await getFiles()
    const all = csv ? [...files, new File([csv().blob], csv().name, { type: 'text/csv' })] : files
    const r = await shareFiles(all, subject, text)
    if (r === 'unsupported') setErr('Partage direct indisponible sur cet appareil : utilisez une option ci-dessous.')
    if (r === 'shared') setDone('Envoyé.')
  })
  const via = (key: string, url: () => string) => run(key, async () => {
    const n = await downloadAll()
    window.location.href = url()
    setDone(`${n > 1 ? `${n} PDF téléchargés` : 'PDF téléchargé'}${csv ? ' + récapitulatif' : ''} : joignez-${n > 1 ? 'les' : 'le'} au message.`)
  })
  function saveEmail(v: string) { setEmail(v); try { localStorage.setItem(ACCOUNTANT_KEY, v.trim()) } catch { } }
  function toAccountant() {
    if (!okEmail(email)) { setAskAcc(true); setErr(email ? 'Adresse e-mail du comptable à vérifier.' : ''); return }
    via('acc', () => mailtoUrl(email.trim(), subject, text))
  }
  async function copyLink() {
    if (!link) return
    setErr(''); setDone('')
    try { await navigator.clipboard.writeText(link); setDone('Lien copié. Il ne s’ouvre que pour les personnes connectées à la mission.') }
    catch { setDone(`Lien : ${link}`) }
  }

  const canNative = typeof navigator !== 'undefined' && !!(navigator as any).canShare
  const row = (key: string, icon: JSX.Element, label: string, sub: string, onClick: () => void) => (
    <button key={key} type="button" onClick={onClick} disabled={!!busy}
      style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', minHeight: 60, textAlign: 'left', padding: '12px 16px', marginBottom: 10, borderRadius: 14, border: 'none', background: '#fff', cursor: busy ? 'default' : 'pointer', color: '#123644', opacity: busy && busy !== key ? .5 : 1, fontFamily: 'inherit' }}>
      <span style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(18,179,156,.1)', color: '#0B8374', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Ico d={icon} /></span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontWeight: 700, fontSize: 16 }}>{busy === key ? 'Préparation…' : label}</span>
        <span style={{ display: 'block', fontSize: 15, color: '#4E6470', marginTop: 2, overflowWrap: 'anywhere' }}>{sub}</span>
      </span>
    </button>
  )

  return (
    <div onClick={onClose} role="presentation" style={{ position: 'fixed', inset: 0, background: 'rgba(18,54,68,.4)', display: 'flex', justifyContent: 'center', alignItems: 'flex-end', zIndex: 3100 }}>
      <div onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}
        style={{ background: '#F3F6F5', width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', borderRadius: '20px 20px 0 0', padding: '22px 20px calc(22px + env(safe-area-inset-bottom, 0px))', fontFamily: 'Inter, sans-serif' }}>
        <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 18, color: '#123644' }}>{title}</div>
        <p style={{ fontSize: 15, color: '#4E6470', margin: '6px 0 20px', lineHeight: 1.55, overflowWrap: 'anywhere' }}>{text}</p>

        {canNative && row('share', I.share, 'Partager', 'WhatsApp, e-mail, SMS… avec le PDF joint', nativeShare)}
        {row('mail', I.mail, 'E-mail', 'Message pré-rempli, PDF téléchargé pour être joint',
          () => via('mail', () => mailtoUrl('', subject, text)))}
        {row('wa', I.wa, 'WhatsApp', 'Message pré-rempli avec le lien du document', () => via('wa', () => whatsappUrl(text)))}
        {row('acc', I.acc, 'Envoyer à mon comptable', okEmail(email) ? `À ${email.trim()}` : 'Adresse à saisir une fois, mémorisée sur cet appareil', toAccountant)}
        {askAcc && (
          <label style={{ display: 'block', margin: '0 0 16px' }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#123644' }}>E-mail de mon comptable</span>
            <input type="email" inputMode="email" autoComplete="email" value={email} onChange={e => saveEmail(e.target.value)}
              style={{ width: '100%', minHeight: 48, marginTop: 8, padding: '11px 13px', borderRadius: 12, border: '1px solid #DCE5E3', fontSize: 16, boxSizing: 'border-box', background: '#fff' }} />
            <span style={{ display: 'block', fontSize: 15, color: '#4E6470', marginTop: 6 }}>Mémorisée sur cet appareil uniquement.</span>
          </label>
        )}
        {row('sms', I.sms, 'SMS', 'Message pré-rempli', () => via('sms', () => smsUrl(text)))}
        {link && row('link', I.link, 'Copier le lien', 'Lien PING du document, sans coordonnées', copyLink)}
        {row('down', I.down, csv ? 'Tout télécharger' : 'Télécharger le PDF', csv ? 'Les PDF du mois et le récapitulatif (CSV)' : 'Pour l’archiver ou l’envoyer vous-même',
          () => run('down', async () => { const n = await downloadAll(); setDone(`${n} document${n > 1 ? 's' : ''} téléchargé${n > 1 ? 's' : ''}.`) }))}
        {csv && row('csv', I.csv, 'Récapitulatif seul (CSV)', 'Ouvrable dans Excel ou votre logiciel comptable',
          () => { const c = csv(); downloadBlob(c.blob, c.name); setDone('Récapitulatif téléchargé.') })}

        {err && <p role="alert" style={{ color: '#B2432E', fontSize: 15, fontWeight: 600, margin: '6px 0 0' }}>{err}</p>}
        {done && <p role="status" style={{ color: '#0B8374', fontSize: 15, fontWeight: 600, margin: '6px 0 0', overflowWrap: 'anywhere' }}>{done}</p>}
        <button type="button" onClick={onClose}
          style={{ width: '100%', minHeight: 52, marginTop: 14, padding: 12, borderRadius: 999, border: '1px solid #DCE5E3', background: '#fff', color: '#123644', fontWeight: 700, fontSize: 16, cursor: 'pointer' }}>Fermer</button>
      </div>
    </div>
  )
}
