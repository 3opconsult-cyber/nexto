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
  const [threshold, setThreshold] = useState('15')
  const [loading, setLoading] = useState(true)
  // Annulations et absences (056, décisions Romain 20/11/2026) : modifiables sans déploiement.
  const [freeMin, setFreeMin] = useState('15')
  const [noShowMin, setNoShowMin] = useState('30')
  const [silenceH, setSilenceH] = useState('2')
  const [alertN, setAlertN] = useState('3')
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
        .in('key', ['commission_buyer_rate', 'commission_seller_rate', 'billing_hour_threshold_minutes', 'cancel_free_minutes', 'no_show_minutes', 'client_silence_hours', 'provider_cancel_alert_threshold'])
      const byKey: Record<string, number> = {}
      ;(data ?? []).forEach((r: any) => { byKey[r.key] = Number(r.value) })
      setBuyer(String((byKey.commission_buyer_rate ?? 0.08) * 100))
      setSeller(String((byKey.commission_seller_rate ?? 0.17) * 100))
      setThreshold(String(byKey.billing_hour_threshold_minutes ?? 15))
      setFreeMin(String(byKey.cancel_free_minutes ?? 15))
      setNoShowMin(String(byKey.no_show_minutes ?? 30))
      setSilenceH(String(byKey.client_silence_hours ?? 2))
      setAlertN(String(byKey.provider_cancel_alert_threshold ?? 3))
      setLoading(false)
    })
  }, [])

  async function save() {
    const buyerPct = Number(buyer.replace(',', '.'))
    const sellerPct = Number(seller.replace(',', '.'))
    if (!(buyerPct >= 0 && buyerPct <= 100) || !(sellerPct >= 0 && sellerPct <= 100)) {
      setError('Les deux taux doivent être des pourcentages entre 0 et 100.'); return
    }
    const thr = Number(threshold)
    if (!Number.isInteger(thr) || thr < 0 || thr > 59) { setError('Le seuil doit être un nombre entier de minutes entre 0 et 59.'); return }
    const fm = Number(freeMin), nm = Number(noShowMin), sh = Number(silenceH.replace(',', '.')), an = Number(alertN)
    if (!Number.isInteger(fm) || fm < 0 || fm > 240) { setError('Le délai d\u2019annulation sans motif doit être un nombre entier de minutes entre 0 et 240.'); return }
    if (!Number.isInteger(nm) || nm < 5 || nm > 240) { setError('Le délai d\u2019absence du prestataire doit être un nombre entier de minutes entre 5 et 240.'); return }
    if (!(sh >= 0.5 && sh <= 48)) { setError('Le délai de silence du client doit être entre 0,5 et 48 heures.'); return }
    if (!Number.isInteger(an) || an < 1 || an > 50) { setError('Le seuil d\u2019alerte doit être un nombre entier entre 1 et 50.'); return }
    setError(''); setSaving(true); setSaved(false)
    const supabase = createClient()
    const { error: err } = await supabase.from('app_settings').upsert([
      { key: 'commission_buyer_rate', value: buyerPct / 100 },
      { key: 'commission_seller_rate', value: sellerPct / 100 },
      { key: 'billing_hour_threshold_minutes', value: thr },
      { key: 'cancel_free_minutes', value: fm },
      { key: 'no_show_minutes', value: nm },
      { key: 'client_silence_hours', value: sh },
      { key: 'provider_cancel_alert_threshold', value: an },
    ])
    setSaving(false)
    if (err) { setError("Échec de l'enregistrement — vérifiez que vous êtes bien connecté en admin."); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  if (loading) return <div style={{ padding: 40, fontFamily: 'Inter, sans-serif', color: '#4E6470' }}>Chargement…</div>

  if (!authed) {
    return (
      <div style={{ padding: 40, fontFamily: 'Inter, sans-serif', maxWidth: 480 }}>
        <h1 style={{ fontFamily: 'Quicksand, sans-serif', fontSize: 20, color: '#123644' }}>Accès admin requis</h1>
        <p style={{ fontSize: 14, color: '#4E6470', marginTop: 10, lineHeight: 1.6 }}>
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
        <a href="/admin" style={{ fontSize: 13, fontWeight: 700, color: '#4E6470', textDecoration: 'none' }}>← Retour à l'admin</a>
        <h1 style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 24, color: '#123644', marginTop: 10 }}>
          Commission et facturation horaire
        </h1>
        <p style={{ fontSize: 13.5, color: '#4E6470', marginTop: 4, lineHeight: 1.5 }}>
          S'applique à toutes les nouvelles réservations et aux devis acceptés après l'enregistrement.
          Les missions déjà réservées gardent le taux qui était en vigueur au moment de la réservation.
        </p>

        <div style={{ background: '#fff', borderRadius: 16, padding: 20, marginTop: 20 }}>
          <label style={{ display: 'block', marginBottom: 16 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#123644' }}>Commission côté client (particulier)</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <input value={buyer} onChange={e => setBuyer(e.target.value)} inputMode="decimal"
                style={{ width: 90, padding: '11px 13px', borderRadius: 10, border: '1px solid #DCE5E3', fontSize: 15, fontFamily: 'Quicksand, sans-serif', fontWeight: 700 }} />
              <span style={{ color: '#4E6470', fontWeight: 700 }}>%</span>
            </div>
          </label>
          <label style={{ display: 'block', marginBottom: 18 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#123644' }}>Commission côté prestataire</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <input value={seller} onChange={e => setSeller(e.target.value)} inputMode="decimal"
                style={{ width: 90, padding: '11px 13px', borderRadius: 10, border: '1px solid #DCE5E3', fontSize: 15, fontFamily: 'Quicksand, sans-serif', fontWeight: 700 }} />
              <span style={{ color: '#4E6470', fontWeight: 700 }}>%</span>
            </div>
          </label>

          <div style={{ padding: '10px 14px', borderRadius: 10, background: '#F3F6F5', fontSize: 12.5, color: '#4E6470', marginBottom: 16 }}>
            Total prélevé par PING sur chaque prestation : <b style={{ color: '#123644' }}>{total.toFixed(1)} %</b>
          </div>

          <div style={{ borderTop: '1px solid #E7EDEB', paddingTop: 16, marginBottom: 16 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#123644' }}>Heure entamée, heure due — à partir de</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <input value={threshold} onChange={e => setThreshold(e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric"
                style={{ width: 90, padding: '11px 13px', borderRadius: 10, border: '1px solid #DCE5E3', fontSize: 15, fontFamily: 'Quicksand, sans-serif', fontWeight: 700 }} />
              <span style={{ color: '#4E6470', fontWeight: 700 }}>minutes</span>
            </div>
            <p style={{ fontSize: 12, color: '#4E6470', lineHeight: 1.55, margin: '8px 0 0' }}>
              Tarif horaire et dépassement de forfait uniquement (un forfait seul ne bouge jamais).
              Exemple avec {Number(threshold) || 0} min : {(() => { const t = Number(threshold) || 0; const ex = (m: number) => Math.floor(m / 60) + (m % 60 >= t ? 1 : 0); return `3 h 10 → ${ex(190)} h facturées, 3 h 20 → ${ex(200)} h` })()}.
              Mission plus courte que prévu : le client est remboursé de la différence avant le versement.
            </p>
          </div>

          <div style={{ borderTop: '1px solid #E7EDEB', paddingTop: 16, marginBottom: 16 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#123644' }}>Annulations, absences et clients sans réponse</span>
            {([
              ['Annulation du client avec motif sérieux possible jusqu\u2019à (avant l\u2019heure du rendez-vous)', freeMin, setFreeMin, 'minutes', 'Prestataire en route : au-delà de ce délai, le client doit donner un motif réel (maladie, urgence, accident). À moins de ce délai, ou prestataire arrivé : 100 % de la prestation et des frais de service sont facturés.'],
              ['Prestataire absent : déclaration possible après', noShowMin, setNoShowMin, 'minutes', 'Après l\u2019heure du rendez-vous, sans arrivée : le client annule sans frais, remboursement à 100 %, PING est alerté.'],
              ['Client sans réponse : clôture sur preuve possible après', silenceH, setSilenceH, 'heures', 'Photo d\u2019arrivée ou code de fin resté sans réponse : le prestataire peut clôturer sur preuve ; facturée normalement, litige possible 24 h.'],
              ['Alerte PING au-delà de (annulations d\u2019un prestataire sur 30 jours)', alertN, setAlertN, 'annulations', 'Compteur par prestataire dans l\u2019admin (Annulations) et alerte « provider_cancellations ».'],
            ] as [string, string, (v: string) => void, string, string][]).map(([label, val, set, unit, help]) => (
              <label key={label} style={{ display: 'block', marginTop: 12 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: '#123644' }}>{label}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                  <input value={val} onChange={e => set(e.target.value.replace(/[^0-9,.]/g, ''))} inputMode="decimal"
                    style={{ width: 90, padding: '11px 13px', borderRadius: 10, border: '1px solid #DCE5E3', fontSize: 15, fontFamily: 'Quicksand, sans-serif', fontWeight: 700 }} />
                  <span style={{ color: '#4E6470', fontWeight: 700 }}>{unit}</span>
                </div>
                <span style={{ display: 'block', fontSize: 12, color: '#4E6470', lineHeight: 1.5, marginTop: 6 }}>{help}</span>
              </label>
            ))}
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
