"use client"
import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Validation d'arrivée quand le client n'est pas sur place : le prestataire
 * prend une photo horodatée et sa position GPS est capturée. La preuve est
 * postée dans la conversation et disponible en cas de litige. L'arrivée est
 * enregistrée exactement comme un scan de QR.
 */
export default function ArrivalProof({ txId, onDone }: { txId: string; onDone: (t: any) => void }) {
  const [busy, setBusy] = useState<'' | 'gps' | 'upload'>('')
  const coordsRef = useRef<{ lat: number; lng: number } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function start() {
    if (!navigator.geolocation) { fileRef.current?.click(); return }
    setBusy('gps')
    navigator.geolocation.getCurrentPosition(
      p => { coordsRef.current = { lat: p.coords.latitude, lng: p.coords.longitude }; setBusy(''); fileRef.current?.click() },
      () => { coordsRef.current = null; setBusy(''); alert('Activez la localisation : elle sert de preuve de votre présence sur place.') },
      { enableHighAccuracy: true, timeout: 8000 },
    )
  }

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy('upload')
    const supabase = createClient()
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const path = `${txId}/arrival-${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage.from('offer-photos').upload(path, file)
    const now = new Date()
    const c = coordsRef.current
    const { data } = await supabase.from('transactions')
      .update({ arrived_at: now.toISOString(), status: 'arrived' }).eq('id', txId).select().single()
    await supabase.from('messages').insert({
      transaction_id: txId, sender_id: null,
      photo_path: upErr ? null : path,
      body: `✓ Arrivée validée sur place à ${now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} — photo horodatée${c ? ` · GPS ${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}` : ''}`,
    })
    if (data) onDone(data)
    setBusy('')
    e.target.value = ''
  }

  return (
    <div style={{ marginTop: 10 }}>
      <button onClick={start} disabled={!!busy} style={{
        width: '100%', border: '1px solid rgba(255,255,255,.25)', borderRadius: 999, padding: '9px 0',
        cursor: busy ? 'default' : 'pointer', background: 'transparent', color: '#fff',
        fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 12.5,
      }}>
        {busy === 'gps' ? 'Localisation…' : busy === 'upload' ? 'Enregistrement…' : 'Client absent ? Valider mon arrivée (photo + GPS)'}
      </button>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={onPhoto} />
    </div>
  )
}
