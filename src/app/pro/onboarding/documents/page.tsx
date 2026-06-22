"use client"
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { DocumentType, DOCUMENT_LABELS } from '@/types'

export default function ProDocuments() {
  const router = useRouter()
  const [uploads, setUploads] = useState<Record<DocumentType, string>>({} as Record<DocumentType, string>)
  const [uploading, setUploading] = useState<DocumentType | null>(null)
  const [done, setDone] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const [currentDoc, setCurrentDoc] = useState<DocumentType | null>(null)

  async function handleUpload(docType: DocumentType, file: File) {
    setUploading(docType)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const ext = file.name.split('.').pop()
    const path = `pro-docs/${user.id}/${docType}-${Date.now()}.${ext}`

    const { error: upErr } = await supabase.storage
      .from('documents')
      .upload(path, file, { upsert: true })

    if (!upErr) {
      const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(path)
      const { data: pro } = await supabase.from('pro_profiles').select('id').eq('user_id', user.id).single()
      if (pro) {
        await supabase.from('pro_documents').upsert({
          pro_id: pro.id, doc_type: docType,
          file_url: publicUrl, file_name: file.name,
          status: 'pending'
        }, { onConflict: 'pro_id,doc_type' })
      }
      setUploads(u => ({ ...u, [docType]: file.name }))
    }
    setUploading(null)
  }

  const docTypes: DocumentType[] = ['id_card', 'kbis', 'rc_pro', 'decennale', 'urssaf', 'siret_cert', 'iban_cert']

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--navy)' }}>
      <div className="px-5 pt-8 pb-4">
        <div className="font-fredoka text-2xl text-white mb-1">Documents</div>
        <div className="text-sm font-bold" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Upload sécurisé · Vérification sous 24-48h
        </div>
      </div>

      <div className="flex-1 bg-white rounded-t-3xl px-5 py-6 overflow-y-auto">
        <input ref={inputRef} type="file" className="hidden"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={e => {
            if (e.target.files?.[0] && currentDoc) {
              handleUpload(currentDoc, e.target.files[0])
              e.target.value = ''
            }
          }}
        />

        <div className="space-y-3 mb-6">
          {docTypes.map(docType => {
            const doc = DOCUMENT_LABELS[docType]
            const uploaded = uploads[docType]
            const isUploading = uploading === docType
            return (
              <div key={docType}
                className="flex items-center gap-3 p-4 rounded-2xl border-2 transition-all"
                style={{ borderColor: uploaded ? '#22C55E' : '#F0EDE8', background: uploaded ? '#F0FFF4' : 'white' }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                  style={{ background: uploaded ? '#DCFCE7' : 'var(--accent-l)' }}>
                  {uploaded ? '✅' : '📄'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-black text-sm text-navy">{doc.label}</div>
                  <div className="text-xs text-gray-400 font-bold mt-0.5 truncate">
                    {uploaded ? uploaded : doc.description}
                  </div>
                </div>
                {doc.required && !uploaded && (
                  <span className="text-xs font-black px-2 py-1 rounded-full flex-shrink-0"
                    style={{ background: '#FEE2E2', color: '#B91C1C' }}>Requis</span>
                )}
                <button
                  onClick={() => { setCurrentDoc(docType); inputRef.current?.click() }}
                  disabled={isUploading}
                  className="px-3 py-2 rounded-xl text-xs font-black flex-shrink-0 transition-all"
                  style={{
                    background: uploaded ? '#DCFCE7' : 'var(--accent-l)',
                    color: uploaded ? '#15803D' : 'var(--accent-d)'
                  }}
                >
                  {isUploading ? '...' : uploaded ? 'Remplacer' : 'Uploader'}
                </button>
              </div>
            )
          })}
        </div>

        <div className="p-4 rounded-2xl mb-6" style={{ background: '#FFF7ED', border: '1px solid #FB923C' }}>
          <div className="text-xs font-black" style={{ color: '#C2410C' }}>
            Formats acceptés : PDF, JPG, PNG · Max 10 MB par fichier.
            Documents stockés de manière chiffrée. Accessibles uniquement à l'équipe Nexto sur demande justifiée.
          </div>
        </div>

        <button
          onClick={() => router.push('/pro/attente')}
          className="w-full py-4 rounded-full text-white font-fredoka text-lg"
          style={{ background: 'var(--accent)' }}
        >
          Soumettre mon dossier →
        </button>
        <button onClick={() => router.push('/pro/attente')}
          className="w-full py-3 text-center text-sm font-bold text-gray-400 mt-2">
          Passer pour l'instant (upload ultérieur)
        </button>
      </div>
    </div>
  )
}
