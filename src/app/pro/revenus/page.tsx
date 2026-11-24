"use client"
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import NavDrawer from '@/components/NavDrawer'
import { EUR } from '@/lib/invoice-pdf'
import ProSuspensionBanner from '@/components/ProSuspensionBanner'
import { readScreenCache, sessionUserId } from '@/lib/screenCache'
import '../../aere.css'
import '../../aere-pro.css'
import { loadRevenusSnap, type RevenusSnap } from '@/lib/screenLoaders'


const eur = EUR

export default function ProRevenusPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [uid, setUid] = useState('')
  const [sap, setSap] = useState('')
  const [sapReady, setSapReady] = useState(false)
  const [sapSaved, setSapSaved] = useState(false)
  const [sapError, setSapError] = useState('')

  async function saveSap() {
    setSapError('')
    const { error } = await createClient().from('provider_profiles').update({ sap_number: sap.trim() || null }).eq('id', uid)
    if (error) { setSapError("Le numéro n'a pas pu être enregistré. Réessayez."); return }
    setSapSaved(true); setTimeout(() => setSapSaved(false), 1800)
  }
  // Numéro fiscal (NIF) pour la déclaration DAC7 : table privée provider_private (migration 019),
  // jamais sur la fiche publique.
  const [taxId, setTaxId] = useState('')
  const [taxReady, setTaxReady] = useState(false)
  const [taxSaved, setTaxSaved] = useState(false)
  const [taxError, setTaxError] = useState('')
  async function saveTax() {
    setTaxError('')
    const clean = taxId.replace(/\s/g, '')
    if (clean && !/^\d{13}$/.test(clean)) { setTaxError('Le numéro fiscal français compte 13 chiffres (avis d’impôt, en haut à gauche).'); return }
    const { error } = await createClient().from('provider_private').upsert({ id: uid, tax_id: clean || null, updated_at: new Date().toISOString() }, { onConflict: 'id' })
    if (error) { setTaxError("Le numéro n'a pas pu être enregistré. Réessayez."); return }
    setTaxSaved(true); setTimeout(() => setTaxSaved(false), 1800)
  }
  const [monthCents, setMonthCents] = useState(0)
  const [yearCents, setYearCents] = useState(0)
  const [countYear, setCountYear] = useState(0)
  const [rating, setRating] = useState(0)
  const [reviewsCount, setReviewsCount] = useState(0)

  // Un numéro en cours de saisie n'est jamais écrasé par la relecture qui suit l'affichage du cache.
  const typed = useRef({ sap: false, tax: false })
  useEffect(() => {
    const supabase = createClient()
    let alive = true
    type Snap = RevenusSnap
    const apply = (v: Snap) => {
      setMonthCents(v.m); setYearCents(v.y); setCountYear(v.cy)
      setRating(v.rating); setReviewsCount(v.reviews)
      if (v.sap != null) { if (!typed.current.sap) setSap(v.sap); setSapReady(true) }
      if (v.tax != null) { if (!typed.current.tax) setTaxId(v.tax); setTaxReady(true) }
      setLoading(false)
    }
    ;(async () => {
      // Session locale + dernier état connu affiché tout de suite ; les 4 lectures partent ensemble
      // (avant : 5 requêtes en chaîne, 3,1 s mesurées le 19/11).
      const id = await sessionUserId(supabase)
      if (!alive) return
      if (!id) { router.push('/auth/login'); return }
      setUid(id)
      const cached = readScreenCache<Snap>('revenus', id)
      if (cached) apply(cached)
      // Lectures partagées avec le préchargement (src/lib/screenLoaders.ts), qui remplit ce cache d'avance.
      const snap = await loadRevenusSnap(supabase, id)
      if (!alive) return
      apply(snap)
    })()
    return () => { alive = false }
  }, [router])

  return (
    <div className="aere aere-pro a-lift a-navy" style={{ minHeight: '100vh', background: '#123644', fontFamily: 'Inter, sans-serif', paddingBottom: 110 }}>
      <div style={{ padding: '16px 20px 0' }}><NavDrawer /></div>
      <div style={{ padding: '20px 20px 16px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'rgba(255,255,255,.72)', marginBottom: 4 }}>Espace prestataire</div>
        <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 22, color: '#fff' }}>Mes revenus &amp; déclaration</div>
      </div>

      <div style={{ background: '#fff', borderRadius: '24px 24px 0 0', padding: '28px 20px', minHeight: '60vh' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 30, color: '#6E8592', fontWeight: 600, fontSize: 13 }}>Chargement…</div>
        ) : (
          <div className="a-stack">
            <ProSuspensionBanner />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '20px 16px' }}>
              <div style={{ padding: 16, borderRadius: 16, background: 'rgba(18,179,156,.08)' }}>
                <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 22, color: '#0B8374' }}>{eur(monthCents)}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#4E6470', marginTop: 4, textTransform: 'uppercase', letterSpacing: '.03em' }}>Ce mois</div>
              </div>
              <div style={{ padding: 16, borderRadius: 16, border: '1px solid #E7EDEB', background: '#fff' }}>
                <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 22, color: '#123644' }}>{eur(yearCents)}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#6E8592', marginTop: 4, textTransform: 'uppercase', letterSpacing: '.03em' }}>Depuis janvier</div>
              </div>
              <div style={{ padding: 16, borderRadius: 16, border: '1px solid #E7EDEB', background: '#fff' }}>
                <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 22, color: '#123644' }}>{countYear}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#6E8592', marginTop: 4, textTransform: 'uppercase', letterSpacing: '.03em' }}>Prestations cette année</div>
              </div>
              <div style={{ padding: 16, borderRadius: 16, border: '1px solid #E7EDEB', background: '#fff' }}>
                <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 22, color: '#F59E0B' }}>{rating > 0 ? rating.toFixed(1) : '—'}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#6E8592', marginTop: 4, textTransform: 'uppercase', letterSpacing: '.03em' }}>{reviewsCount} avis</div>
              </div>
            </div>

            <button onClick={() => router.push('/pro/paiements')} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, background: '#fff', border: 'none', borderRadius: 0, padding: '14px 0', cursor: 'pointer', textAlign: 'left', fontFamily: 'Inter, sans-serif' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0B8374" strokeWidth="2" style={{ flexShrink: 0 }}><rect x="2" y="6" width="20" height="13" rx="2" /><path d="M2 10h20M6 15h4" /></svg>
              <span style={{ flex: 1 }}>
                <span style={{ display: 'block', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13.5, color: '#123644' }}>Mes versements</span>
                <span style={{ display: 'block', fontSize: 12, color: '#4E6470', marginTop: 2 }}>Compte de versement et IBAN, pour le paiement en ligne</span>
              </span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6E8592" strokeWidth="2"><path d="M9 6l6 6-6 6" /></svg>
            </button>

            {sapReady && (
              <div id="sap" style={{ background: '#fff', border: '1px solid #E7EDEB', borderRadius: 16, padding: 14 }}>
                <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13.5, color: '#123644', marginBottom: 6 }}>Crédit d&apos;impôt de vos clients (numéro SAP)</div>
                <p style={{ fontSize: 12, color: '#4E6470', lineHeight: 1.55, margin: '0 0 10px' }}>
                  Avec votre numéro de déclaration de services à la personne (gratuit sur le portail NOVA), vos clients
                  bénéficient du crédit d&apos;impôt de 50 %, et ne paieront que la moitié grâce à l&apos;avance immédiate
                  de l&apos;Urssaf dès son ouverture sur PING. Un argument fort face à la concurrence.
                </p>
                <label htmlFor="sap-number" style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#4E6470', textTransform: 'uppercase', letterSpacing: '.03em', marginBottom: 5 }}>Numéro de déclaration SAP</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input id="sap-number" value={sap} onChange={e => { typed.current.sap = true; setSap(e.target.value) }}
                    style={{ flex: 1, minWidth: 0, minHeight: 44, boxSizing: 'border-box', border: '1.5px solid #E7EDEB', borderRadius: 11, padding: '10px 12px', fontSize: 14, fontFamily: 'Inter, sans-serif' }} />
                  <button onClick={saveSap} style={{ minHeight: 44, border: 'none', borderRadius: 999, padding: '0 18px', background: '#0B8374', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                    {sapSaved ? 'Enregistré' : 'Enregistrer'}
                  </button>
                </div>
                {sapError && <p style={{ color: '#c0503a', fontSize: 12, margin: '8px 0 0' }}>{sapError}</p>}
              </div>
            )}

            <div id="fiscal" style={{ background: '#fff', border: '1px solid #E7EDEB', borderRadius: 16, padding: 14 }}>
              <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13.5, color: '#123644', marginBottom: 6 }}>Déclaration des revenus (DAC7)</div>
              <p style={{ fontSize: 12, color: '#4E6470', lineHeight: 1.55, margin: 0 }}>
                Les revenus perçus via une plateforme comme PING pour des prestations de services sont
                imposables et doivent être déclarés (formulaire 2042 C PRO). Conformément à la loi
                (art. 1649 ter D du CGI), PING vous transmettra chaque année le total net perçu et le
                nombre d&apos;opérations, et les déclarera à l&apos;administration fiscale avant le 31 janvier.
                Pour cela, la loi demande votre numéro fiscal.
              </p>
              {taxReady && (
                <>
                  <label htmlFor="tax-id" style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#4E6470', textTransform: 'uppercase', letterSpacing: '.03em', margin: '12px 0 5px' }}>Numéro fiscal (13 chiffres)</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input id="tax-id" value={taxId} onChange={e => { typed.current.tax = true; setTaxId(e.target.value) }} inputMode="numeric"
                      style={{ flex: 1, minWidth: 0, minHeight: 44, boxSizing: 'border-box', border: '1.5px solid #E7EDEB', borderRadius: 11, padding: '10px 12px', fontSize: 14, fontFamily: 'Inter, sans-serif' }} />
                    <button onClick={saveTax} style={{ minHeight: 44, border: 'none', borderRadius: 999, padding: '0 18px', background: '#0B8374', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                      {taxSaved ? 'Enregistré' : 'Enregistrer'}
                    </button>
                  </div>
                  <p style={{ fontSize: 11, color: '#6E8592', margin: '6px 0 0' }}>Visible uniquement par vous et PING, jamais sur votre profil.</p>
                  {taxError && <p style={{ color: '#c0503a', fontSize: 12, margin: '8px 0 0' }}>{taxError}</p>}
                </>
              )}
            </div>

            <p className="a-mini" style={{ fontSize: 13, color: '#4E6470', lineHeight: 1.5 }}>
              Montants nets, après commission PING — cohérents avec vos factures dans « Mes opérations ».
              Ce récapitulatif ne remplace pas un conseil comptable.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
