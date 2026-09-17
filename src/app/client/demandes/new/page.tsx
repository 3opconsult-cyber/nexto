"use client"
import { useState, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import NavDrawer from '@/components/NavDrawer'
import { TRADE_LIST } from '@/lib/trades'

const SLOTS = [
  { key: 'matin', label: 'Matin' },
  { key: 'apres-midi', label: 'Après-midi' },
  { key: 'soir', label: 'Soir' },
]
const FREQUENCIES = [
  { key: 'ponctuel', label: 'Ponctuel' },
  { key: 'hebdomadaire', label: 'Hebdomadaire' },
  { key: 'mensuel', label: 'Mensuel' },
]

// "Demande ouverte" : contrairement a mission/new (reservation d'un pro deja
// choisi, prix fixe des la creation), ici on poste un besoin visible des pros
// a proximite (requests_nearby, status='open') sans prix fixe — ils repondent
// depuis /pro/carte (provider_respond_to_request) et la negociation se fait
// dans le chat, comme pour toute autre mise en relation.
export default function NewOpenRequestPage() {
  const router = useRouter()
  const [category, setCategory] = useState('menage')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [frequency, setFrequency] = useState('ponctuel')
  const [desiredDate, setDesiredDate] = useState('')
  const [desiredSlot, setDesiredSlot] = useState('matin')
  const [budgetMin, setBudgetMin] = useState('')
  const [budgetMax, setBudgetMax] = useState('')
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
    if (!title.trim()) { setError('Indique un titre pour ta demande.'); return }
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

    const minCents = budgetMin ? Math.round(Number(budgetMin) * 100) : null
    const maxCents = budgetMax ? Math.round(Number(budgetMax) * 100) : null

    const { error: reqErr } = await supabase.from('requests').insert({
      requester_id: user.id, category, title: title.trim(), description: description.trim(),
      budget_min_cents: minCents, budget_max_cents: maxCents,
      budget_cents: maxCents ?? minCents,
      desired_date: desiredDate || null, desired_slot: desiredSlot, frequency,
      address: address.trim(),
      lat: pos.coords.latitude, lng: pos.coords.longitude,
      status: 'open',
    })
    if (reqErr) { setError('Impossible de publier la demande.'); setCreating(false); return }

    router.push('/client/demandes')
  }

  const fieldStyle: CSSProperties = { display: 'block', width: '100%', marginTop: 6, border: '1px solid #DCE5E3', borderRadius: 10, padding: '11px 13px', fontSize: 14, background: '#fff' }
  const labelStyle: CSSProperties = { fontSize: 12.5, color: '#6E8592', fontWeight: 600 }

  return (
    <div style={{ minHeight: '100vh', background: '#123644', fontFamily: 'Inter, sans-serif', paddingBottom: 100 }}>
      <div style={{ padding: '16px 20px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
        <NavDrawer />
        <button onClick={() => router.back()} style={{ color: '#fff', background: 'none', border: 'none', fontSize: 13, fontWeight: 700 }}>← Retour</button>
      </div>
      <div style={{ padding: '20px 20px 16px' }}>
        <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 22, color: '#fff' }}>Nouvelle demande</div>
        <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,.6)', marginTop: 6, maxWidth: '38ch' }}>
          Visible des prestataires à proximité — ils vous font une proposition chiffrée, à négocier ensuite dans la conversation.
        </p>
      </div>

      <div style={{ background: '#F3F6F5', borderRadius: '20px 20px 0 0', padding: '20px 16px', minHeight: '60vh' }}>
        <div style={{ fontSize: 12.5, color: '#6E8592', fontWeight: 600, marginBottom: 8 }}>Quel service ?</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
          {TRADE_LIST.map(t => (
            <button key={t.key} onClick={() => setCategory(t.key)}
              style={{ padding: '10px 16px', borderRadius: 999, border: category === t.key ? '2px solid #12B39C' : '2px solid #E7EDEB', background: category === t.key ? 'rgba(18,179,156,.06)' : '#fff', fontWeight: 700, fontSize: 13, color: '#123644' }}>
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ fontSize: 12.5, color: '#6E8592', fontWeight: 700, marginBottom: 8 }}>Décrivez le besoin</div>
        <label style={{ display: 'block', marginBottom: 14 }}>
          <span style={labelStyle}>Titre</span>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex. Ménage complet · 85 m²" style={fieldStyle} />
        </label>
        <label style={{ display: 'block', marginBottom: 18 }}>
          <span style={labelStyle}>Détail</span>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Appartement 3 pièces, cuisine + 2 salles d'eau. Produits fournis."
            style={{ ...fieldStyle, fontFamily: 'inherit' }} />
        </label>

        <div style={{ fontSize: 12.5, color: '#6E8592', fontWeight: 700, marginBottom: 8 }}>Quand ?</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <label style={{ flex: 1 }}>
            <span style={labelStyle}>Date souhaitée</span>
            <input type="date" value={desiredDate} onChange={e => setDesiredDate(e.target.value)} style={fieldStyle} />
          </label>
          <label style={{ flex: 1 }}>
            <span style={labelStyle}>Créneau</span>
            <select value={desiredSlot} onChange={e => setDesiredSlot(e.target.value)} style={fieldStyle}>
              {SLOTS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </label>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
          {FREQUENCIES.map(f => (
            <button key={f.key} onClick={() => setFrequency(f.key)}
              style={{ flex: 1, padding: '10px 0', borderRadius: 999, border: frequency === f.key ? '2px solid #12B39C' : '1px solid #DCE5E3', background: frequency === f.key ? 'rgba(18,179,156,.06)' : '#fff', fontWeight: 700, fontSize: 12.5, color: '#123644' }}>
              {f.label}
            </button>
          ))}
        </div>

        <div style={{ fontSize: 12.5, color: '#6E8592', fontWeight: 700, marginBottom: 8 }}>Budget indicatif</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
          <label style={{ flex: 1 }}>
            <span style={labelStyle}>Minimum</span>
            <input type="number" value={budgetMin} onChange={e => setBudgetMin(e.target.value)} min="0" step="1" placeholder="80" style={fieldStyle} />
          </label>
          <label style={{ flex: 1 }}>
            <span style={labelStyle}>Maximum</span>
            <input type="number" value={budgetMax} onChange={e => setBudgetMax(e.target.value)} min="0" step="1" placeholder="120" style={fieldStyle} />
          </label>
        </div>
        <p style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 18 }}>Indicatif seulement — les propositions reçues peuvent différer, vous restez libre de refuser.</p>

        <div style={{ fontSize: 12.5, color: '#6E8592', fontWeight: 700, marginBottom: 8 }}>Localisation</div>
        <label style={{ display: 'block', marginBottom: 8 }}>
          <span style={labelStyle}>Adresse de la prestation</span>
          <input value={address} onChange={e => setAddress(e.target.value)} placeholder="12 avenue de Provence, Grasse" style={fieldStyle} />
        </label>
        <p style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 18 }}>Communiquée au prestataire seulement une fois la mission confirmée.</p>

        {error && <p style={{ color: '#c0503a', fontSize: 12.5, marginBottom: 12 }}>{error}</p>}

        <button onClick={submit} disabled={creating} style={{ width: '100%', border: 'none', background: '#12B39C', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15, padding: 15, borderRadius: 999, opacity: creating ? 0.7 : 1 }}>
          {creating ? 'Publication…' : 'Publier ma demande'}
        </button>
      </div>
    </div>
  )
}
