"use client"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import NavDrawer from '@/components/NavDrawer'

type ServiceRow = { id: string; name: string; price_cents: number }

export default function ProTarifsPage() {
  const router = useRouter()
  const [rows, setRows] = useState<ServiceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }
    const { data } = await supabase.from('services').select('id, name, price_cents').eq('provider_id', user.id).order('created_at')
    setRows(data ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function addService() {
    const cents = Math.round(parseFloat(price.replace(',', '.')) * 100)
    if (!name.trim() || !cents || cents <= 0) return
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('services').insert({ provider_id: user.id, name: name.trim(), price_cents: cents })
    setName(''); setPrice(''); setAdding(false); setSaving(false)
    load()
  }

  async function remove(id: string) {
    const supabase = createClient()
    await supabase.from('services').delete().eq('id', id)
    setRows(rows.filter(r => r.id !== id))
  }

  return (
    <div style={{ minHeight: '100vh', background: '#123644', fontFamily: 'Inter, sans-serif', paddingBottom: 40 }}>
      <div style={{ padding: '16px 20px 0' }}><NavDrawer /></div>
      <div style={{ padding: '20px 20px 16px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'rgba(255,255,255,.45)', marginBottom: 4 }}>Espace prestataire</div>
        <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 22, color: '#fff' }}>Mes tarifs</div>
        <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,.55)', marginTop: 6, maxWidth: '38ch' }}>
          Un catalogue de prestations à prix fixe, indicatif pour vos clients — vous restez libre d&apos;ajuster au cas par cas dans un devis.
        </p>
      </div>

      <div style={{ background: '#F3F6F5', borderRadius: '20px 20px 0 0', padding: '20px 16px', minHeight: '60vh' }}>
        {loading && <div style={{ textAlign: 'center', padding: 30, color: '#9CA3AF', fontWeight: 600, fontSize: 13 }}>Chargement…</div>}

        {!loading && rows.length === 0 && !adding && (
          <div style={{ textAlign: 'center', padding: 30, background: '#fff', borderRadius: 16, border: '1px solid #E7EDEB', marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#6E8592' }}>Aucun tarif ajouté pour l&apos;instant</div>
            <div style={{ fontSize: 11.5, color: '#9CA3AF', marginTop: 4 }}>Votre tarif de base reste celui défini dans « Paramétrer mes services ».</div>
          </div>
        )}

        {rows.map(r => (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: '1px solid #E7EDEB', borderRadius: 14, padding: 13, marginBottom: 9 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13.5, color: '#123644' }}>{r.name}</div>
            </div>
            <b style={{ fontFamily: 'Quicksand, sans-serif', fontSize: 14, color: '#123644', whiteSpace: 'nowrap' }}>{(r.price_cents / 100).toFixed(0)} €</b>
            <span onClick={() => remove(r.id)} style={{ color: '#C0503A', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>Retirer</span>
          </div>
        ))}

        {adding ? (
          <div style={{ background: '#fff', border: '1.5px solid #12B39C', borderRadius: 14, padding: 13, marginTop: 4 }}>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex. Ménage complet jusqu'à 90 m²"
              style={{ width: '100%', border: '1.5px solid #E7EDEB', borderRadius: 11, padding: '10px 12px', fontSize: 13, fontFamily: 'Inter, sans-serif', marginBottom: 8, outline: 'none' }} />
            <input value={price} onChange={e => setPrice(e.target.value)} placeholder="Prix en € (ex. 90)" inputMode="decimal"
              style={{ width: '100%', border: '1.5px solid #E7EDEB', borderRadius: 11, padding: '10px 12px', fontSize: 13, fontFamily: 'Inter, sans-serif', marginBottom: 10, outline: 'none' }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setAdding(false); setName(''); setPrice('') }}
                style={{ flex: 1, padding: 11, borderRadius: 999, border: '1.5px solid #DCE5E3', background: '#fff', color: '#123644', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13 }}>Annuler</button>
              <button onClick={addService} disabled={saving}
                style={{ flex: 1, padding: 11, borderRadius: 999, border: 'none', background: '#12B39C', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13, opacity: saving ? .6 : 1 }}>
                {saving ? 'Ajout…' : 'Ajouter'}
              </button>
            </div>
          </div>
        ) : (
          <div onClick={() => setAdding(true)}
            style={{ textAlign: 'center', padding: 14, borderRadius: 999, border: '1.5px dashed #12B39C', color: '#0C8F7E', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', marginTop: 4 }}>
            + Ajouter un tarif
          </div>
        )}
      </div>
    </div>
  )
}
