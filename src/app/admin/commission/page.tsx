"use client"
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Réglage des taux de commission (demande de Romain, 26/10) : avant, 5%/11%
 * étaient figés dans le code (lib/pricing.ts) — modifiables seulement par un
 * déploiement. Maintenant pilotés depuis `app_settings` (clé/valeur, RLS
 * admin-only en écriture) : ici, plus besoin de Claude ni de déploiement
 * pour ajuster. Gardé distinct de /admin/visites etc. : ceux-là sont de la
 * lecture seule pour n'importe quel compte connecté, celui-ci touche au
 * modèle de revenu — vérifie vraiment `profiles.is_admin`, pas juste "connecté".
 */
export default function AdminCommissionPage() {
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [buyer, setBuyer] = useState('')
  const [seller, setSeller] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setAuthed(false); setLoading(false); return }
      const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
      const isAdmin = !!profile?.is_admin
      setAuthed(isAdmin)
      if (!isAdmin) { setLoading(false); return }
      const { data } = await supabase.from('app_settings').select('key, value')
        .in('key', ['commission_buyer_rate', 'commission_seller_rate'])
      const byKey: Record<string, number> = {}
      ;(data ?? []).forEach((r: any) => { byKey[r.key] = Number(r.value) })
      setBuyer(String((byKey.commission_buyer_rate ?? 0.08) * 100))
      setSeller(String((byKey.commission_seller_rate ?? 0.17) * 100))
      setLoading(false)
    })
  }, [])

  async function save() {
    const buyerPct = Number(buyer.replace(',', '.'))
    const sellerPct = Number(seller.replace(',', '.'))
    if (!(buyerPct >= 0 && buyerPct <= 100) || !(sellerPct >= 0 && sellerPct <= 100)) {
      setError('Les deux taux doivent être des pourcentages entre 0 et 100.'); return
    }
    setError(''); setSaving(true); setSaved(false)
    const supabase = createClient()
    const { error: err } = await supabase.from('app_settings').upsert([
      { key: 'commission_buyer_rate', value: buyerPct / 100 },
      { key: 'commission_seller_rate', value: sellerPct / 100 },
    ])
    setSaving(false)
    if (err) { setError("Échec de l'enregistrement — vérifiez que vous êtes bien connecté en admin."); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  if (loading) return <div style={{ padding: 40, fontFamily: 'Inter, sans-serif', color: '#6E8592' }}>Chargement…</div>

  if (!authed) {
    return (
      <div style={{ padding: 40, fontFamily: 'Inter, sans-serif', maxWidth: 480 }}>
        <h1 style={{ fontFamily: 'Quicksand, sans-serif', fontSize: 20, color: '#123644' }}>Accès admin requis</h1>
        <p style={{ fontSize: 14, color: '#6E8592', marginTop: 10, lineHeight: 1.6 }}>
          Connectez-vous avec le compte admin (<code>3op.consult@gmail.com</code>) sur <a href="/auth/login">/auth/login</a>,
          puis revenez sur cette page.
        </p>
      </div>
    )
  }

  const total = (Number(buyer.replace(',', '.')) || 0) + (Number(seller.replace(',', '.')) || 0)

  return (
    <div style={{ minHeight: '100vh', background: '#F3F6F5', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ padding: '28px 24px', maxWidth: 560, margin: '0 auto' }}>
        <a href="/admin" style={{ fontSize: 13, fontWeight: 700, color: '#6E8592', textDecoration: 'none' }}>← Retour à l'admin</a>
        <h1 style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 24, color: '#123644', marginTop: 10 }}>
          Taux de commission
        </h1>
        <p style={{ fontSize: 13.5, color: '#6E8592', marginTop: 4, lineHeight: 1.5 }}>
          S'applique à toutes les nouvelles réservations et aux devis acceptés après l'enregistrement.
          Les missions déjà réservées gardent le taux qui était en vigueur au moment de la réservation.
        </p>

        <div style={{ background: '#fff', borderRadius: 16, padding: 20, marginTop: 20 }}>
          <label style={{ display: 'block', marginBottom: 16 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#123644' }}>Commission côté client (particulier)</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <input value={buyer} onChange={e => setBuyer(e.target.value)} inputMode="decimal"
                style={{ width: 90, padding: '11px 13px', borderRadius: 10, border: '1px solid #DCE5E3', fontSize: 15, fontFamily: 'Quicksand, sans-serif', fontWeight: 700 }} />
              <span style={{ color: '#6E8592', fontWeight: 700 }}>%</span>
            </div>
          </label>
          <label style={{ display: 'block', marginBottom: 18 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#123644' }}>Commission côté prestataire</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <input value={seller} onChange={e => setSeller(e.target.value)} inputMode="decimal"
                style={{ width: 90, padding: '11px 13px', borderRadius: 10, border: '1px solid #DCE5E3', fontSize: 15, fontFamily: 'Quicksand, sans-serif', fontWeight: 700 }} />
              <span style={{ color: '#6E8592', fontWeight: 700 }}>%</span>
            </div>
          </label>

          <div style={{ padding: '10px 14px', borderRadius: 10, background: '#F3F6F5', fontSize: 12.5, color: '#6E8592', marginBottom: 16 }}>
            Total prélevé par PING sur chaque prestation : <b style={{ color: '#123644' }}>{total.toFixed(1)} %</b>
          </div>

          {error && <p style={{ color: '#c0503a', fontSize: 12.5, marginBottom: 12 }}>{error}</p>}

          <button onClick={save} disabled={saving} style={{
            width: '100%', padding: 14, borderRadius: 999, border: 'none', cursor: 'pointer',
            background: saved ? '#0C8F7E' : '#12B39C', color: '#fff',
            fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14, opacity: saving ? 0.7 : 1,
          }}>
            {saving ? 'Enregistrement…' : saved ? '✓ Enregistré' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}
