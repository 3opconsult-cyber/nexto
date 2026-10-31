"use client"
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { filterMessage } from '@/lib/chatFilter'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import NavDrawer from '@/components/NavDrawer'
import { TRADE_LIST } from '@/lib/trades'
import { geocodeAddress } from '@/lib/geocode'
import AddressChoice, { resolveAddress, type AddressValue } from '@/components/AddressChoice'
import { FREQUENCIES, HOUSEHOLD, LINEN_TYPES, PAYMENTS } from '@/components/RequestDetails'

const SLOTS = [
  { key: 'matin', label: 'Matin' },
  { key: 'apres-midi', label: 'Après-midi' },
  { key: 'soir', label: 'Soir' },
]
const HOURS = [1, 1.5, 2, 2.5, 3, 4, 5, 6]
const KILOS = [2, 4, 6, 8, 10, 15]

// Défini hors du composant : déclaré à l'intérieur, chaque frappe recréerait la section et ferait perdre
// le focus du champ en cours de saisie.
function Section({ title: t, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E7EDEB', borderRadius: 16, padding: 16, marginBottom: 12 }}>
      <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15, color: '#123644' }}>{t}</div>
      {hint && <div style={{ fontSize: 12, color: '#4E6470', marginTop: 2 }}>{hint}</div>}
      <div style={{ marginTop: 12 }}>{children}</div>
    </div>
  )
}

// Annonce du particulier (Romain 31/10, « comme sur Airbnb ») : un besoin publié à son adresse, visible des
// prestataires à proximité (requests_nearby, status='open') sans prix fixe. Ils répondent depuis /pro/carte
// (provider_respond_to_request) et le prix se fixe dans la conversation. Détails selon le service :
// surface et heures pour le ménage / nettoyage, kilos et types de linge pour le repassage.
export default function NewOpenRequestPage() {
  const router = useRouter()
  const [category, setCategory] = useState('menage')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [surface, setSurface] = useState('')
  const [hours, setHours] = useState<number | null>(2)
  const [kilos, setKilos] = useState<number | null>(null)
  const [linen, setLinen] = useState<string[]>([])
  const [frequency, setFrequency] = useState('ponctuel')
  const [household, setHousehold] = useState<string | null>(null)
  const [payment, setPayment] = useState('indifferent')
  const [desiredDate, setDesiredDate] = useState('')
  const [desiredSlot, setDesiredSlot] = useState('matin')
  const [budgetMin, setBudgetMin] = useState('')
  const [budgetMax, setBudgetMax] = useState('')
  const [urgent, setUrgent] = useState(false)
  const [profileAddress, setProfileAddress] = useState<string | null>(null)
  const [addr, setAddr] = useState<AddressValue>({ mode: 'profil', other: '', confirmed: false })
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    const sb = createClient()
    sb.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/auth/login?next=/client/demandes/new'); return }
      const { data } = await sb.from('profiles').select('address').eq('id', user.id).maybeSingle()
      setProfileAddress(data?.address?.trim() || null)
    })
  }, [router])

  const linenService = category === 'repassage'
  const days = useMemo(() => {
    const out: Date[] = []; const d0 = new Date(); d0.setHours(0, 0, 0, 0)
    for (let i = 0; i < 14; i++) { const d = new Date(d0); d.setDate(d0.getDate() + i); out.push(d) }
    return out
  }, [])
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  function getPosition(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) { reject(new Error('unsupported')); return }
      navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 })
    })
  }

  async function submit() {
    if (!title.trim()) { setError('Indiquez un titre pour votre annonce.'); return }
    const chosen = resolveAddress(profileAddress, addr)
    if ('error' in chosen) { setError(chosen.error as string); return }
    const address = chosen.address
    // Anti-contournement : l'annonce est lue par tous les prestataires du secteur ; un numéro ou un
    // e-mail permettrait de traiter hors de PING (et sans commission). Les échanges se font dans le chat.
    const leak = filterMessage(`${title} ${description}`).reasons.filter(r => r !== 'coordonnées hors plateforme')
    if (leak.length) { setError(`Retirez le ${leak[0]} : vos coordonnées restent masquées, les prestataires vous écrivent dans PING.`); return }
    setError('')
    setCreating(true)

    // Position de l'annonce = l'adresse d'intervention (géocodée), pas l'endroit où se trouve le téléphone.
    // La position de l'appareil ne sert qu'en secours si l'adresse n'est pas reconnue.
    let point = await geocodeAddress(address).catch(() => null)
    if (!point) {
      try {
        const pos = await getPosition()
        point = { lat: pos.coords.latitude, lng: pos.coords.longitude }
      } catch {
        setError("Adresse non reconnue. Précisez-la (numéro, rue, ville) ou autorisez la localisation.")
        setCreating(false)
        return
      }
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login?next=/client/demandes/new'); return }
    if (chosen.saveToProfile) await supabase.from('profiles').update({ address }).eq('id', user.id)

    const minCents = budgetMin ? Math.round(Number(budgetMin) * 100) : null
    const maxCents = budgetMax ? Math.round(Number(budgetMax) * 100) : null
    const surfaceN = surface ? Math.round(Number(surface)) : null

    const { error: reqErr } = await supabase.from('requests').insert({
      requester_id: user.id, category, title: title.trim(), description: description.trim(),
      budget_min_cents: minCents, budget_max_cents: maxCents,
      budget_cents: maxCents ?? minCents,
      desired_date: desiredDate || null, desired_slot: desiredSlot, frequency,
      hours_wanted: linenService ? null : hours,
      surface_m2: !linenService && surfaceN && surfaceN > 0 ? surfaceN : null,
      linen_kg: linenService ? kilos : null,
      linen_types: linenService && linen.length ? linen : null,
      household_size: household, payment_pref: payment,
      address,
      lat: point.lat, lng: point.lng,
      status: 'open', urgent,
    })
    if (reqErr) { setError('Impossible de publier l’annonce. Réessayez dans un instant.'); setCreating(false); return }

    router.push('/client/demandes')
  }

  const fieldStyle: CSSProperties = { display: 'block', width: '100%', marginTop: 6, border: '1px solid #DCE5E3', borderRadius: 10, padding: '11px 13px', fontSize: 14, background: '#fff', boxSizing: 'border-box' }
  const labelStyle: CSSProperties = { fontSize: 12.5, color: '#4E6470', fontWeight: 600 }
  const chip = (on: boolean): CSSProperties => ({
    padding: '9px 14px', borderRadius: 999, cursor: 'pointer', fontWeight: 700, fontSize: 13, color: '#123644',
    border: on ? '2px solid #12B39C' : '1px solid #DCE5E3', background: on ? 'rgba(18,179,156,.08)' : '#fff',
  })

  return (
    <div style={{ minHeight: '100vh', background: '#123644', fontFamily: 'Inter, sans-serif', paddingBottom: 100 }}>
      <div style={{ padding: '16px 20px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
        <NavDrawer />
        <button onClick={() => router.back()} style={{ color: '#fff', background: 'none', border: 'none', fontSize: 13, fontWeight: 700 }}>← Retour</button>
      </div>
      <div style={{ padding: '20px 20px 16px' }}>
        <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 22, color: '#fff' }}>Déposer une demande</div>
        <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,.8)', marginTop: 6, maxWidth: '40ch' }}>
          Votre annonce est visible des prestataires à proximité, sans votre adresse exacte. Ils vous font une proposition chiffrée, à négocier dans la conversation.
        </p>
      </div>

      <div style={{ background: '#F3F6F5', borderRadius: '20px 20px 0 0', padding: '20px 16px', minHeight: '60vh', maxWidth: 640, margin: '0 auto' }}>
        <Section title="Quel service ?">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {TRADE_LIST.map(t => <button key={t.key} type="button" onClick={() => setCategory(t.key)} style={chip(category === t.key)}>{t.label}</button>)}
          </div>
        </Section>

        <Section title="Votre besoin">
          <label style={{ display: 'block', marginBottom: 12 }}>
            <span style={labelStyle}>Titre de l’annonce</span>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder={linenService ? 'Ex. : repassage d’un panier de chemises' : 'Ex. : ménage complet d’un T3'} style={fieldStyle} />
          </label>
          <label style={{ display: 'block' }}>
            <span style={labelStyle}>Description <span style={{ fontWeight: 500 }}>(facultatif)</span></span>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Pièces à faire, animaux, matériel sur place, accès…"
              style={{ ...fieldStyle, fontFamily: 'inherit' }} />
          </label>
        </Section>

        {linenService ? (
          <Section title="Le linge" hint="Une idée de la quantité aide le prestataire à chiffrer.">
            <span style={labelStyle}>Quantité</span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '8px 0 14px' }}>
              {KILOS.map(k => <button key={k} type="button" onClick={() => setKilos(kilos === k ? null : k)} style={chip(kilos === k)}>{k} kg{k === 15 ? ' et +' : ''}</button>)}
            </div>
            <span style={labelStyle}>Types de linge</span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
              {LINEN_TYPES.map(l => {
                const on = linen.includes(l.key)
                return <button key={l.key} type="button" aria-pressed={on} onClick={() => setLinen(on ? linen.filter(x => x !== l.key) : [...linen, l.key])} style={chip(on)}>{l.label}</button>
              })}
            </div>
          </Section>
        ) : (
          <Section title="Le logement" hint="Surface et durée souhaitée, pour une proposition au plus juste.">
            <label style={{ display: 'block', marginBottom: 14 }}>
              <span style={labelStyle}>Surface (m²)</span>
              <input type="number" inputMode="numeric" min="1" value={surface} onChange={e => setSurface(e.target.value)} placeholder="Ex. : 65" style={{ ...fieldStyle, maxWidth: 160 }} />
            </label>
            <span style={labelStyle}>Nombre d’heures souhaité</span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
              {HOURS.map(h => <button key={h} type="button" onClick={() => setHours(hours === h ? null : h)} style={chip(hours === h)}>{String(h).replace('.', ',')} h</button>)}
            </div>
          </Section>
        )}

        <Section title="Votre foyer">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {HOUSEHOLD.map(h => <button key={h.key} type="button" onClick={() => setHousehold(household === h.key ? null : h.key)} style={chip(household === h.key)}>{h.label}</button>)}
          </div>
        </Section>

        <Section title="Quand ?">
          <span style={labelStyle}>Fréquence</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '8px 0 14px' }}>
            {FREQUENCIES.map(f => <button key={f.key} type="button" onClick={() => setFrequency(f.key)} style={chip(frequency === f.key)}>{f.label}</button>)}
          </div>
          <span style={labelStyle}>{frequency === 'ponctuel' ? 'Jour souhaité' : 'À partir du'}</span>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '8px 0 6px' }}>
            {days.map((d, i) => {
              const k = iso(d); const on = desiredDate === k
              return (
                <button key={k} type="button" onClick={() => setDesiredDate(on ? '' : k)}
                  style={{ ...chip(on), flex: '0 0 auto', width: 58, padding: '8px 0', textAlign: 'center', borderRadius: 12, background: on ? '#12B39C' : '#fff', color: on ? '#fff' : '#123644', border: on ? 'none' : '1px solid #DCE5E3' }}>
                  <div style={{ fontSize: 10.5, fontWeight: 600, textTransform: 'capitalize' }}>{i === 0 ? 'Auj.' : d.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '')}</div>
                  <div style={{ fontSize: 17, lineHeight: 1.2 }}>{d.getDate()}</div>
                  <div style={{ fontSize: 10, fontWeight: 600 }}>{d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '')}</div>
                </button>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            {SLOTS.map(s => <button key={s.key} type="button" onClick={() => setDesiredSlot(s.key)} style={{ ...chip(desiredSlot === s.key), flex: 1 }}>{s.label}</button>)}
          </div>
          <button type="button" onClick={() => setUrgent(!urgent)} aria-pressed={urgent}
            style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', padding: '12px 14px', marginTop: 14, borderRadius: 14, cursor: 'pointer', border: urgent ? '2px solid #E8743B' : '1px solid #DCE5E3', background: urgent ? 'rgba(232,116,59,.07)' : '#fff' }}>
            <span style={{ width: 38, height: 22, borderRadius: 999, background: urgent ? '#E8743B' : '#DCE5E3', position: 'relative', flexShrink: 0 }}>
              <span style={{ position: 'absolute', top: 2, left: urgent ? 18 : 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .15s' }} />
            </span>
            <span>
              <span style={{ display: 'block', fontWeight: 700, fontSize: 13.5, color: '#123644' }}>C’est urgent</span>
              <span style={{ display: 'block', fontSize: 12, color: '#4E6470' }}>Votre annonce passe en tête et s’affiche en orange chez les prestataires.</span>
            </span>
          </button>
        </Section>

        <Section title="Budget et paiement">
          <div style={{ display: 'flex', gap: 8 }}>
            <label style={{ flex: 1 }}>
              <span style={labelStyle}>Budget minimum (€)</span>
              <input type="number" value={budgetMin} onChange={e => setBudgetMin(e.target.value)} min="0" step="1" style={fieldStyle} />
            </label>
            <label style={{ flex: 1 }}>
              <span style={labelStyle}>Budget maximum (€)</span>
              <input type="number" value={budgetMax} onChange={e => setBudgetMax(e.target.value)} min="0" step="1" style={fieldStyle} />
            </label>
          </div>
          <p style={{ fontSize: 11.5, color: '#4E6470', margin: '6px 0 14px' }}>Indicatif seulement : les propositions reçues peuvent différer, vous restez libre de refuser.</p>
          <span style={labelStyle}>Mode de paiement souhaité</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
            {PAYMENTS.map(p => <button key={p.key} type="button" onClick={() => setPayment(p.key)} style={chip(payment === p.key)}>{p.label}</button>)}
          </div>
          <p style={{ fontSize: 11.5, color: '#4E6470', marginTop: 8 }}>Le paiement en CESU dépend du prestataire : il l’indique dans sa proposition.</p>
        </Section>

        <Section title="Adresse d’intervention" hint="Communiquée au prestataire seulement une fois la mission confirmée. Les prestataires voient seulement la distance.">
          <AddressChoice profileAddress={profileAddress} value={addr} onChange={setAddr} />
        </Section>

        {error && <p style={{ color: '#c0503a', fontSize: 13, fontWeight: 600, margin: '4px 0 12px' }}>{error}</p>}

        <button onClick={submit} disabled={creating} style={{ width: '100%', border: 'none', background: '#12B39C', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15, padding: 15, borderRadius: 999, cursor: 'pointer', opacity: creating ? 0.7 : 1 }}>
          {creating ? 'Publication…' : 'Publier mon annonce'}
        </button>
      </div>
    </div>
  )
}
