"use client"
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { trackEvent } from '@/lib/tracking'
import NavDrawer from '@/components/NavDrawer'
import { DOC_TYPES } from '@/lib/documents'

const ICONS: Record<string, JSX.Element> = {
  identite: (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#123644" strokeWidth="1.6"><rect x="2" y="5" width="20" height="14" rx="2" /><circle cx="8" cy="12" r="2.2" /><path d="M13 10.5h6M13 13.5h4" /><path d="M5.5 16.5c.5-1.5 1.8-2.3 2.5-2.3s2 .8 2.5 2.3" /></svg>
  ),
  rcpro: (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#123644" strokeWidth="1.6"><path d="M12 2l8 4v5c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z" /><path d="M9 12l2 2 4-4" /></svg>
  ),
  kbis: (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#123644" strokeWidth="1.6"><path d="M4 4h10l6 6v10H4z" /><path d="M14 4v6h6" /><path d="M8 13h8M8 16.5h5" /></svg>
  ),
  diplome: (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#123644" strokeWidth="1.6"><path d="M12 2l9 5-9 5-9-5 9-5z" /><path d="M6 10.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-5.5" /><path d="M21 8v6" /></svg>
  ),
}

type DocRow = { kind: string; status: 'pending' | 'valid' | 'expired' | 'rejected'; storage_path: string | null }

const STATUS_LABEL: Record<string, { label: string; bg: string; fg: string }> = {
  valid: { label: 'Validé', bg: 'rgba(18,179,156,.14)', fg: '#0C8F7E' },
  pending: { label: 'En attente de vérification', bg: 'rgba(242,169,59,.16)', fg: '#9A6712' },
  rejected: { label: 'Refusé — à redéposer', bg: 'rgba(255,122,102,.14)', fg: '#C2432F' },
  expired: { label: 'Expiré — à renouveler', bg: 'rgba(255,122,102,.14)', fg: '#C2432F' },
}

export default function ProDocumentsPage() {
  const router = useRouter()
  const [rows, setRows] = useState<Record<string, DocRow>>({})
  const [ready, setReady] = useState(false)
  const [uploadingKey, setUploadingKey] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const pendingKey = useRef<string | null>(null)

  async function load() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }
    const { data } = await supabase.from('documents').select('kind, status, storage_path').eq('owner_id', user.id)
    const map: Record<string, DocRow> = {}
    ;(data ?? []).forEach((d: any) => { map[d.kind] = d })
    setRows(map)
    setReady(true)
  }

  useEffect(() => { load() }, [])

  function pickFile(key: string) {
    pendingKey.current = key
    inputRef.current?.click()
  }

  async function handleFile(file: File) {
    const key = pendingKey.current
    if (!key) return
    setUploadingKey(key)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setUploadingKey(null); return }

    const ext = file.name.split('.').pop()
    const path = `${user.id}/${key}-${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage.from('documents').upload(path, file, { upsert: true })

    if (!upErr) {
      await supabase.from('documents').upsert({
        owner_id: user.id, kind: key, storage_path: path, status: 'pending',
      }, { onConflict: 'owner_id,kind' })
      trackEvent('document_uploaded', { kind: key })
      await load()
    }
    setUploadingKey(null)
  }

  if (!ready) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#123644' }}>
        <div style={{ color: '#fff', fontFamily: 'Quicksand, sans-serif', fontSize: 16 }}>Chargement…</div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#123644', fontFamily: 'Inter, sans-serif', paddingBottom: 40 }}>
      <input ref={inputRef} type="file" style={{ display: 'none' }} accept=".pdf,.jpg,.jpeg,.png"
        onChange={e => { if (e.target.files?.[0]) { handleFile(e.target.files[0]); e.target.value = '' } }} />

      <div style={{ padding: '16px 20px 0' }}><NavDrawer /></div>
      <div style={{ padding: '20px 20px 16px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'rgba(255,255,255,.45)', marginBottom: 4 }}>Espace prestataire</div>
        <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 22, color: '#fff' }}>Mes pièces</div>
        <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,.55)', marginTop: 6, maxWidth: '34ch' }}>
          Visibles uniquement par vous et l'équipe PING. Ne changent rien à votre présence sur la carte, sauf pour l'identité et l'assurance.
        </p>
      </div>

      <div style={{ background: '#F3F6F5', borderRadius: '20px 20px 0 0', padding: '20px 16px', minHeight: '60vh', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {DOC_TYPES.map(doc => {
          const row = rows[doc.key]
          const st = row ? STATUS_LABEL[row.status] : null
          const busy = uploadingKey === doc.key
          return (
            <div key={doc.key} style={{ background: '#fff', borderRadius: 16, padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 46, height: 46, borderRadius: 13, background: '#F3F6F5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {ICONS[doc.key]}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13.5, color: '#123644' }}>{doc.label}</div>
                {st ? (
                  <span style={{ display: 'inline-block', marginTop: 4, padding: '2px 9px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: st.bg, color: st.fg }}>{st.label}</span>
                ) : (
                  <div style={{ fontSize: 11.5, color: '#9CA3AF', fontWeight: 600, marginTop: 4 }}>
                    {doc.subtitle ? 'Non fourni — facultatif' : 'Non fourni'}
                  </div>
                )}
              </div>
              <button onClick={() => pickFile(doc.key)} disabled={busy}
                style={{ padding: '8px 13px', borderRadius: 999, border: 'none', background: row ? '#F3F6F5' : '#123644', color: row ? '#123644' : '#fff', fontSize: 11.5, fontWeight: 700, flexShrink: 0, whiteSpace: 'nowrap' }}>
                {busy ? 'Envoi…' : row ? 'Remplacer' : 'Ajouter'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
