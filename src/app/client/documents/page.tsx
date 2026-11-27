"use client"
import { notifyAdminDocument } from '@/lib/notify'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import NavDrawer from '@/components/NavDrawer'
import Modal from '@/components/Modal'
import DocCaptureSheet from '@/components/DocCaptureSheet'
import '../../aere.css'

type DocRow = { status: 'pending' | 'valid' | 'expired' | 'rejected'; storage_path: string | null; created_at: string; rejection_reason?: string | null }

const STATUS_LABEL: Record<string, { label: string; bg: string; fg: string }> = {
  valid: { label: 'Fournie', bg: 'rgba(18,179,156,.14)', fg: '#0B8374' },
  pending: { label: 'Reçue — en cours de traitement', bg: 'rgba(242,169,59,.16)', fg: '#8A6520' },
  rejected: { label: 'Refusée — à redéposer', bg: 'rgba(255,122,102,.14)', fg: '#9A3722' },
  expired: { label: 'Expirée — à renouveler', bg: 'rgba(255,122,102,.14)', fg: '#9A3722' },
}

export default function ClientDocumentsPage() {
  const router = useRouter()
  const [row, setRow] = useState<DocRow | null>(null)
  const [ready, setReady] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [err, setErr] = useState('')
  const [viewing, setViewing] = useState<{ url: string; isImage: boolean } | null>(null)
  const [capture, setCapture] = useState(false)

  async function load() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }
    // Motif de refus (migration 042) : relu sans cette colonne tant qu'elle n'existe pas.
    let { data, error } = await supabase.from('documents').select('status, storage_path, created_at, rejection_reason').eq('owner_id', user.id).eq('kind', 'identite').maybeSingle()
    if (error) ({ data } = await supabase.from('documents').select('status, storage_path, created_at').eq('owner_id', user.id).eq('kind', 'identite').maybeSingle())
    setRow(data)
    setReady(true)
  }
  useEffect(() => { load() }, [])

  async function handleFile(file: File) {
    setErr('')
    if (file.size > 10 * 1024 * 1024) { setErr('Fichier trop lourd : 10 Mo maximum.'); return }
    setUploading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setUploading(false); return }
    const ext = file.name.split('.').pop()
    const path = `${user.id}/identite-${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage.from('documents').upload(path, file, { upsert: true })
    if (upErr) {
      setErr('L’envoi du fichier a échoué. Vérifiez votre connexion et réessayez.')
    } else {
      const { error: dbErr } = await supabase.from('documents').upsert({ owner_id: user.id, kind: 'identite', storage_path: path, status: 'pending' }, { onConflict: 'owner_id,kind' })
      if (dbErr) setErr('Le fichier est envoyé mais n’a pas pu être enregistré. Réessayez.')
      else notifyAdminDocument()
      await load()
    }
    setUploading(false)
  }

  async function view() {
    if (!row?.storage_path) return
    const supabase = createClient()
    const { data, error } = await supabase.storage.from('documents').createSignedUrl(row.storage_path, 120)
    if (error || !data) { setErr('Le document ne peut pas être affiché pour le moment.'); return }
    setViewing({ url: data.signedUrl, isImage: /\.(jpe?g|png|gif|webp)$/i.test(row.storage_path) })
  }

  if (!ready) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F3F6F5' }}>
        <div style={{ color: '#4E6470', fontFamily: 'Quicksand, sans-serif', fontSize: 15 }}>Chargement…</div>
      </div>
    )
  }

  const st = row ? STATUS_LABEL[row.status] : null

  return (
    <div className="aere" style={{ minHeight: '100vh', background: '#fff', fontFamily: 'Inter, sans-serif', paddingBottom: 100 }}>
      <DocCaptureSheet open={capture} title="Pièce d'identité" accept=".pdf,.jpg,.jpeg,.png" onClose={() => setCapture(false)} onFile={f => handleFile(f)} />

      <div style={{ padding: '14px 20px', background: '#123644', display: 'flex', alignItems: 'center', gap: 14 }}>
        <NavDrawer />
        <span style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 20, color: '#fff' }}>Mes documents &amp; identité</span>
      </div>

      <div className="a-page" style={{ maxWidth: 560, margin: '0 auto' }}>
        {/* Une question : ma pièce d'identité est-elle fournie ? Un état, une action. */}
        <div className="a-block">
          <h1 className="a-title">Pièce d&apos;identité</h1>
          {st
            ? <span className="a-pill" style={{ background: st.bg, color: st.fg, alignSelf: 'flex-start' }}>{st.label}</span>
            : <p className="a-info" style={{ fontWeight: 600 }}>Non fournie</p>}
          <p className="a-info">
            Une pièce d&apos;identité renseignée rassure les prestataires que vous contactez. Visible
            uniquement par vous et l&apos;équipe PING — jamais par les prestataires.
          </p>
        </div>

        <div className="a-block">
          <button type="button" className={row ? 'a-btn sec' : 'a-btn'} onClick={() => setCapture(true)} disabled={uploading}>
            {uploading ? 'Envoi…' : row ? 'Remplacer' : 'Ajouter'}
          </button>
          {row && <button type="button" className="a-link" onClick={view}>Voir le document</button>}
        </div>

        {row?.status === 'rejected' && (
          <div className="a-block" role="status">
            <p className="a-info" style={{ color: '#9A3722', fontWeight: 600 }}>
              Refusée{row.rejection_reason ? ` : ${row.rejection_reason}` : ''}. Envoyez une nouvelle pièce : elle repart en contrôle.
            </p>
            <button type="button" className="a-btn" onClick={() => setCapture(true)} disabled={uploading}>Renvoyer une pièce</button>
          </div>
        )}
        {err && <p className="a-info" style={{ color: '#B3402F', fontWeight: 600 }}>{err}</p>}
        <p className="a-info" style={{ marginTop: 20 }}>PDF, JPG ou PNG · 10 Mo maximum.</p>
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
              style={{ display: 'block', textAlign: 'center', marginTop: 14, padding: 13, borderRadius: 999, background: '#0B8374', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13.5, textDecoration: 'none' }}>
              Télécharger le document
            </a>
          </div>
        )}
      </Modal>
    </div>
  )
}
