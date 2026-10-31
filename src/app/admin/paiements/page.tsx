"use client"
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TRANSFER_STATUS, bicValid, cleanIban, formatIban, ibanValid, type Transfer } from '@/lib/transfers'

// Séquestre — vue OpConsult. Règle antifraude : l'argent ne sort du séquestre que sur décision de PING
// (versement automatique par la règle des 24 h, ou bouton ci-dessous ; remboursement par un admin).
type Mission = {
  id: string; status: string; payment_status: string; payment_provider: string | null
  total_charged_cents: number | null; payout_cents: number | null; payeCents: number
  completed_at: string | null; en_route_at: string | null; arrived_at: string | null
  litige: boolean; alerte: string | null
}
type Alerte = { id: string; provider_id: string | null; kind: string; detail: Record<string, any>; created_at: string; nom: string }
type Suspendu = { id: string; nom: string; payments_suspended_at: string; sepa_mandate_status: string; detteCents: number; motif: string | null }
type PareFeu = { plafondCents: number; alertes: Alerte[]; suspendus: Suspendu[] }
type Data = {
  pareFeu?: PareFeu | null
  reglage: { choisi: string | null; actif: string | null; cleService: boolean; cron: boolean; prestataires: Array<{ nom: string; label: string; cles: boolean }> }
  auto?: boolean; delaiHeures?: number; missions: Mission[]; error?: string
}

const eur = (c: number | null) => ((c ?? 0) / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
const STATUT: Record<string, string> = { held: 'Bloqué (payé)', complement_due: 'Complément dû', awaiting: 'Paiement en attente', failed: 'Paiement refusé' }
const KIND: Record<string, string> = {
  mandate_revoked: 'Mandat de prélèvement révoqué', mandate_failed: 'Mandat de prélèvement refusé', debit_rejected: 'Prélèvement de commission rejeté',
  chargeback: 'Opposition d’un client', suspended: 'Compte suspendu', unsuspended: 'Suspension levée',
  transfer_overdue: 'Commission par virement en retard',
}
const btn = (bg: string) => ({ border: 'none', borderRadius: 999, padding: '7px 14px', background: bg, color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'Inter, sans-serif' })

// Virement SEPA (migration 025) : mode de paiement actuel. PING note ici les virements reçus sur SON
// compte (frais de service des clients, commissions des prestataires) ; les prestations sont réglées
// directement au prestataire, qui les note reçues lui-même (visibles ici pour le suivi).
type Row = Transfer & { invoices: { client_snapshot: { nom?: string } | null } | null }
function Virements() {
  const db = createClient()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [all, setAll] = useState(false)
  const [bank, setBank] = useState({ iban: '', bic: '', beneficiary: '' })
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState('')

  async function load() {
    let q = db.from('transfer_payments').select('*, invoices!transfer_payments_invoice_id_fkey(client_snapshot)').order('due_at').limit(300)
    if (!all) q = q.eq('payee', 'ping').neq('status', 'recu')
    const { data, error } = await q
    if (error) setMsg('Lecture impossible : ' + error.message)
    setRows((data ?? []) as Row[])
    const { data: st } = await db.from('app_settings').select('key, value').in('key', ['ping_iban', 'ping_bic', 'ping_beneficiary'])
    const get = (k: string) => { const v = (st ?? []).find(r => r.key === k)?.value; return typeof v === 'string' ? v : '' }
    setBank({ iban: formatIban(get('ping_iban')), bic: get('ping_bic'), beneficiary: get('ping_beneficiary') })
  }
  useEffect(() => { load() }, [all]) // eslint-disable-line react-hooks/exhaustive-deps

  async function saveBank() {
    const iban = cleanIban(bank.iban)
    if (iban && !ibanValid(iban)) { setMsg('IBAN de PING invalide.'); return }
    if (!bicValid(bank.bic)) { setMsg('BIC invalide.'); return }
    const now = new Date().toISOString()
    const { error } = await db.from('app_settings').upsert([
      { key: 'ping_iban', value: iban, updated_at: now },
      { key: 'ping_bic', value: bank.bic.trim().toUpperCase(), updated_at: now },
      { key: 'ping_beneficiary', value: bank.beneficiary.trim() || 'PING', updated_at: now },
    ], { onConflict: 'key' })
    setMsg(error ? 'Enregistrement impossible : ' + error.message : 'Coordonnées bancaires de PING enregistrées : elles s’affichent aux clients et aux prestataires sous leurs factures.')
  }

  async function received(t: Row) {
    if (!confirm(`Noter reçu le virement ${t.reference} de ${eur(t.amount_cents)} ? Vérifiez d’abord qu’il apparaît sur le relevé du compte PING.`)) return
    setBusy(t.id)
    const { error } = await db.from('transfer_payments').update({ status: 'recu' }).eq('id', t.id)
    setBusy(''); setMsg(error ? 'Échec : ' + error.message : `${t.reference} noté reçu.`)
    load()
  }

  const inp = { border: '1.5px solid #E7EDEB', borderRadius: 9, padding: '8px 10px', fontSize: 12.5, fontFamily: 'Inter, sans-serif', width: '100%', boxSizing: 'border-box' as const }
  const total = (rows ?? []).filter(t => t.payee === 'ping' && t.status !== 'recu').reduce((s, t) => s + t.amount_cents, 0)
  return (
    <div style={{ background: '#fff', border: '1px solid #E7EDEB', borderRadius: 14, padding: 16, marginBottom: 14 }}>
      <b style={{ fontFamily: 'Quicksand, sans-serif', fontSize: 16 }}>Virements SEPA · mode de paiement actuel</b>
      <p style={{ fontSize: 12.5, color: '#4E6470', lineHeight: 1.55, margin: '4px 0 10px' }}>
        Le client vire la prestation directement au prestataire, et ses frais de service à PING ; le prestataire vire sa commission à PING.
        Notez « Reçu » ce qui arrive sur le compte PING. Une commission non reçue 15 jours après la facture passe « en retard » et devient une
        dette (relance automatique chaque matin) ; au-delà du plafond d’impayés, le compte du prestataire est suspendu.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
        <input style={inp} placeholder="Bénéficiaire (ex. OpConsult)" value={bank.beneficiary} onChange={e => setBank({ ...bank, beneficiary: e.target.value })} />
        <input style={{ ...inp, fontFamily: 'ui-monospace, monospace' }} placeholder="IBAN de PING" value={bank.iban} onChange={e => setBank({ ...bank, iban: formatIban(e.target.value) })} />
        <input style={inp} placeholder="BIC" value={bank.bic} onChange={e => setBank({ ...bank, bic: e.target.value.toUpperCase().replace(/\s/g, '') })} />
      </div>
      <button onClick={saveBank} style={{ ...btn('#123644'), marginTop: 8 }}>Enregistrer les coordonnées de PING</button>
      {!cleanIban(bank.iban) && <p style={{ fontSize: 12, color: '#9A6712', margin: '8px 0 0' }}>IBAN de PING non renseigné : clients et prestataires voient « coordonnées communiquées prochainement ».</p>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, margin: '16px 0 6px', flexWrap: 'wrap' }}>
        <b style={{ fontSize: 13.5 }}>{all ? 'Tous les virements' : `À rapprocher sur le compte PING · ${eur(total)}`}</b>
        <label style={{ fontSize: 12, color: '#4E6470', display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={all} onChange={e => setAll(e.target.checked)} /> afficher aussi les reçus et les prestations
        </label>
      </div>
      {msg && <p style={{ fontSize: 12, color: '#123644', background: '#F3F6F5', borderRadius: 8, padding: '7px 10px' }}>{msg}</p>}
      {!rows ? <p style={{ fontSize: 12.5, color: '#4E6470' }}>Chargement…</p> : rows.length === 0 ? (
        <p style={{ fontSize: 12.5, color: '#4E6470' }}>Rien à rapprocher.</p>
      ) : rows.map(t => {
        const s = TRANSFER_STATUS[t.status]
        return (
          <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderTop: '1px solid #E7EDEB', fontSize: 12.5, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 260px' }}>
              <div style={{ fontWeight: 700 }}>{t.reference} · {eur(t.amount_cents)}</div>
              <div style={{ color: '#4E6470', fontSize: 11.5 }}>
                {t.invoices?.client_snapshot?.nom || 'Payeur'} · {t.payee === 'pro' ? 'prestation, au prestataire' : t.payer_role === 'client' ? 'frais de service client' : 'commission prestataire'}
                {' · échéance '}{new Date(t.due_at).toLocaleDateString('fr-FR')}
                {t.declared_at && ` · annoncé le ${new Date(t.declared_at).toLocaleDateString('fr-FR')}`}
              </div>
            </div>
            <span style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: s.bg, color: s.fg }}>{s.t}</span>
            {t.payee === 'ping' && t.status !== 'recu' && (
              <button disabled={busy === t.id} onClick={() => received(t)} style={btn('#0C8F7E')}>Reçu</button>
            )}
            <a href={`/mission/${t.transaction_id}/facture`} style={{ fontSize: 12, fontWeight: 700, color: '#0C8F7E' }}>Mission</a>
          </div>
        )
      })}
    </div>
  )
}

export default function AdminPaiementsPage() {
  const [d, setD] = useState<Data | null>(null)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState('')

  async function load() {
    const r = await fetch('/api/payments/admin')
    setD(await r.json().catch(() => null))
  }
  useEffect(() => { load() }, [])

  async function act(path: string, body: Record<string, unknown>, confirmText: string) {
    if (!confirm(confirmText)) return
    setBusy(String(body.transactionId ?? body.providerId ?? body.alertId)); setMsg('')
    const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const j = await r.json().catch(() => ({}))
    setMsg(r.ok ? JSON.stringify(j) : (j.error || 'Échec'))
    setBusy('')
    load()
  }

  function refund(m: Mission) {
    const v = prompt(`Montant à rembourser au client (en €, payé : ${eur(m.payeCents)}). Laisser vide = tout.`, '')
    if (v === null) return
    const cents = v.trim() ? Math.round(Number(v.replace(',', '.')) * 100) : undefined
    if (cents !== undefined && !(cents > 0)) { setMsg('Montant invalide'); return }
    act('/api/payments/refund', { transactionId: m.id, montantCents: cents, motif: 'Décision PING' }, `Rembourser ${cents ? eur(cents) : 'la totalité'} au client ?`)
  }

  const box = { background: '#fff', border: '1px solid #E7EDEB', borderRadius: 14, padding: 16, marginBottom: 14 }
  if (!d) return <div style={{ padding: 40, fontFamily: 'Inter, sans-serif', color: '#4E6470' }}>Chargement…</div>
  if (d.error || !d.reglage) return (
    <div style={{ minHeight: '100vh', background: '#F3F6F5', fontFamily: 'Inter, sans-serif', color: '#123644', padding: '28px 16px 60px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <h1 style={{ fontFamily: 'Quicksand, sans-serif', fontSize: 24, margin: '0 0 12px' }}>Paiements</h1>
        <Virements />
        <p style={{ fontSize: 12.5, color: '#c0503a' }}>Séquestre : {d.error || 'indisponible'}</p>
      </div>
    </div>
  )
  const r = d.reglage

  return (
    <div style={{ minHeight: '100vh', background: '#F3F6F5', fontFamily: 'Inter, sans-serif', color: '#123644', padding: '28px 16px 60px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <h1 style={{ fontFamily: 'Quicksand, sans-serif', fontSize: 24, margin: '0 0 12px' }}>Paiements</h1>
        <Virements />
        <h2 style={{ fontFamily: 'Quicksand, sans-serif', fontSize: 18, margin: '18px 0 4px' }}>Séquestre (paiement en ligne, en suspens)</h2>
        <p style={{ fontSize: 13, color: '#4E6470', margin: '0 0 18px' }}>
          L&apos;argent des clients reste chez le partenaire de paiement. Il n&apos;en sort que sur décision de PING :
          {d.auto === false ? ' versement manuel, mission par mission (mode « manuel »).' : ` versement automatique ${d.delaiHeures ?? 24} h après la fin sans litige, ou manuel ci-dessous.`}
        </p>

        <div style={box}>
          <b style={{ fontFamily: 'Quicksand, sans-serif' }}>Réglage {r.actif ? <span style={{ color: '#0C8F7E' }}>· actif ({r.actif})</span> : <span style={{ color: '#9A6712' }}>· éteint</span>}</b>
          <ul style={{ fontSize: 12.5, color: '#4E6470', lineHeight: 1.8, margin: '8px 0 0', paddingLeft: 18 }}>
            <li>PAYMENT_PROVIDER : {r.choisi || 'non choisi'}</li>
            {r.prestataires.map(p => <li key={p.nom}>{p.label} : clés {p.cles ? 'renseignées' : 'absentes'}</li>)}
            <li>SUPABASE_SERVICE_ROLE_KEY : {r.cleService ? 'renseignée' : 'absente'}</li>
            <li>CRON_SECRET : {r.cron ? 'renseigné' : 'absent'}</li>
          </ul>
        </div>

        {d.pareFeu === null && (
          <div style={box}><span style={{ fontSize: 13, color: '#9A6712' }}>Pare-feu des commissions inactif : clé service Supabase absente côté serveur.</span></div>
        )}
        {d.pareFeu && (
          <div style={box}>
            <b style={{ fontFamily: 'Quicksand, sans-serif' }}>Pare-feu des commissions</b>
            <p style={{ fontSize: 12.5, color: '#4E6470', margin: '6px 0 10px', lineHeight: 1.55 }}>
              Mandat révoqué, prélèvement rejeté ou opposition : une alerte arrive ici, la commission devient une dette
              retenue sur le prochain versement. Au-delà de {eur(d.pareFeu.plafondCents)} d&apos;impayés (réglable, clé
              <code> unpaid_ceiling_cents</code>), le compte est suspendu : retiré de la carte, plus aucun versement.
            </p>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#4E6470', textTransform: 'uppercase', letterSpacing: '.04em', margin: '10px 0 6px' }}>Prestataires suspendus</div>
            {d.pareFeu.suspendus.length === 0 ? <div style={{ fontSize: 13, color: '#4E6470' }}>Aucun.</div> : d.pareFeu.suspendus.map(x => (
              <div key={x.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap', padding: '8px 0', borderTop: '1px solid #E7EDEB' }}>
                <div style={{ fontSize: 13 }}>
                  <b>{x.nom}</b> · depuis le {new Date(x.payments_suspended_at).toLocaleDateString('fr-FR')} · dette {eur(x.detteCents)}
                  {x.motif && <div style={{ fontSize: 12, color: '#4E6470' }}>{x.motif}</div>}
                </div>
                <button disabled={busy === x.id} style={btn('#12B39C')}
                  onClick={() => act('/api/payments/admin', { action: 'unsuspend', providerId: x.id }, `Lever la suspension de ${x.nom} ?`)}>Lever la suspension</button>
              </div>
            ))}
            <div style={{ fontSize: 12, fontWeight: 700, color: '#4E6470', textTransform: 'uppercase', letterSpacing: '.04em', margin: '14px 0 6px' }}>Alertes à traiter</div>
            {d.pareFeu.alertes.length === 0 ? <div style={{ fontSize: 13, color: '#4E6470' }}>Aucune.</div> : d.pareFeu.alertes.map(a => (
              <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap', padding: '8px 0', borderTop: '1px solid #E7EDEB' }}>
                <div style={{ fontSize: 13 }}>
                  <b style={{ color: ['suspended', 'chargeback', 'debit_rejected', 'mandate_revoked'].includes(a.kind) ? '#c0503a' : '#123644' }}>{KIND[a.kind] || a.kind}</b>
                  {' · '}{a.provider_id ? a.nom : 'prestataire non retrouvé'} · {new Date(a.created_at).toLocaleString('fr-FR')}
                  {a.detail?.amountCents ? <span> · {eur(a.detail.amountCents)}</span> : null}
                  {a.detail?.reason && <div style={{ fontSize: 12, color: '#4E6470' }}>{a.detail.reason}</div>}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {a.provider_id && !['suspended', 'unsuspended'].includes(a.kind) && (
                    <button disabled={busy === a.provider_id} style={btn('#c0503a')}
                      onClick={() => act('/api/payments/admin', { action: 'suspend', providerId: a.provider_id, reason: KIND[a.kind] || a.kind }, `Suspendre ${a.nom} (retrait de la carte, versements bloqués) ?`)}>Suspendre</button>
                  )}
                  <button disabled={busy === a.id} style={btn('#4E6470')}
                    onClick={() => act('/api/payments/admin', { action: 'handled', alertId: a.id }, 'Marquer cette alerte comme traitée ?')}>Traitée</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {msg && <div style={{ ...box, fontSize: 12, color: '#4E6470', wordBreak: 'break-all' }}>{msg}</div>}

        {r.actif && (d.missions.length === 0 ? (
          <div style={box}><span style={{ fontSize: 13, color: '#4E6470' }}>Aucun argent bloqué en ce moment.</span></div>
        ) : d.missions.map(m => (
          <div key={m.id} style={box}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <b style={{ fontFamily: 'monospace', fontSize: 13 }}>{m.id.slice(0, 8).toUpperCase()}</b>
              <span style={{ fontSize: 12, fontWeight: 700, color: m.alerte || m.litige ? '#c0503a' : '#0C8F7E' }}>
                {STATUT[m.payment_status] || m.payment_status}{m.litige ? ' · litige ouvert' : ''}{m.status === 'cancelled' ? ' · annulée' : ''}
              </span>
            </div>
            <div style={{ fontSize: 12.5, color: '#4E6470', marginTop: 6, lineHeight: 1.6 }}>
              Payé {eur(m.payeCents)} · total {eur(m.total_charged_cents)} · part prestataire {eur(m.payout_cents)}
              {' · '}{m.completed_at ? `terminée le ${new Date(m.completed_at).toLocaleString('fr-FR')}` : m.arrived_at ? 'en cours' : m.en_route_at ? 'prestataire en route' : 'à venir'}
              {m.alerte && <div style={{ color: '#c0503a', fontWeight: 600 }}>Alerte : {m.alerte}</div>}
            </div>
            {m.payeCents > 0 && (
              <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                {(m.completed_at || m.status === 'cancelled') && !m.litige && (
                  <button disabled={busy === m.id} style={btn('#12B39C')}
                    onClick={() => act('/api/payments/release', { transactionId: m.id, immediat: true },
                      m.status === 'cancelled' ? `Verser ${eur(m.payeCents)} (frais d'annulation) au prestataire ?` : `Verser ${eur(m.payout_cents)} au prestataire maintenant ?`)}>
                    Verser au prestataire
                  </button>
                )}
                <button disabled={busy === m.id} style={btn('#123644')} onClick={() => refund(m)}>Rembourser le client</button>
              </div>
            )}
          </div>
        )))}
      </div>
    </div>
  )
}
