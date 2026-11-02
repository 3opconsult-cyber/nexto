"use client"
import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { systemSender } from '@/lib/systemMessage'
import { notifyOther } from '@/lib/notify'
import { requestArrivalCode, ARRIVAL_CODE_TTL_MIN } from '@/lib/arrival'

/**
 * Validation d'arrivée quand le client n'est pas sur place : le prestataire
 * prend une photo horodatée et sa position GPS est capturée. La preuve est
 * postée dans la conversation et disponible en cas de litige. L'arrivée est
 * enregistrée exactement comme un scan de QR.
 *
 * Second repli : « Le client n'est pas là » — position (consentement explicite) comparée à l'adresse,
 * puis code à 6 chiffres que le client lit dans l'application et vous communique (voir lib/arrival.ts).
 * Dans les deux cas, la position n'est relevée qu'une fois, après consentement, jamais suivie.
 */
export default function ArrivalProof({ txId, onDone }: { txId: string; onDone: (t: any) => void }) {
  const [busy, setBusy] = useState<'' | 'gps' | 'upload' | 'code'>('')
  const [consent, setConsent] = useState<'' | 'photo' | 'code'>('')
  const [codeStep, setCodeStep] = useState(false)
  const [code, setCode] = useState('')
  const [info, setInfo] = useState('')
  const coordsRef = useRef<{ lat: number; lng: number } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function start() {
    setConsent('')
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
    if (upErr) {
      setBusy(''); e.target.value = ''
      alert('La photo n\u2019a pas pu être envoyée — réessayez.')
      return
    }
    const now = new Date()
    const c = coordsRef.current
    // Jamais sur une mission annulée ou déjà commencée.
    let { data, error: txErr } = await supabase.from('transactions')
      .update({ arrived_at: now.toISOString(), status: 'arrived', arrival_method: 'photo_gps', arrival_lat: c?.lat ?? null, arrival_lng: c?.lng ?? null })
      .eq('id', txId).is('arrived_at', null).neq('status', 'cancelled').select().maybeSingle()
    if (txErr && /arrival_/.test(txErr.message)) {
      // Migration 033 pas encore appliquée : on enregistre l'arrivée sans la méthode.
      ;({ data, error: txErr } = await supabase.from('transactions')
        .update({ arrived_at: now.toISOString(), status: 'arrived' })
        .eq('id', txId).is('arrived_at', null).neq('status', 'cancelled').select().maybeSingle())
    }
    if (txErr || !data) {
      setBusy(''); e.target.value = ''
      alert('Arrivée non enregistrée : la mission est peut-être annulée ou déjà commencée.')
      return
    }
    await supabase.from('messages').insert({
      transaction_id: txId, ...(await systemSender(supabase)),
      photo_path: path,
      body: `✓ Arrivée validée sur place à ${now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} — photo horodatée${c ? ` · GPS ${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}` : ''}`,
    })
    onDone(data)
    setBusy('')
    e.target.value = ''
  }

  function getPosition(): Promise<{ lat: number; lng: number; accuracyM: number } | null> {
    return new Promise(resolve => {
      if (!navigator.geolocation) { resolve(null); return }
      navigator.geolocation.getCurrentPosition(
        p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracyM: p.coords.accuracy }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 10000 },
      )
    })
  }

  async function startCode() {
    setConsent(''); setInfo(''); setBusy('gps')
    const pos = await getPosition()
    if (!pos) { setBusy(''); setInfo('Position indisponible : activez la localisation, ou utilisez la photo ci-dessus.'); return }
    setBusy('code')
    const r = await requestArrivalCode(txId, pos)
    setBusy('')
    if (r.ok !== true) { const f = r as Extract<typeof r, { ok: false }>; setInfo(f.message); if (f.error === 'throttled') setCodeStep(true); return }
    notifyOther(txId, 'message')
    setCodeStep(true)
    setInfo((r as { geo: string }).geo === 'conforme'
      ? `Code envoyé au client dans l'application (valable ${ARRIVAL_CODE_TTL_MIN} min). Demandez-le-lui.`
      : `Code envoyé au client dans l'application (valable ${ARRIVAL_CODE_TTL_MIN} min). Votre position n'a pas pu être comparée à l'adresse : seul le code du client fait foi.`)
  }

  async function submitCode() {
    if (!/^\d{6}$/.test(code)) { setInfo('Le code comporte 6 chiffres.'); return }
    setBusy('code'); setInfo('')
    const supabase = createClient()
    const { data: r, error } = await supabase.rpc('arrive_with_code', { p_transaction: txId, p_code: code })
    if (error) { setBusy(''); setInfo(error.message); return }
    if (!r?.ok) {
      setBusy('')
      setInfo(r?.reason === 'bad_code' ? `Code incorrect. Il vous reste ${r.remaining} essai${r.remaining > 1 ? 's' : ''}.`
        : r?.reason === 'locked' ? 'Trop d\u2019essais : demandez un nouveau code.'
        : 'Code expiré ou absent : demandez un nouveau code.')
      return
    }
    const { data } = await supabase.from('transactions').select('*').eq('id', txId).maybeSingle()
    await supabase.from('messages').insert({
      transaction_id: txId, ...(await systemSender(supabase)),
      body: `✓ Arrivée validée à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} — client absent, code de confirmation saisi par le prestataire`,
    })
    setBusy('')
    if (data) onDone(data)
  }

  const btn: React.CSSProperties = {
    width: '100%', border: '1px solid rgba(255,255,255,.25)', borderRadius: 999, padding: '9px 0',
    background: 'transparent', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 12.5,
  }

  return (
    <div style={{ marginTop: 10 }}>
      <button onClick={() => setConsent('photo')} disabled={!!busy} style={{ ...btn, cursor: busy ? 'default' : 'pointer' }}>
        {busy === 'gps' ? 'Localisation…' : busy === 'upload' ? 'Enregistrement…' : 'Client absent ? Valider mon arrivée (photo + GPS)'}
      </button>
      <button onClick={() => setConsent('code')} disabled={!!busy} style={{ ...btn, marginTop: 7, cursor: busy ? 'default' : 'pointer' }}>
        {busy === 'code' ? 'Envoi…' : 'Le client n\u2019est pas là (code de confirmation)'}
      </button>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={onPhoto} />

      {consent && (
        <div style={{ marginTop: 8, padding: 11, borderRadius: 12, background: 'rgba(255,255,255,.1)', fontSize: 11.5, lineHeight: 1.5, color: '#fff' }}>
          <b>Utilisation de votre position</b><br />
          Votre position sera relevée une seule fois, uniquement pour valider votre arrivée alors que le client est absent
          (pas de suivi). Elle sera enregistrée avec la mission et consultable en cas de litige.
          <div style={{ display: 'flex', gap: 8, marginTop: 9 }}>
            <button onClick={() => (consent === 'photo' ? start() : startCode())}
              style={{ ...btn, background: '#12B39C', border: 'none', cursor: 'pointer' }}>J&apos;accepte</button>
            <button onClick={() => setConsent('')} style={{ ...btn, cursor: 'pointer' }}>Annuler</button>
          </div>
        </div>
      )}

      {!codeStep && !consent && (
        <button onClick={() => setCodeStep(true)} style={{ marginTop: 6, background: 'none', border: 'none', color: 'rgba(255,255,255,.75)', fontSize: 11, textDecoration: 'underline', cursor: 'pointer', width: '100%' }}>
          J&apos;ai déjà un code du client
        </button>
      )}

      {codeStep && (
        <div style={{ marginTop: 8, padding: 11, borderRadius: 12, background: 'rgba(255,255,255,.1)' }}>
          <div style={{ fontSize: 11.5, color: '#fff', marginBottom: 7 }}>Code à 6 chiffres communiqué par le client</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000" aria-label="Code de confirmation"
              style={{ flex: 1, minWidth: 0, borderRadius: 10, border: 'none', padding: '9px 10px', fontSize: 16, letterSpacing: 4, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }} />
            <button onClick={submitCode} disabled={!!busy || code.length !== 6}
              style={{ ...btn, width: 'auto', padding: '9px 16px', background: '#12B39C', border: 'none', opacity: code.length === 6 ? 1 : .6, cursor: 'pointer' }}>Valider</button>
          </div>
        </div>
      )}

      <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,.72)', marginTop: 7, textAlign: 'center' }}>
        Le client a pu laisser un QR sur place : scannez-le avec l&apos;appareil photo de votre téléphone.
      </div>
      {info && <div role="status" style={{ marginTop: 7, fontSize: 11.5, color: '#fff', textAlign: 'center', lineHeight: 1.45 }}>{info}</div>}
    </div>
  )
}
