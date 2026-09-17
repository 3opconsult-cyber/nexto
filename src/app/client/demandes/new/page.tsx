"use client"
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import NavDrawer from '@/components/NavDrawer'
import { TRADE_LIST } from '@/lib/trades'

// "Demande ouverte" : contrairement a mission/new (reservation d'un pro deja
// choisi, prix fixe des la creation), ici on poste un besoin visible des pros
// a proximite (requests_nearby, status='open') sans prix fixe — ils repondent
// depuis /pro/carte (provider_respond_to_request) et la negociation se fait
// dans le chat, comme pour toute autre mise en relation.
export default function NewOpenRequestPage() {
  const router = useRouter()
  const [category, setCategory] = useState('menage')
  const [description, setDescription] = useState('')
  const [budget, setBudget] = useState('')
  const [address, setAddress] = useState('')
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)

  function getPosition(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) { reject(new Error('unsupported')); return }
      navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 })
    })
  }

  async function submit() {
    if (!address.trim()) { setError('Indique une adresse pour la prestation.'); return }
    setError('')
    setCreating(true)

    let pos: GeolocationPosition
    try {
      pos = await getPosition()
    } catch {
      setError("Active la localisation pour que les prestataires autour de vous voient la demande.")
      setCreating(false)
      return
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }

    const { error: reqErr } = await supabase.from('requests').insert({
      requester_id: user.id, category, description: description.trim(),
      budget_cents: budget ? Math.round(Number(budget) * 100) : null,
      address: address.trim(),
      lat: pos.coords.latitude, lng: pos.coords.longitude,
      status: 'open',
    })
    if (reqErr) { setError('Impossible de publier la demande.'); setCreating(false); return }

    router.push('/client/demandes')
  }

  return (
    <div style={{ minHeight: '100vh', background: '#123644', fontFamily: 'Inter, sans-serif', paddingBottom: 40 }}>
      <div style={{ padding: '16px 20px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
        <NavDrawer />
        <button onClick={() => router.back()} style={{ color: '#fff', background: 'none', border: 'none', fontSize: 13, fontWeight: 700 }}>← Retour</button>
      </div>
      <div style={{ padding: '20px 20px 16px' }}>
        <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 22, color: '#fff' }}>Publier une demande</div>
        <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,.6)', marginTop: 6, maxWidth: '38ch' }}>
          Visible des prestataires à proximité — ils vous font une proposition chiffrée, à négocier ensuite dans la conversation.
        </p>
      </div>

      <div style={{ background: '#F3F6F5', borderRadius: '20px 20px 0 0', padding: '20px 16px', minHeight: '60vh' }}>
        <div style={{ fontSize: 12.5, color: '#6E8592', fontWeight: 600, marginBottom: 8 }}>Service</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
          {TRADE_LIST.map(t => (
            <button key={t.key} onClick={() => setCategory(t.key)}
              style={{ padding: '10px 16px', borderRadius: 999, border: category === t.key ? '2px solid #12B39C' : '2px solid #E7EDEB', background: category === t.key ? 'rgba(18,179,156,.06)' : '#fff', fontWeight: 700, fontSize: 13, color: '#123644' }}>
              {t.label}
            </button>
          ))}
        </div>

        <label style={{ display: 'block', marginBottom: 16 }}>
          <span style={{ fontSize: 12.5, color: '#6E8592', fontWeight: 600 }}>Adresse de la prestation</span>
          <input value={address} onChange={e => setAddress(e.target.value)} placeholder="12 avenue de Provence, Grasse"
            style={{ display: 'block', width: '100%', marginTop: 6, border: '1px solid #DCE5E3', borderRadius: 10, padding: '11px 13px', fontSize: 14, background: '#fff' }} />
          <span style={{ fontSize: 11, color: '#9CA3AF' }}>Communiquée au prestataire seulement une fois la mission confirmée.</span>
        </label>

        <label style={{ display: 'block', marginBottom: 16 }}>
          <span style={{ fontSize: 12.5, color: '#6E8592', fontWeight: 600 }}>Description</span>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Ex. 80 m², ménage complet, une fois par semaine"
            style={{ display: 'block', width: '100%', marginTop: 6, border: '1px solid #DCE5E3', borderRadius: 10, padding: '11px 13px', fontSize: 13.5, fontFamily: 'inherit', background: '#fff' }} />
        </label>

        <label style={{ display: 'block', marginBottom: 22 }}>
          <span style={{ fontSize: 12.5, color: '#6E8592', fontWeight: 600 }}>Budget envisagé (facultatif)</span>
          <input type="number" value={budget} onChange={e => setBudget(e.target.value)} min="0" step="1" placeholder="Ex. 40"
            style={{ display: 'block', width: '100%', marginTop: 6, border: '1px solid #DCE5E3', borderRadius: 10, padding: '11px 13px', fontSize: 14, background: '#fff' }} />
          <span style={{ fontSize: 11, color: '#9CA3AF' }}>Une indication pour les prestataires — le prix définitif se négocie ensuite dans la conversation.</span>
        </label>

        {error && <p style={{ color: '#c0503a', fontSize: 12.5, marginBottom: 12 }}>{error}</p>}

        <button onClick={submit} disabled={creating} style={{ width: '100%', border: 'none', background: '#12B39C', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15, padding: 15, borderRadius: 999, opacity: creating ? 0.7 : 1 }}>
          {creating ? 'Publication…' : 'Publier la demande'}
        </button>
      </div>
    </div>
  )
}
