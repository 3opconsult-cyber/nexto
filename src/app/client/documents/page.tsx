"use client"
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import NavDrawer from '@/components/NavDrawer'
import Modal from '@/components/Modal'

type DocRow = { status: 'pending' | 'valid' | 'expired' | 'rejected'; storage_path: string | null; created_at: string }

const STATUS_LABEL: Record<string, { label: string; bg: string; fg: string }> = {
  valid: { label: 'Validée', bg: 'rgba(18,179,156,.14)', fg: '#0C8F7E' },
  pending: { label: 'En attente de vérification', bg: 'rgba(242,169,59,.16)', fg: '#9A6712' },
  rejected: { label: 'Refusée — à redéposer', bg: 'rgba(255,122,102,.14)', fg: '#C2432F' },
  expired: { label: 'Expirée — à renouveler', bg: 'rgba(255,122,102,.14)', fg: '#C2432F' },
}

export default function ClientDocumentsPage() {
  const router = useRouter()
  const [row, setRow] = useState<DocRow | null>(null)
  const [ready, setReady] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [viewing, setViewing] = useState<{ url: string; isImage: boolean } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function load() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }
    const { data } = await supabase.from('documents').select('status, storage_path, created_at').eq('owner_id', user.id).eq('kind', 'identite').maybeSingle()
    setRow(data)
    setReady(true)
  }
  useEffect(() => { load() }, [])

  async function handleFile(file: File) {
    setUploading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setUploading(false); return }
    const ext = file.name.split('.').pop()
    const path = `${user.id}/identite-${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage.from('documents').upload(path, file, { upsert: true })
    if (!upErr) {
      await supabase.from('documents').upsert({ owner_id: user.id, kind: 'identite', storage_path: path, status: 'pending' }, { onConflict: 'owner_id,kind' })
      await load()
    }
    setUploading(false)
  }

  async function view() {
    if (!row?.storage_path) return
    const supabase = createClient()
    const { data, error } = await supabase.storage.from('documents').createSignedUrl(row.storage_path, 120)
    if (error || !data) return
    setViewing({ url: data.signedUrl, isImage: /\.(jpe?g|png|gif|webp)$/i.test(row.storage_path) })
  }

  if (!ready) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F3F6F5' }}>
        <div style={{ color: '#6E8592', fontFamily: 'Quicksand, sans-serif', fontSize: 15 }}>Chargement…</div>
      </div>
    )
  }

  const st = row ? STATUS_LABEL[row.status] : null

  return (
    <div style={{ minHeight: '100vh', background: '#F3F6F5', fontFamily: 'Inter, sans-serif', paddingBottom: 40 }}>
      <input ref={inputRef} type="file" style={{ display: 'none' }} accept=".pdf,.jpg,.jpeg,.png"
        onChange={e => { if (e.target.files?.[0]) { handleFile(e.target.files[0]); e.target.value = '' } }} />

      <div style={{ padding: '14px 16px', background: '#123644', display: 'flex', alignItems: 'center', gap: 12 }}>
        <NavDrawer />
        <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 17, color: '#fff' }}>Mes documents &amp; identité</span>
      </div>

      <div style={{ padding: 16, maxWidth: 560, margin: '0 auto' }}>
        <p style={{ fontSize: 12.5, color: '#6E8592', lineHeight: 1.5, marginBottom: 16 }}>
          Une pièce d&apos;identité renseignée rassure les prestataires que vous contactez. Visible
          uniquement par vous et l&apos;équipe PING — jamais par les prestataires.
        </p>

        <div style={{ background: '#fff', borderRadius: 16, padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div onClick={view} style={{ width: 46, height: 46, borderRadius: 13, background: '#F3F6F5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: row ? 'pointer' : 'default' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#123644" strokeWidth={1.6}><rect x="2" y="5" width="20" height="14" rx="2" /><circle cx="8" cy="12" r="2.2" /><path d="M13 10.5h6M13 13.5h4" /></svg>
          </div>
          <div onClick={view} style={{ flex: 1, minWidth: 0, cursor: row ? 'pointer' : 'default' }}>
            <div style={{ fontWeight: 700, fontSize: 13.5, color: '#123644' }}>Pièce d&apos;identité</div>
            {st ? (
              <span style={{ display: 'inline-block', marginTop: 4, padding: '2px 9px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: st.bg, color: st.fg }}>{st.label}</span>
            ) : (
              <div style={{ fontSize: 11.5, color: '#9CA3AF', fontWeight: 600, marginTop: 4 }}>Non fournie</div>
            )}
          </div>
          <button onClick={() => inputRef.current?.click()} disabled={uploading}
            style={{ padding: '8px 13px', borderRadius: 999, border: 'none', background: row ? '#F3F6F5' : '#123644', color: row ? '#123644' : '#fff', fontSize: 11.5, fontWeight: 700, flexShrink: 0 }}>
            {uploading ? 'Envoi…' : row ? 'Remplacer' : 'Ajouter'}
          </button>
        </div>
      </div>

      <Modal open={!!viewing} onClose={() => setViewing(null)} title="Pièce d'identité">
        {viewing && (
          <div>
            {viewing.isImage ? (
              <img src={viewing.url} alt="Document" style={{ width: '100%', borderRadius: 12, border: '1px solid #E7EDEB', display: 'block' }} />
            ) : (
              <iframe src={viewing.url} style={{ width: '100%', height: 420, border: '1px solid #E7EDEB', borderRadius: 12 }} />
            )}
            <a href={viewing.url} download target="_blank" rel="noreferrer"
              style={{ display: 'block', textAlign: 'center', marginTop: 14, padding: 13, borderRadius: 999, background: '#12B39C', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13.5, textDecoration: 'none' }}>
              Télécharger le document
            </a>
          </div>
        )}
      </Modal>
    </div>
  )
}
