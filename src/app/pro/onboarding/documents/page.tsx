"use client"
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { trackEvent } from '@/lib/tracking'
import OnboardingStep from '@/components/OnboardingStep'

const ICONS: Record<string, JSX.Element> = {
  identite: (
    <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#123644" strokeWidth="1.6"><rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="8" cy="12" r="2.2"/><path d="M13 10.5h6M13 13.5h4"/><path d="M5.5 16.5c.5-1.5 1.8-2.3 2.5-2.3s2 .8 2.5 2.3"/></svg>
  ),
  rcpro: (
    <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#123644" strokeWidth="1.6"><path d="M12 2l8 4v5c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z"/><path d="M9 12l2 2 4-4"/></svg>
  ),
  kbis: (
    <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#123644" strokeWidth="1.6"><path d="M4 4h10l6 6v10H4z"/><path d="M14 4v6h6"/><path d="M8 13h8M8 16.5h5"/></svg>
  ),
}

const DOC_TYPES: { key: 'identite' | 'rcpro' | 'kbis'; label: string; question: string }[] = [
  { key: 'identite', label: "Pièce d'identité", question: 'Avez-vous une pièce d\u2019identité à télécharger ?' },
  { key: 'rcpro', label: 'Assurance RC Pro', question: 'Avez-vous une assurance en cours de validité ?' },
  { key: 'kbis', label: 'Justificatif de statut', question: 'Avez-vous un justificatif SIRET ou Kbis ?' },
]

export default function ProDocuments() {
  const router = useRouter()
  const [stepIndex, setStepIndex] = useState(0)
  const [uploaded, setUploaded] = useState<Record<string, string>>({})
  const [uploading, setUploading] = useState(false)
  const [ready, setReady] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setReady(true); return }
      const { data } = await supabase.from('documents').select('kind, storage_path').eq('owner_id', user.id)
      const map: Record<string, string> = {}
      ;(data ?? []).forEach((d: any) => { map[d.kind] = d.storage_path?.split('/').pop() || 'Déposé' })
      setUploaded(map)
      setReady(true)
    })
  }, [])

  const doc = DOC_TYPES[stepIndex]
  const isLast = stepIndex === DOC_TYPES.length - 1

  if (!ready) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#123644' }}>
        <div style={{ color: '#fff', fontFamily: 'Quicksand, sans-serif', fontSize: 16 }}>Chargement…</div>
      </div>
    )
  }

  async function handleFile(file: File) {
    setUploading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setUploading(false); return }

    const ext = file.name.split('.').pop()
    const path = `${user.id}/${doc.key}-${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage.from('documents').upload(path, file, { upsert: true })

    if (!upErr) {
      await supabase.from('documents').upsert({
        owner_id: user.id, kind: doc.key, storage_path: path, status: 'pending',
      }, { onConflict: 'owner_id,kind' })
      setUploaded(u => ({ ...u, [doc.key]: file.name }))
      trackEvent('document_uploaded', { kind: doc.key })
    }
    setUploading(false)
  }

  function goNext() {
    if (isLast) router.push('/pro/attente')
    else setStepIndex(i => i + 1)
  }

  return (
    <OnboardingStep
      step={stepIndex}
      total={DOC_TYPES.length}
      title={doc.question}
      subtitle="PDF, JPG ou PNG, 10 Mo maximum. Visible uniquement par vous et l'équipe PING. Ça n'empêche pas d'être visible sur la carte."
      onBack={stepIndex > 0 ? () => setStepIndex(i => i - 1) : undefined}
      onSkip={goNext}
      skipLabel="Passer, je le ferai plus tard"
      onCta={goNext}
      ctaLabel={uploaded[doc.key] ? (isLast ? 'Terminer' : 'Continuer') : 'Continuer sans ce document'}
      ctaLoading={uploading}
    >
      <input ref={inputRef} type="file" style={{ display: 'none' }} accept=".pdf,.jpg,.jpeg,.png"
        onChange={e => { if (e.target.files?.[0]) { handleFile(e.target.files[0]); e.target.value = '' } }} />

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 10 }}>
        <div style={{
          width: 92, height: 92, borderRadius: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 40, marginBottom: 22,
          background: uploaded[doc.key] ? 'rgba(18,179,156,.12)' : '#F3F6F5',
          border: uploaded[doc.key] ? '2px solid #12B39C' : '2px solid #E7EDEB',
        }}>
          {uploaded[doc.key] ? <span style={{ color: '#12B39C', fontSize: 32 }}>✓</span> : ICONS[doc.key]}
        </div>

        {uploaded[doc.key] ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#123644' }}>{uploaded[doc.key]}</div>
            <div style={{ fontSize: 12, color: '#0C8F7E', fontWeight: 600, marginTop: 4 }}>Déposé — en attente de vérification</div>
            <button onClick={() => inputRef.current?.click()} style={{ marginTop: 14, background: 'none', border: 'none', color: '#6E8592', fontSize: 12.5, fontWeight: 700, textDecoration: 'underline' }}>
              Remplacer le fichier
            </button>
          </div>
        ) : (
          <button onClick={() => inputRef.current?.click()} disabled={uploading}
            style={{ padding: '13px 26px', borderRadius: 999, border: 'none', background: '#123644', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14 }}>
            {uploading ? 'Envoi…' : 'Télécharger le document'}
          </button>
        )}
      </div>
    </OnboardingStep>
  )
}
