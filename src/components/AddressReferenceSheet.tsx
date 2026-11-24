"use client"
import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { createPortal } from 'react-dom'
import { createClient } from '@/lib/supabase/client'
import { sessionUserId } from '@/lib/screenCache'
import { searchAddresses, type AddressHit } from '@/lib/geocode'
import Modal from '@/components/Modal'

const LiveMap = dynamic(() => import('@/components/LiveMap'), { ssr: false })

// Adresse de référence (24/11) : l'adresse qui sert à centrer la carte et à proposer « mon adresse » dans une demande.
//  - client : profiles.address (+ ville), la même écriture que « Modifier mes informations » de Mon profil ;
//  - prestataire : provider_profiles.lat / lng / location (position déclarée, comme à l'inscription) et profiles.address.
// Rien de nouveau côté base. Le point trouvé est montré sur une mini-carte AVANT de valider ; une ville seule ou une
// rue sans numéro est signalée (le point est alors au centre de la ville ou de la rue).

const PROFILE_CACHE = 'ping_loc_profile' // même clé que fetchProfileCenter (src/lib/location.ts)

export function useReferenceAddress(kind: 'client' | 'pro') {
  const [address, setAddress] = useState<string | null>(null)
  const [uid, setUid] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    let off = false
    const sb = createClient()
    sessionUserId(sb).then(async id => {
      if (off || !id) { setLoaded(true); return }
      setUid(id)
      const { data } = await sb.from('profiles').select('address').eq('id', id).maybeSingle()
      if (!off) { setAddress((data?.address || '').trim() || null); setLoaded(true) }
    })
    return () => { off = true }
  }, [kind])
  return { address, setAddress, uid, loaded }
}

/** Ligne « Adresse de référence : <adresse> » + « Modifier » (ouvre la feuille de recherche). */
export function ReferenceAddressLine({ kind, address, uid, loaded = true, onSaved, dark = false }: {
  kind: 'client' | 'pro'; address: string | null; uid: string | null; loaded?: boolean; onSaved: (label: string, point: { lat: number; lng: number }) => void; dark?: boolean
}) {
  const [open, setOpen] = useState(false)
  return (
    <div data-adresse-reference style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 56 }}>
      <p style={{ flex: 1, minWidth: 0, margin: 0, fontSize: 16, lineHeight: 1.45, color: dark ? '#fff' : '#123644', overflowWrap: 'anywhere' }}>
        <span style={{ color: dark ? 'rgba(255,255,255,.8)' : '#4E6470' }}>Adresse de référence : </span>
        <b data-adresse-reference-texte>{!loaded ? '…' : address || 'non renseignée'}</b>
      </p>
      <button type="button" onClick={() => setOpen(true)} disabled={!uid} data-adresse-modifier
        style={{ flex: '0 0 auto', minHeight: 48, minWidth: 48, padding: '0 16px', border: 'none', borderRadius: 14, background: dark ? 'rgba(255,255,255,.14)' : '#E8F6F3', color: dark ? '#fff' : '#0B8374', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 16, cursor: 'pointer' }}>
        Modifier
      </button>
      <AddressReferenceSheet open={open} onClose={() => setOpen(false)} kind={kind} uid={uid} current={address || ''}
        onSaved={(l, pt) => { setOpen(false); onSaved(l, pt) }} />
    </div>
  )
}

export default function AddressReferenceSheet({ open, onClose, kind, uid, current, onSaved }: {
  open: boolean; onClose: () => void; kind: 'client' | 'pro'; uid: string | null; current: string; onSaved: (label: string, point: { lat: number; lng: number }) => void
}) {
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<AddressHit[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [pick, setPick] = useState<AddressHit | null>(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const seq = useRef(0)

  useEffect(() => { if (open) { setQ(''); setHits(null); setPick(null); setErr('') } }, [open])
  // Autocomplétion : une requête 600 ms après la dernière frappe (Nominatim : pas de rafale).
  useEffect(() => {
    if (!open) return
    const s = q.trim()
    if (s.length < 3) { setHits(null); setSearching(false); return }
    setSearching(true)
    const my = ++seq.current
    const ctl = new AbortController()
    const t = setTimeout(async () => {
      const r = await searchAddresses(s, ctl.signal)
      if (my !== seq.current) return
      setHits(r); setSearching(false)
    }, 600)
    return () => { clearTimeout(t); ctl.abort() }
  }, [q, open])

  async function save() {
    if (!pick || !uid) return
    setSaving(true); setErr('')
    const sb = createClient()
    try {
      if (kind === 'pro') {
        const { error: e1 } = await sb.from('provider_profiles').update({ lat: pick.lat, lng: pick.lng, location: `SRID=4326;POINT(${pick.lng} ${pick.lat})` }).eq('id', uid)
        if (e1) throw e1
        const { error: e2 } = await sb.from('profiles').update({ address: pick.label }).eq('id', uid)
        if (e2) throw e2
      } else {
        const { data: cur } = await sb.from('profiles').select('city').eq('id', uid).maybeSingle()
        const city = pick.city || (cur?.city || '').trim()
        const patch: Record<string, string> = { address: pick.label }
        if (pick.city) patch.city = pick.city
        const { error } = await sb.from('profiles').update(patch).eq('id', uid)
        if (error) throw error
        // La carte se centre sur CE point (et non sur un nouveau géocodage du texte, qui pouvait retomber ailleurs).
        try { localStorage.setItem(PROFILE_CACHE, JSON.stringify({ key: `${pick.label}|${city}`, addr: pick.label, lat: pick.lat, lng: pick.lng })) } catch { }
      }
    } catch {
      setSaving(false); setErr('L’enregistrement a échoué. Réessayez dans un instant.'); return
    }
    setSaving(false)
    // Un ancien choix « ville » ou « GPS » mémorisé sur l'appareil masquerait la nouvelle adresse au prochain chargement.
    try { localStorage.removeItem('ping_loc') } catch { }
    try { window.dispatchEvent(new Event('ping-address')) } catch { }
    onSaved(pick.label, { lat: pick.lat, lng: pick.lng })
  }

  const warn = pick && pick.kind !== 'adresse'
    ? (pick.kind === 'ville'
      ? 'Ville seule : le point est au centre de la ville, pas devant chez vous. Ajoutez le numéro et la rue pour être plus précis.'
      : 'Rue sans numéro : le point est au milieu de la rue. Ajoutez le numéro pour être plus précis.')
    : ''

  // Portail sur <body> : la carte et sa feuille créent des contextes d'empilement qui recouvriraient la fenêtre.
  if (!open || typeof document === 'undefined') return null
  return createPortal(
    <Modal open={open} onClose={onClose} title="Adresse de référence"
      footer={<>
        <button type="button" onClick={save} disabled={!pick || saving} data-adresse-utiliser
          style={{ minHeight: 56, border: 'none', borderRadius: 14, background: '#0B8374', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 17, cursor: pick ? 'pointer' : 'not-allowed', opacity: !pick || saving ? .5 : 1 }}>
          {saving ? 'Enregistrement…' : 'Utiliser cette adresse'}
        </button>
        <button type="button" onClick={onClose}
          style={{ minHeight: 48, border: 'none', borderRadius: 14, background: '#F0F4F3', color: '#123644', fontWeight: 700, fontSize: 16, cursor: 'pointer', fontFamily: 'inherit' }}>Annuler</button>
      </>}>
      <p style={{ fontSize: 15, lineHeight: 1.55, color: '#4E6470', margin: '0 0 20px' }}>
        {current ? <>Adresse actuelle : <b style={{ color: '#123644' }}>{current}</b>. </> : null}
        Cherchez votre adresse, choisissez la bonne ligne : le point trouvé s’affiche avant que vous validiez.
        {kind === 'client' ? ' Votre adresse n’est montrée à un prestataire qu’une fois une mission confirmée.' : ' Elle sert à vous placer sur la carte des clients ; l’adresse d’un client ne vous est donnée qu’une fois sa mission confirmée.'}
      </p>
      <label htmlFor="addr-ref-q" style={{ display: 'block', fontSize: 15, fontWeight: 600, color: '#123644', margin: '0 0 8px' }}>Numéro, rue, ville</label>
      <input id="addr-ref-q" value={q} onChange={e => { setQ(e.target.value); setPick(null) }} autoComplete="off" autoCorrect="off" placeholder="Ex. 12 rue Mirabeau, Grasse" inputMode="search"
        style={{ width: '100%', boxSizing: 'border-box', minHeight: 52, padding: '12px 16px', border: '1.5px solid #CFDAD7', borderRadius: 14, fontSize: 16, fontFamily: 'Inter, sans-serif', color: '#123644', outline: 'none' }} />

      {searching && <p role="status" style={{ fontSize: 15, color: '#4E6470', margin: '14px 0 0' }}>Recherche…</p>}
      {!searching && hits && hits.length === 0 && (
        <p role="status" style={{ fontSize: 15, lineHeight: 1.5, color: '#A8432F', margin: '14px 0 0' }}>Aucune adresse trouvée. Vérifiez l’orthographe ou ajoutez la ville ou le code postal.</p>
      )}
      {hits && hits.length > 0 && !pick && (
        <ul data-adresse-propositions style={{ listStyle: 'none', margin: '16px 0 0', padding: 0 }}>
          {hits.map(h => (
            <li key={h.label + h.lat}>
              <button type="button" onClick={() => setPick(h)}
                style={{ display: 'block', width: '100%', textAlign: 'left', minHeight: 56, padding: '10px 4px', border: 'none', borderBottom: '1px solid #E7EDEB', background: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                <span style={{ display: 'block', fontSize: 16, fontWeight: 600, color: '#123644', lineHeight: 1.35 }}>{h.label}</span>
                <span style={{ display: 'block', fontSize: 15, color: h.kind === 'adresse' ? '#4E6470' : '#8A5A00', lineHeight: 1.35 }}>{h.kind === 'adresse' ? 'Adresse' : h.kind === 'rue' ? 'Rue entière, sans numéro' : 'Ville seule'}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {pick && (
        <div data-adresse-apercu style={{ marginTop: 20 }}>
          <b style={{ display: 'block', fontSize: 16, color: '#123644', lineHeight: 1.4 }}>Point trouvé : {pick.label}</b>
          <div style={{ position: 'relative', height: 200, borderRadius: 16, overflow: 'hidden', margin: '12px 0', border: '1px solid #E7EDEB', isolation: 'isolate' }}>
            <LiveMap userPos={{ lat: pick.lat, lng: pick.lng }} pros={[]} onSelect={() => { }} youLabel="Adresse trouvée" recenterTick={0} />
          </div>
          {warn && <p role="status" data-adresse-alerte style={{ fontSize: 15, lineHeight: 1.5, color: '#8A5A00', background: '#FFF4DD', borderRadius: 12, padding: '12px 14px', margin: '0 0 12px' }}>{warn}</p>}
          <button type="button" onClick={() => setPick(null)}
            style={{ minHeight: 48, border: 'none', background: 'none', color: '#0B8374', fontWeight: 700, fontSize: 16, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline', padding: 0 }}>Ce n’est pas la bonne : revoir les propositions</button>
        </div>
      )}
      {err && <p role="alert" style={{ fontSize: 15, color: '#A8432F', fontWeight: 600, margin: '14px 0 0' }}>{err}</p>}
    </Modal>,
    document.body,
  )
}
