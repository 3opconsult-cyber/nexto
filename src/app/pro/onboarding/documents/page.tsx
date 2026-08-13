"use client"
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { trackEvent } from '@/lib/tracking'

const DOC_TYPES: { key: 'identite' | 'rcpro' | 'kbis'; label: string; desc: string; required: boolean }[] = [
  { key: 'identite', label: "Pièce d'identité", desc: 'Carte d\'identité ou passeport', required: true },
  { key: 'rcpro', label: 'Assurance responsabilité civile', desc: 'Attestation en cours de validité', required: true },
  { key: 'kbis', label: 'Justificatif de statut', desc: 'SIRET, Kbis ou attestation auto-entrepreneur', required: false },
]

export default function ProDocuments() {
  const router = useRouter()
  const [uploads, setUploads] = useState<Record<string, string>>({})
  const [uploading, setUploading] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [currentDoc, setCurrentDoc] = useState<string | null>(null)

  async function handleUpload(docType: string, file: File) {
    setUploading(docType)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const ext = file.name.split('.').pop()
    const path = `${user.id}/${docType}-${Date.now()}.${ext}`

    const { error: upErr } = await supabase.storage.from('documents').upload(path, file, { upsert: true })

    if (!upErr) {
      await supabase.from('documents').upsert({
        owner_id: user.id, kind: docType, storage_path: path, status: 'pending',
      }, { onConflict: 'owner_id,kind' })
      setUploads(u => ({ ...u, [docType]: file.name }))
      trackEvent('document_uploaded', { kind: docType })
    }
    setUploading(null)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#123644' }}>
      <div style={{ padding: '32px 20px 16px' }}>
        <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 22, color: '#fff', marginBottom: 4 }}>Documents</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,.55)' }}>Dépôt libre, à votre rythme — n'empêche pas d'être visible</div>
      </div>

      <div style={{ flex: 1, background: '#fff', borderRadius: '24px 24px 0 0', padding: '24px 20px', minHeight: 'calc(100vh - 100px)' }}>
        <input ref={inputRef} type="file" style={{ display: 'none' }} accept=".pdf,.jpg,.jpeg,.png"
          onChange={e => {
            if (e.target.files?.[0] && currentDoc) { handleUpload(currentDoc, e.target.files[0]); e.target.value = '' }
          }}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 22 }}>
          {DOC_TYPES.map(doc => {
            const uploaded = uploads[doc.key]
            const isUploading = uploading === doc.key
            return (
              <div key={doc.key} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16,
                border: uploaded ? '2px solid #12B39C' : '2px solid #E7EDEB',
                background: uploaded ? 'rgba(18,179,156,.06)' : '#fff',
              }}>
                <div style={{ width: 38, height: 38, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0, background: uploaded ? 'rgba(18,179,156,.14)' : '#F3F6F5' }}>
                  {uploaded ? '✓' : '📄'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13.5, color: '#123644' }}>{doc.label}</div>
                  <div style={{ fontSize: 11.5, color: '#6E8592', marginTop: 2 }}>{uploaded || doc.desc}</div>
                </div>
                {doc.required && !uploaded && (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 99, background: '#FDE8E4', color: '#C0503A', flexShrink: 0 }}>Requis</span>
                )}
                <button onClick={() => { setCurrentDoc(doc.key); inputRef.current?.click() }} disabled={isUploading}
                  style={{ padding: '8px 12px', borderRadius: 10, fontSize: 11.5, fontWeight: 700, border: 'none', flexShrink: 0, background: uploaded ? 'rgba(18,179,156,.14)' : '#F3F6F5', color: uploaded ? '#0C8F7E' : '#123644' }}>
                  {isUploading ? '...' : uploaded ? 'Remplacer' : 'Ajouter'}
                </button>
              </div>
            )
          })}
        </div>

        <div style={{ padding: 14, borderRadius: 14, marginBottom: 22, background: '#FFF7ED', border: '1px solid #F2A93B' }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: '#8a6520' }}>
            PDF, JPG ou PNG, 10 Mo maximum par fichier. Stockage privé — visible uniquement par vous et l'équipe PING.
          </div>
        </div>

        <button onClick={() => router.push('/pro/attente')} style={{ width: '100%', padding: 15, borderRadius: 999, border: 'none', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15, background: '#12B39C' }}>
          Terminer →
        </button>
        <button onClick={() => router.push('/map')} style={{ width: '100%', padding: 12, textAlign: 'center', fontSize: 12.5, fontWeight: 700, color: '#6E8592', background: 'none', border: 'none', marginTop: 4 }}>
          Plus tard — voir mon profil sur la carte
        </button>
      </div>
    </div>
  )
}
