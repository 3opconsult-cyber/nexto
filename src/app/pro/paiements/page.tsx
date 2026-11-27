"use client"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import BackHeader from '@/components/BackHeader'
import { getRates } from '@/lib/pricing'
import ProSuspensionBanner from '@/components/ProSuspensionBanner'
import { EUR } from '@/lib/invoice-pdf'
import '../../aere.css'
import '../../aere-pro.css'
import { TRANSFER_STATUS, pingBank, transferState, bicValid, cleanIban, formatIban, ibanValid, type Transfer } from '@/lib/transfers'

// Paiements du prestataire.
// 1. Virement SEPA (décision Romain 31/10, migration 025) : le mode de paiement actuel. Le pro saisit
//    l'IBAN sur lequel SES clients le paient directement (provider_private, lisible par lui et l'admin ;
//    transmis au seul client d'une mission terminée, RPC payee_bank_details). Il voit les commissions
//    PING qu'il doit régler par virement.
// 2. Paiement en ligne sous séquestre (Stripe, Mangopay ou Lemonway) : en suspens. Une fois actif,
//    l'IBAN de versement est transmis au partenaire agréé ; tant qu'il ne l'est pas, la page le dit.
type State = {
  actif: boolean; prestataire?: string; saisieIban?: boolean
  compte?: { statut: 'pending' | 'active' | 'restricted'; message: string | null; iban: boolean } | null
}

// Prélèvement automatique des commissions (mandat SEPA) : statut posé uniquement par PING / le
// partenaire de paiement (migration 019). Libellés déclaratifs.
const MANDAT: Record<string, { t: string; fg: string; bg: string; txt: string }> = {
  none: { t: 'Non signé', fg: '#8A6520', bg: 'rgba(242,169,59,.15)', txt: 'Le mandat se signe avec l’ouverture de votre compte de versement, chez le partenaire de paiement.' },
  pending: { t: 'En cours', fg: '#8A6520', bg: 'rgba(242,169,59,.15)', txt: 'Mandat transmis à votre banque, en attente de son retour.' },
  active: { t: 'Actif', fg: '#0B8374', bg: 'rgba(18,179,156,.12)', txt: 'Les commissions non retenues sur un versement sont prélevées automatiquement sur votre compte.' },
  revoked: { t: 'Révoqué', fg: '#B3402F', bg: 'rgba(179,64,47,.12)', txt: 'Votre banque nous a signalé la révocation du mandat. Les commissions dues sont retenues sur vos prochains versements ; au-delà du plafond d’impayés, le compte est suspendu.' },
  failed: { t: 'Refusé', fg: '#B3402F', bg: 'rgba(179,64,47,.12)', txt: 'Votre banque a refusé le mandat. Contactez le support PING pour le renouveler.' },
}

const maskIban = (raw: string) => { const c = cleanIban(raw); return c.length > 8 ? formatIban(c.slice(0, 4) + '•'.repeat(c.length - 8) + c.slice(-4)) : c }
const input = { width: '100%', border: '1.5px solid #E7EDEB', borderRadius: 11, padding: '0 12px', minHeight: 44, fontSize: 13.5, fontFamily: 'Inter, sans-serif', boxSizing: 'border-box' as const }
const label = { fontSize: 11, fontWeight: 700, color: '#4E6470', textTransform: 'uppercase' as const, letterSpacing: '.03em', margin: '10px 0 5px', display: 'block' }

export default function ProPaiementsPage() {
  const router = useRouter()
  const [st, setSt] = useState<State | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [mandat, setMandat] = useState<string>('none')
  const [debts, setDebts] = useState<Array<{ id: string; amount_cents: number; reason: string; created_at: string }>>([])
  const [f, setF] = useState({ titulaire: '', iban: '', bic: '', ligne: '', codePostal: '', ville: '', dateNaissance: '' })
  // Virement SEPA
  const [uid, setUid] = useState<string | null>(null)
  const [bank, setBank] = useState({ holder: '', iban: '', bic: '' })
  const [savedIban, setSavedIban] = useState<string | null>(null)
  const [bankMsg, setBankMsg] = useState<{ ok: boolean; t: string } | null>(null)
  const [bankBusy, setBankBusy] = useState(false)
  const [owed, setOwed] = useState<Transfer[]>([])
  const [toConfirm, setToConfirm] = useState<Transfer[]>([])
  const [editIban, setEditIban] = useState(false)
  const [rate, setRate] = useState<number | null>(null)
  const [pingIban, setPingIban] = useState<{ iban: string; bic: string; beneficiary: string } | null>(null)
  const [vbusy, setVbusy] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

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
      setUid(user.id)
      const [{ data: priv }, { data: tr }] = await Promise.all([
        supabase.from('provider_private').select('iban, iban_holder, bic').eq('id', user.id).maybeSingle(),
        supabase.from('transfer_payments').select('*').eq('payer_id', user.id).eq('payer_role', 'pro').neq('status', 'recu').order('due_at'),
      ])
      setSavedIban(priv?.iban ?? null)
      setBank({ holder: priv?.iban_holder ?? '', iban: priv?.iban ? formatIban(priv.iban) : '', bic: priv?.bic ?? '' })
      setOwed((tr ?? []) as Transfer[])
      // Virements de clients (prestations) annoncés mais pas encore notés reçus : à confirmer ou à contester.
      const { data: rec } = await supabase.from('transfer_payments').select('*').eq('payee_id', user.id).eq('payee', 'pro')
        .in('status', ['declare_paye', 'en_retard']).not('declared_at', 'is', null).order('declared_at')
      setToConfirm((rec ?? []) as Transfer[])
    }
    const r = await fetch('/api/payments/onboarding')
    if (r.status === 401) { router.push('/auth/login'); return }
    setSt(await r.json().catch(() => ({ actif: false })))
  }
  useEffect(() => {
    getRates().then(r => setRate(r.seller)).catch(() => { })
    pingBank(createClient()).then(setPingIban).catch(() => { })
    createClient().auth.getUser().then(({ data: { user } }) => { if (!user) router.push('/auth/login'); else load() })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function saveBank() {
    setBankMsg(null)
    const iban = cleanIban(bank.iban)
    if (!bank.holder.trim()) { setBankMsg({ ok: false, t: 'Indiquez le titulaire du compte.' }); return }
    if (!ibanValid(iban)) { setBankMsg({ ok: false, t: 'Cet IBAN n’est pas valide : vérifiez les caractères (27 pour un IBAN français, commençant par FR76).' }); return }
    if (!bicValid(bank.bic)) { setBankMsg({ ok: false, t: 'Ce BIC n’est pas valide (8 ou 11 caractères), ou laissez-le vide.' }); return }
    if (!uid) return
    setBankBusy(true)
    const { error: e } = await createClient().from('provider_private').upsert(
      { id: uid, iban, iban_holder: bank.holder.trim(), bic: bank.bic.trim().toUpperCase() || null, updated_at: new Date().toISOString() }, { onConflict: 'id' })
    setBankBusy(false)
    if (e) { setBankMsg({ ok: false, t: 'Enregistrement impossible : ' + e.message }); return }
    setSavedIban(iban); setBank(b => ({ ...b, iban: formatIban(iban) }))
    setBankMsg({ ok: true, t: 'IBAN enregistré. Il sera indiqué à vos clients après chaque intervention terminée.' })
    setEditIban(false)
  }

  // « J'ai viré » : même écriture que « J'ai fait le virement » de la facture (le payeur annonce son virement).
  async function declare(t: Transfer) {
    setVbusy(t.id)
    await createClient().from('transfer_payments').update({ status: 'declare_paye' }).eq('id', t.id)
    await load(); setVbusy(null)
  }

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
  const badge = c?.statut === 'active' ? { t: 'Versements actifs', bg: 'rgba(18,179,156,.12)', fg: '#0B8374' }
    : c?.statut === 'restricted' ? { t: 'Compte à régulariser', bg: 'rgba(179,64,47,.12)', fg: '#B3402F' }
    : c ? { t: 'En cours de contrôle', bg: 'rgba(242,169,59,.15)', fg: '#8A6520' } : null

  return (
    <div className="aere aere-pro a-lift" style={{ minHeight: '100vh', background: '#fff', fontFamily: 'Inter, sans-serif', paddingBottom: 100 }}>
      <BackHeader title="Paiements" fallback="/pro/dashboard" />
      <div style={{ padding: '24px 20px 28px' }}>
        <div className="a-stack" style={{ maxWidth: 560, margin: '0 auto' }}>
          <ProSuspensionBanner />

          <div style={{ background: '#fff', border: '1px solid #E7EDEB', borderRadius: 16, padding: 16 }}>
            <h2 style={{ margin: 0, fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15, color: '#123644' }}>Comment vous êtes payé</h2>
            <p style={{ fontSize: 13, color: '#4E6470', lineHeight: 1.5, margin: '6px 0 0' }}>
              Le client vous vire la prestation directement, avec la référence de la facture. Vous virez votre commission à PING{rate !== null ? ` (${String(Math.round(rate * 1000) / 10).replace('.', ',')} % pour les nouvelles réservations ; chaque mission garde son taux)` : ''}.
            </p>
          </div>

          <div id="virement" style={{ background: '#fff', border: '1px solid #E7EDEB', borderRadius: 16, padding: 16 }}>
            <h2 style={{ margin: 0, fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 15, color: '#123644' }}>Votre IBAN</h2>
            <p style={{ fontSize: 12.5, color: '#4E6470', lineHeight: 1.5, margin: '4px 0 0' }}>
              Donné seulement au client d&apos;une mission terminée et facturée. PING ne touche pas à cet argent ; votre IBAN n&apos;apparaît jamais sur votre fiche publique.
            </p>
            {!editIban ? (
              <>
                <p style={{ margin: '10px 0 0', fontSize: 14, color: '#123644' }}>
                  <b style={savedIban ? { fontFamily: 'ui-monospace, monospace', letterSpacing: '.02em' } : undefined}>{savedIban ? maskIban(savedIban) : 'Aucun IBAN : le client ne peut pas vous virer la prestation'}</b>
                  {savedIban && bank.holder && <><br /><small style={{ color: '#4E6470', fontSize: 12 }}>{bank.holder}{bank.bic ? ` · BIC ${bank.bic}` : ''}</small></>}
                </p>
                <button type="button" onClick={() => { setBankMsg(null); setEditIban(true) }}
                  style={{ marginTop: 10, minHeight: 44, padding: '0 18px', borderRadius: 999, border: '1.5px solid #E7EDEB', background: '#fff', color: '#123644', fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }}>
                  {savedIban ? 'Modifier' : 'Ajouter'}
                </button>
                {bankMsg && <p style={{ color: bankMsg.ok ? '#0B8374' : '#B3402F', fontSize: 12, marginTop: 10, lineHeight: 1.5 }}>{bankMsg.t}</p>}
              </>
            ) : (
              <>
                <label style={label}>Titulaire du compte</label>
                <input style={input} value={bank.holder} onChange={e => setBank({ ...bank, holder: e.target.value })} autoComplete="name" />
                <label style={label}>IBAN</label>
                <input style={{ ...input, fontFamily: 'ui-monospace, monospace' }} value={bank.iban} placeholder="FR76 …" inputMode="text" autoComplete="off"
                  onChange={e => setBank({ ...bank, iban: formatIban(e.target.value) })} />
                <label style={label}>BIC (facultatif)</label>
                <input style={input} value={bank.bic} onChange={e => setBank({ ...bank, bic: e.target.value.toUpperCase().replace(/\s/g, '') })} />
                {bankMsg && <p style={{ color: bankMsg.ok ? '#0B8374' : '#B3402F', fontSize: 12, marginTop: 10, lineHeight: 1.5 }}>{bankMsg.t}</p>}
                <button onClick={saveBank} disabled={bankBusy} style={{ width: '100%', marginTop: 14, minHeight: 48, border: 'none', background: '#0B8374', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14.5, padding: 13, borderRadius: 999, cursor: 'pointer', opacity: bankBusy ? 0.7 : 1 }}>
                  {bankBusy ? 'Enregistrement…' : savedIban ? 'Mettre à jour mon IBAN' : 'Enregistrer mon IBAN'}
                </button>
                <button type="button" onClick={() => setEditIban(false)} style={{ width: '100%', minHeight: 44, marginTop: 6, border: 'none', background: 'none', color: '#4E6470', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Annuler</button>
              </>
            )}
          </div>

          <div>
          <div className="a-h" style={{ margin: '0 0 6px' }}>Commissions à régler à PING</div>
          <div style={{ background: '#fff', border: '1px solid #E7EDEB', borderRadius: 16, overflow: 'hidden' }}>
            {owed.length === 0 && <div style={{ padding: 16, fontSize: 12.5, color: '#4E6470' }}>Rien à régler.</div>}
            {owed.map((t, i) => {
              const sst = transferState(t)
              const open = sst === 'a_payer' || sst === 'en_retard'
              return (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 64, padding: '14px 0', borderTop: i ? '1px solid #E3EAE8' : 'none' }}>
                  <a href={`/mission/${t.transaction_id}/facture`} style={{ flex: 1, minWidth: 0, textDecoration: 'none', color: '#123644' }}>
                    <b style={{ display: 'block', fontSize: 13.5 }}>{t.reference} · {EUR(t.amount_cents)}</b>
                    <small style={{ color: '#4E6470', fontSize: 12 }}>{sst === 'en_retard' ? 'en retard' : `avant le ${new Date(t.due_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`}</small>
                  </a>
                  {open
                    ? <button type="button" disabled={vbusy === t.id} onClick={() => declare(t)} style={{ minHeight: 44, padding: '0 18px', borderRadius: 999, border: 'none', background: '#0B8374', color: '#fff', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', opacity: vbusy === t.id ? 0.6 : 1, whiteSpace: 'nowrap' }}>J&apos;ai viré</button>
                    : <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 999, background: TRANSFER_STATUS[sst].bg, color: TRANSFER_STATUS[sst].fg, whiteSpace: 'nowrap' }}>{TRANSFER_STATUS[sst].t}</span>}
                </div>
              )
            })}
          </div>
          <div style={{ background: '#fff', border: '1px solid #E7EDEB', borderRadius: 16, padding: 14, marginTop: 20 }}>
            <b style={{ fontSize: 15, color: '#123644' }}>Virer à PING</b>
            {pingIban?.iban ? (
              <p style={{ fontSize: 12.5, color: '#4E6470', lineHeight: 1.5, margin: '4px 0 0' }}>
                {pingIban.beneficiary} · IBAN {formatIban(pingIban.iban)}{pingIban.bic ? ` · BIC ${pingIban.bic}` : ''}
                <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(pingIban.iban.replace(/\s/g, '')); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { } }}
                  style={{ marginLeft: 8, minHeight: 44, minWidth: 68, border: '1px solid #E7EDEB', background: '#fff', color: '#0B8374', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{copied ? 'Copié' : 'Copier'}</button>
                <br />Référence : le numéro PING-V-… du document
              </p>
            ) : (
              <p style={{ fontSize: 12.5, color: '#8A6520', lineHeight: 1.5, margin: '4px 0 0' }}>IBAN de PING pas encore renseigné : les coordonnées bancaires de PING vous seront communiquées très prochainement.</p>
            )}
          </div>

          </div>

          <div>
          <div className="a-h" style={{ margin: '0 0 6px' }}>Virements de vos clients à vérifier</div>
          <div style={{ background: '#fff', border: '1px solid #E7EDEB', borderRadius: 16, overflow: 'hidden' }}>
            {toConfirm.length === 0 && <div style={{ padding: 16, fontSize: 12.5, color: '#4E6470' }}>Tout est reçu.</div>}
            {toConfirm.map((t, i) => (
              <a key={t.id} href={`/mission/${t.transaction_id}/facture`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, minHeight: 64, fontSize: 12.5, color: '#123644', padding: '14px 0', borderTop: i ? '1px solid #E3EAE8' : 'none', textDecoration: 'none' }}>
                <span>{t.reference} · annoncé le {t.declared_at ? new Date(t.declared_at).toLocaleDateString('fr-FR') : ''}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <b>{EUR(t.amount_cents)}</b>
                  <span style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 8px', borderRadius: 999, background: TRANSFER_STATUS[transferState(t)].bg, color: TRANSFER_STATUS[transferState(t)].fg }}>{TRANSFER_STATUS[transferState(t)].t}</span>
                </span>
              </a>
            ))}
          </div>
          <p style={{ fontSize: 11.5, color: '#4E6470', lineHeight: 1.5, margin: '12px 0 0' }}>Le client a annoncé son virement : ouvrez la ligne, notez « Reçu » dès qu’il apparaît sur votre compte, ou « Non reçu » s’il manque.</p>
          </div>
          {!st ? (
            <div style={{ textAlign: 'center', padding: 30, color: '#4E6470', fontWeight: 600, fontSize: 13 }}>Chargement…</div>
          ) : !st.actif ? (
            <div style={{ background: '#fff', border: '1px solid #E7EDEB', borderRadius: 16, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14, color: '#123644' }}>Paiement par virement sur facture</div>
              </div>
              <p style={{ fontSize: 12.5, color: '#4E6470', lineHeight: 1.55, margin: '6px 0 0' }}>
                À la fin de la mission, la facture est émise à votre en-tête et votre client vous règle par virement,
                directement sur votre compte (IBAN ci-dessus). Le paiement en ligne n&apos;est pas activé : PING
                n&apos;encaisse ni ne verse aucun montant.
              </p>
            </div>
          ) : (
            <>
              <div style={{ background: '#fff', border: '1px solid #E7EDEB', borderRadius: 16, padding: 16 }}>
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
                  {error && <p style={{ color: '#B3402F', fontSize: 12, marginTop: 10 }}>{error}</p>}
                  <button onClick={submit} disabled={busy} style={{ width: '100%', marginTop: 14, border: 'none', background: '#0B8374', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14.5, padding: 13, borderRadius: 999, cursor: 'pointer', opacity: busy ? 0.7 : 1 }}>
                    {busy ? 'Envoi…' : c ? 'Enregistrer' : 'Ouvrir mon compte de versement'}
                  </button>
                </div>
              ) : c?.statut !== 'active' && (
                <>
                  {error && <p style={{ color: '#B3402F', fontSize: 12, marginBottom: 10 }}>{error}</p>}
                  <button onClick={submit} disabled={busy} style={{ width: '100%', border: 'none', background: '#0B8374', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14.5, padding: 13, borderRadius: 999, cursor: 'pointer', opacity: busy ? 0.7 : 1 }}>
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
            <div id="mandat" style={{ background: '#fff', border: '1px solid #E7EDEB', borderRadius: 16, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14, color: '#123644' }}>Prélèvement automatique des commissions</div>
                <span style={{ fontSize: 10.5, fontWeight: 700, padding: '4px 9px', borderRadius: 999, whiteSpace: 'nowrap', ...(st.actif ? { background: (MANDAT[mandat] || MANDAT.none).bg, color: (MANDAT[mandat] || MANDAT.none).fg } : { background: '#EEF2F1', color: '#4E6470' }) }}>
                  {st.actif ? (MANDAT[mandat] || MANDAT.none).t : 'Non requis'}
                </span>
              </div>
              {st.actif ? (
                <p style={{ fontSize: 12.5, color: '#4E6470', lineHeight: 1.55, margin: '6px 0 0' }}>
                  Quand le client paie via PING, la commission est retenue directement sur votre versement. Le mandat
                  de prélèvement SEPA sert aux commissions qui ne peuvent pas l&apos;être (par exemple une mission réglée par
                  l&apos;avance immédiate de l&apos;Urssaf, versée directement sur votre compte).{' '}
                  {(MANDAT[mandat] || MANDAT.none).txt}
                </p>
              ) : (
                <p style={{ fontSize: 12.5, color: '#4E6470', lineHeight: 1.55, margin: '6px 0 0' }}>
                  Aujourd&apos;hui, la commission PING se règle par virement sur facture (relevé PING-V de chaque mission) :
                  aucun mandat de prélèvement ne vous est demandé. Conditions : voir les CGV prestataires.
                </p>
              )}
              <a href="/cgu#prestataires" style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, marginTop: 4, fontSize: 12.5, fontWeight: 700, color: '#0B8374' }}>CGV prestataires et contrat de commission</a>
            </div>
          )}

          {debts.length > 0 && (
            <div style={{ background: '#fff', border: '1.5px solid rgba(179,64,47,.35)', borderRadius: 16, padding: 16 }}>
              <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14, color: '#a8402c' }}>Commissions à régulariser</div>
              {debts.map(d => (
                <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12.5, color: '#123644', padding: '8px 0', borderTop: '1px solid #E7EDEB' }}>
                  <span>{d.reason} · {new Date(d.created_at).toLocaleDateString('fr-FR')}</span>
                  <b>{(d.amount_cents / 100).toFixed(2).replace('.', ',')} €</b>
                </div>
              ))}
              <p style={{ fontSize: 11.5, color: '#4E6470', lineHeight: 1.5, margin: '6px 0 0' }}>{st?.actif ? 'Retenu automatiquement sur votre prochain versement.' : 'À régler par virement à PING, avec la référence de la facture. Au-delà du plafond d’impayés, le compte est suspendu.'}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
