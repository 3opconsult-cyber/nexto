"use client"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import NavDrawer from '@/components/NavDrawer'
import ProSuspensionBanner from '@/components/ProSuspensionBanner'

// Compte de versement du prestataire, chez le partenaire de paiement agréé (Stripe, Mangopay ou
// Lemonway selon le réglage serveur). PING ne stocke jamais l'IBAN : il est transmis au partenaire.
// Tant que le paiement en ligne n'est pas actif, la page le dit simplement (pas de fausse saisie).
type State = {
  actif: boolean; prestataire?: string; saisieIban?: boolean
  compte?: { statut: 'pending' | 'active' | 'restricted'; message: string | null; iban: boolean } | null
}

// Prélèvement automatique des commissions (mandat SEPA) : statut posé uniquement par PING / le
// partenaire de paiement (migration 019). Libellés déclaratifs.
const MANDAT: Record<string, { t: string; fg: string; bg: string; txt: string }> = {
  none: { t: 'Non signé', fg: '#9A6712', bg: 'rgba(242,169,59,.15)', txt: 'Le mandat se signe avec l’ouverture de votre compte de versement, chez le partenaire de paiement.' },
  pending: { t: 'En cours', fg: '#9A6712', bg: 'rgba(242,169,59,.15)', txt: 'Mandat transmis à votre banque, en attente de son retour.' },
  active: { t: 'Actif', fg: '#0C8F7E', bg: 'rgba(18,179,156,.12)', txt: 'Les commissions non retenues sur un versement sont prélevées automatiquement sur votre compte.' },
  revoked: { t: 'Révoqué', fg: '#c0503a', bg: 'rgba(192,80,58,.12)', txt: 'Votre banque nous a signalé la révocation du mandat. Les commissions dues sont retenues sur vos prochains versements ; au-delà du plafond d’impayés, le compte est suspendu.' },
  failed: { t: 'Refusé', fg: '#c0503a', bg: 'rgba(192,80,58,.12)', txt: 'Votre banque a refusé le mandat. Contactez le support PING pour le renouveler.' },
}

const input = { width: '100%', border: '1.5px solid #E7EDEB', borderRadius: 11, padding: '10px 12px', fontSize: 13.5, fontFamily: 'Inter, sans-serif', boxSizing: 'border-box' as const }
const label = { fontSize: 11, fontWeight: 700, color: '#4E6470', textTransform: 'uppercase' as const, letterSpacing: '.03em', margin: '10px 0 5px', display: 'block' }

export default function ProPaiementsPage() {
  const router = useRouter()
  const [st, setSt] = useState<State | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [mandat, setMandat] = useState<string>('none')
  const [debts, setDebts] = useState<Array<{ id: string; amount_cents: number; reason: string; created_at: string }>>([])
  const [f, setF] = useState({ titulaire: '', iban: '', bic: '', ligne: '', codePostal: '', ville: '', dateNaissance: '' })

  async function load() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const [{ data: pp }, { data: dd }] = await Promise.all([
        supabase.from('provider_profiles').select('sepa_mandate_status').eq('id', user.id).maybeSingle(),
        supabase.from('commission_debts').select('id, amount_cents, reason, created_at').eq('provider_id', user.id).eq('status', 'open').order('created_at'),
      ])
      if (pp?.sepa_mandate_status) setMandat(pp.sepa_mandate_status)
      setDebts(dd ?? [])
    }
    const r = await fetch('/api/payments/onboarding')
    if (r.status === 401) { router.push('/auth/login'); return }
    setSt(await r.json().catch(() => ({ actif: false })))
  }
  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => { if (!user) router.push('/auth/login'); else load() })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function submit() {
    setError('')
    if (st?.saisieIban) {
      if (!f.titulaire.trim() || f.iban.replace(/\s/g, '').length < 15) { setError('Titulaire et IBAN requis.'); return }
      if (!st.compte && (!f.dateNaissance || !f.ligne.trim() || !f.ville.trim() || !f.codePostal.trim())) { setError('Date de naissance et adresse requises à l’ouverture.'); return }
    }
    setBusy(true)
    const body = st?.saisieIban ? {
      titulaire: f.titulaire.trim(), iban: f.iban, bic: f.bic.trim() || undefined, dateNaissance: f.dateNaissance || undefined,
      adresse: f.ligne.trim() ? { ligne: f.ligne.trim(), ville: f.ville.trim(), codePostal: f.codePostal.trim() } : undefined,
    } : {}
    const r = await fetch('/api/payments/onboarding', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const j = await r.json().catch(() => ({}))
    if (j.redirectUrl) { window.location.href = j.redirectUrl; return }
    if (!r.ok) setError(j.error || 'Ouverture impossible pour le moment.')
    await load()
    setBusy(false)
  }

  const c = st?.compte
  const badge = c?.statut === 'active' ? { t: 'Versements actifs', bg: 'rgba(18,179,156,.12)', fg: '#0C8F7E' }
    : c?.statut === 'restricted' ? { t: 'Compte à régulariser', bg: 'rgba(192,80,58,.12)', fg: '#c0503a' }
    : c ? { t: 'En cours de contrôle', bg: 'rgba(242,169,59,.15)', fg: '#9A6712' } : null

  return (
    <div style={{ minHeight: '100vh', background: '#123644', fontFamily: 'Inter, sans-serif', paddingBottom: 40 }}>
      <div style={{ padding: '16px 20px 0' }}><NavDrawer /></div>
      <div style={{ padding: '20px 20px 16px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'rgba(255,255,255,.72)', marginBottom: 4 }}>Espace prestataire</div>
        <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 22, color: '#fff' }}>Mes versements</div>
      </div>
      <div style={{ background: '#F3F6F5', borderRadius: '20px 20px 0 0', padding: '20px 16px', minHeight: '60vh' }}>
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <ProSuspensionBanner />
          {!st ? (
            <div style={{ textAlign: 'center', padding: 30, color: '#6E8592', fontWeight: 600, fontSize: 13 }}>Chargement…</div>
          ) : !st.actif ? (
            <div style={{ background: '#fff', border: '1px solid #E7EDEB', borderRadius: 16, padding: 16 }}>
              <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14, color: '#123644' }}>Paiement en ligne bientôt disponible</div>
              <p style={{ fontSize: 12.5, color: '#4E6470', lineHeight: 1.55, margin: '6px 0 0' }}>
                Le client paiera par carte à la réservation ; l&apos;argent restera bloqué chez un partenaire de paiement agréé
                jusqu&apos;à 24 h après la fin de la mission, puis sera versé sur votre IBAN. Vous pouvez déjà déposer votre RIB
                dans « Mes pièces » : il servira à ouvrir votre compte de versement.
              </p>
            </div>
          ) : (
            <>
              <div style={{ background: '#fff', border: '1px solid #E7EDEB', borderRadius: 16, padding: 16, marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14, color: '#123644' }}>Compte de versement · {st.prestataire}</div>
                  {badge && <span style={{ fontSize: 10.5, fontWeight: 700, padding: '4px 9px', borderRadius: 999, background: badge.bg, color: badge.fg, whiteSpace: 'nowrap' }}>{badge.t}</span>}
                </div>
                <p style={{ fontSize: 12.5, color: '#4E6470', lineHeight: 1.55, margin: '6px 0 0' }}>
                  {c?.statut === 'active'
                    ? 'Vos missions payées vous sont versées 24 h après le scan de fin, sauf réclamation du client, commission PING déduite.'
                    : c?.message || `Votre identité et votre IBAN sont contrôlés par ${st.prestataire}, établissement de paiement agréé. PING ne conserve pas votre IBAN.`}
                </p>
              </div>

              {st.saisieIban ? (
                <div style={{ background: '#fff', border: '1px solid #E7EDEB', borderRadius: 16, padding: 16 }}>
                  <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14, color: '#123644' }}>{c?.iban ? 'Changer d’IBAN' : 'Votre IBAN'}</div>
                  <label style={label}>Titulaire du compte</label>
                  <input style={input} value={f.titulaire} onChange={e => setF({ ...f, titulaire: e.target.value })} />
                  <label style={label}>IBAN</label>
                  <input style={input} value={f.iban} onChange={e => setF({ ...f, iban: e.target.value.toUpperCase() })} />
                  <label style={label}>BIC (facultatif)</label>
                  <input style={input} value={f.bic} onChange={e => setF({ ...f, bic: e.target.value.toUpperCase() })} />
                  {!c && (
                    <>
                      <label style={label}>Date de naissance</label>
                      <input style={input} type="date" value={f.dateNaissance} onChange={e => setF({ ...f, dateNaissance: e.target.value })} />
                      <label style={label}>Adresse (numéro et rue)</label>
                      <input style={input} value={f.ligne} onChange={e => setF({ ...f, ligne: e.target.value })} />
                      <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 8 }}>
                        <div>
                          <label style={label}>Code postal</label>
                          <input style={input} value={f.codePostal} onChange={e => setF({ ...f, codePostal: e.target.value })} />
                        </div>
                        <div>
                          <label style={label}>Ville</label>
                          <input style={input} value={f.ville} onChange={e => setF({ ...f, ville: e.target.value })} />
                        </div>
                      </div>
                      <p style={{ fontSize: 11.5, color: '#4E6470', lineHeight: 1.5, margin: '10px 0 0' }}>
                        Les pièces déjà déposées dans « Mes pièces » (identité, justificatif de statut) sont transmises au partenaire de paiement.
                      </p>
                    </>
                  )}
                  {error && <p style={{ color: '#c0503a', fontSize: 12, marginTop: 10 }}>{error}</p>}
                  <button onClick={submit} disabled={busy} style={{ width: '100%', marginTop: 14, border: 'none', background: '#12B39C', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14.5, padding: 13, borderRadius: 999, cursor: 'pointer', opacity: busy ? 0.7 : 1 }}>
                    {busy ? 'Envoi…' : c ? 'Enregistrer' : 'Ouvrir mon compte de versement'}
                  </button>
                </div>
              ) : c?.statut !== 'active' && (
                <>
                  {error && <p style={{ color: '#c0503a', fontSize: 12, marginBottom: 10 }}>{error}</p>}
                  <button onClick={submit} disabled={busy} style={{ width: '100%', border: 'none', background: '#12B39C', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14.5, padding: 13, borderRadius: 999, cursor: 'pointer', opacity: busy ? 0.7 : 1 }}>
                    {busy ? 'Ouverture…' : c ? `Compléter chez ${st.prestataire}` : `Ouvrir mon compte chez ${st.prestataire}`}
                  </button>
                  <p style={{ fontSize: 11.5, color: '#4E6470', lineHeight: 1.5, marginTop: 10, textAlign: 'center' }}>
                    Vous saisissez identité et IBAN directement chez {st.prestataire}, puis revenez ici.
                  </p>
                </>
              )}
            </>
          )}

          {st && (
            <div id="mandat" style={{ background: '#fff', border: '1px solid #E7EDEB', borderRadius: 16, padding: 16, marginTop: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14, color: '#123644' }}>Prélèvement automatique des commissions</div>
                <span style={{ fontSize: 10.5, fontWeight: 700, padding: '4px 9px', borderRadius: 999, whiteSpace: 'nowrap', ...(st.actif ? { background: (MANDAT[mandat] || MANDAT.none).bg, color: (MANDAT[mandat] || MANDAT.none).fg } : { background: '#EEF2F1', color: '#4E6470' }) }}>
                  {st.actif ? (MANDAT[mandat] || MANDAT.none).t : 'Bientôt opérationnel'}
                </span>
              </div>
              <p style={{ fontSize: 12.5, color: '#4E6470', lineHeight: 1.55, margin: '6px 0 0' }}>
                Quand le client paie via PING, la commission est retenue directement sur votre versement. Le mandat
                de prélèvement SEPA sert aux commissions qui ne peuvent pas l&apos;être (par exemple une mission réglée par
                l&apos;avance immédiate de l&apos;Urssaf, versée directement sur votre compte).{' '}
                {st.actif ? (MANDAT[mandat] || MANDAT.none).txt : 'Il sera proposé à l’ouverture du paiement en ligne. Conditions : voir les CGV prestataires.'}
              </p>
              <a href="/cgu#prestataires" style={{ display: 'inline-block', marginTop: 8, fontSize: 12.5, fontWeight: 700, color: '#0C8F7E' }}>CGV prestataires et contrat de commission</a>
            </div>
          )}

          {debts.length > 0 && (
            <div style={{ background: '#fff', border: '1.5px solid rgba(192,80,58,.35)', borderRadius: 16, padding: 16, marginTop: 14 }}>
              <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14, color: '#a8402c' }}>Commissions à régulariser</div>
              {debts.map(d => (
                <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12.5, color: '#123644', padding: '8px 0', borderTop: '1px solid #E7EDEB' }}>
                  <span>{d.reason} · {new Date(d.created_at).toLocaleDateString('fr-FR')}</span>
                  <b>{(d.amount_cents / 100).toFixed(2).replace('.', ',')} €</b>
                </div>
              ))}
              <p style={{ fontSize: 11.5, color: '#4E6470', lineHeight: 1.5, margin: '6px 0 0' }}>Retenu automatiquement sur votre prochain versement.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
