"use client"
import { useEffect, useState } from 'react'
import { downloadBlob, mailtoUrl, whatsappUrl, smsUrl, shareFiles } from '@/lib/invoiceShare'

/**
 * Transmettre une ou plusieurs factures. Sur téléphone, « Partager » ouvre la feuille de partage du
 * système (WhatsApp, SMS, e-mail… avec le PDF joint). Sinon : le PDF est téléchargé et le message
 * pré-rempli s'ouvre dans l'application choisie, il ne reste qu'à joindre le fichier.
 */
const ACCOUNTANT_KEY = 'ping_comptable_email'

const I = {
  share: <><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" /></>,
  down: <><path d="M12 3v12M7 10l5 5 5-5" /><path d="M5 21h14" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></>,
  wa: <><path d="M21 12a9 9 0 0 1-13.4 7.9L3 21l1.2-4.4A9 9 0 1 1 21 12z" /><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-1 1c-1-.5-1.5-1-2-2l1-1-1-2L9 9.5z" /></>,
  sms: <><path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /><path d="M8 9h8M8 13h5" /></>,
  csv: <><path d="M6 2h9l3 3v17H6z" /><path d="M9 10h6M9 14h6M9 18h4" /></>,
}
const Ico = ({ d }: { d: JSX.Element }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>{d}</svg>
)

export default function ShareInvoiceSheet({ open, onClose, title, subject, text, getFiles, csv, accountant = false }: {
  open: boolean; onClose: () => void
  title: string; subject: string; text: string
  getFiles: () => Promise<File[]>
  csv?: () => { blob: Blob; name: string }
  accountant?: boolean
}) {
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')
  const [email, setEmail] = useState('')
  const [done, setDone] = useState('')

  useEffect(() => {
    if (!open) return
    setErr(''); setDone(''); setBusy('')
    try { setEmail(localStorage.getItem(ACCOUNTANT_KEY) || '') } catch { }
  }, [open])

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

  const canNative = typeof navigator !== 'undefined' && !!(navigator as any).canShare
  const row = (key: string, icon: JSX.Element, label: string, sub: string, onClick: () => void) => (
    <button key={key} type="button" onClick={onClick} disabled={!!busy}
      style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', padding: '12px 14px', marginBottom: 8, borderRadius: 13, border: '1px solid #E7EDEB', background: '#fff', cursor: busy ? 'default' : 'pointer', color: '#123644', opacity: busy && busy !== key ? .5 : 1 }}>
      <span style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(18,179,156,.1)', color: '#0C8F7E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Ico d={icon} /></span>
      <span style={{ flex: 1 }}>
        <span style={{ display: 'block', fontWeight: 700, fontSize: 13.5 }}>{busy === key ? 'Préparation…' : label}</span>
        <span style={{ display: 'block', fontSize: 11.5, color: '#4E6470', marginTop: 1 }}>{sub}</span>
      </span>
    </button>
  )

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(18,54,68,.4)', display: 'flex', justifyContent: 'center', alignItems: 'flex-end', zIndex: 2500 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#F3F6F5', width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', borderRadius: '20px 20px 0 0', padding: '18px 16px calc(18px + env(safe-area-inset-bottom, 0px))', fontFamily: 'Inter, sans-serif' }}>
        <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 16, color: '#123644' }}>{title}</div>
        <p style={{ fontSize: 12.5, color: '#4E6470', margin: '4px 0 14px', lineHeight: 1.5 }}>{text}</p>

        {accountant && (
          <label style={{ display: 'block', marginBottom: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#123644' }}>E-mail de mon comptable</span>
            <input type="email" value={email} onChange={e => saveEmail(e.target.value)} placeholder="cabinet@exemple.fr"
              style={{ width: '100%', marginTop: 6, padding: '11px 13px', borderRadius: 12, border: '1px solid #DCE5E3', fontSize: 14, boxSizing: 'border-box', background: '#fff' }} />
            <span style={{ display: 'block', fontSize: 11, color: '#4E6470', marginTop: 4 }}>Mémorisé sur cet appareil uniquement.</span>
          </label>
        )}

        {canNative && row('share', I.share, 'Partager', 'WhatsApp, SMS, e-mail… avec le document joint', nativeShare)}
        {row('mail', I.mail, accountant ? 'Envoyer à mon comptable' : 'E-mail', accountant && email ? `À ${email}` : 'Message pré-rempli, document téléchargé pour être joint',
          () => via('mail', () => mailtoUrl(accountant ? email.trim() : '', subject, text)))}
        {row('wa', I.wa, 'WhatsApp', 'Message pré-rempli', () => via('wa', () => whatsappUrl(text)))}
        {row('sms', I.sms, 'SMS', 'Message pré-rempli', () => via('sms', () => smsUrl(text)))}
        {row('down', I.down, csv ? 'Tout télécharger' : 'Télécharger le PDF', csv ? 'Les PDF du mois et le récapitulatif (CSV)' : 'Pour l’archiver ou l’envoyer vous-même',
          () => run('down', async () => { const n = await downloadAll(); setDone(`${n} document${n > 1 ? 's' : ''} téléchargé${n > 1 ? 's' : ''}.`) }))}
        {csv && row('csv', I.csv, 'Récapitulatif seul (CSV)', 'Ouvrable dans Excel ou votre logiciel comptable',
          () => { const c = csv(); downloadBlob(c.blob, c.name); setDone('Récapitulatif téléchargé.') })}

        {err && <p style={{ color: '#c0503a', fontSize: 12.5, fontWeight: 600, margin: '6px 0 0' }}>{err}</p>}
        {done && <p style={{ color: '#0C8F7E', fontSize: 12.5, fontWeight: 600, margin: '6px 0 0' }}>{done}</p>}
        <button type="button" onClick={onClose}
          style={{ width: '100%', marginTop: 10, padding: 12, borderRadius: 999, border: '1px solid #DCE5E3', background: '#fff', color: '#123644', fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }}>Fermer</button>
      </div>
    </div>
  )
}
