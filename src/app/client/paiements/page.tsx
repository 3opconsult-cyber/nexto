"use client"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import BackHeader from '@/components/BackHeader'
import { EUR } from '@/lib/invoice-pdf'
import { TRANSFER_STATUS, transferDue, transferState, type Transfer } from '@/lib/transfers'

// Écran « Paiements » du particulier (maquette : Comment vous payez / À régler / Réglé / Pourboires annoncés).
// Alimenté par les virements existants (transfer_payments, payer_role = client) : aucun calcul ni règle de
// paiement nouveau. Séquestre éteint : le client vire la prestation au prestataire et ses frais à PING.
const card: React.CSSProperties = { background: '#fff', border: '1px solid #E7EDEB', borderRadius: 16, overflow: 'hidden' }
const hubt: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: '#4E6470', textTransform: 'uppercase', letterSpacing: '.04em', margin: '18px 0 8px 2px' }
const dShort = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })

export default function ClientPaiements() {
  const router = useRouter()
  const [rows, setRows] = useState<Transfer[] | null>(null)
  const [names, setNames] = useState<Record<string, string>>({})
  const [tips, setTips] = useState<Array<{ transaction_id: string; tip_cents: number }>>([])

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      const { data } = await supabase.from('transfer_payments').select('*').eq('payer_id', user.id).eq('payer_role', 'client').order('due_at')
      const list = (data ?? []) as Transfer[]
      setRows(list)
      const { data: rv } = await supabase.from('reviews').select('transaction_id, tip_cents').eq('rater_id', user.id).gt('tip_cents', 0)
      const tp = (rv ?? []) as Array<{ transaction_id: string; tip_cents: number }>
      setTips(tp)
      const ids = Array.from(new Set([...list.map(t => t.transaction_id), ...tp.map(t => t.transaction_id)]))
      if (ids.length) {
        const { data: nrows } = await supabase.rpc('transaction_counterparts', { p_transaction_ids: ids })
        const map: Record<string, string> = {}
        ;(nrows ?? []).forEach((r: any) => { if (r.full_name) map[r.transaction_id] = r.full_name })
        setNames(map)
      }
    }
    load()
  }, [router])

  const due = (rows ?? []).filter(t => t.status !== 'recu')
  const done = (rows ?? []).filter(t => t.status === 'recu')
  const who = (t: Transfer) => t.payee === 'ping' ? 'PING' : names[t.transaction_id] || 'Prestataire'
  const go = (t: Transfer) => router.push(`/mission/${t.transaction_id}/facture`)

  return (
    <div style={{ minHeight: '100vh', background: '#F3F6F5', fontFamily: 'Inter, sans-serif', paddingBottom: 90 }}>
      <BackHeader title="Paiements" fallback="/client/profil" />
      <div style={{ padding: 16 }}>
        <div style={{ ...card, padding: 16 }}>
          <h2 style={{ margin: 0, fontFamily: 'Quicksand, sans-serif', fontSize: 15, fontWeight: 700, color: '#123644' }}>Comment vous payez</h2>
          <p style={{ color: '#4E6470', fontSize: 13, lineHeight: 1.5, margin: '6px 0 0' }}>Vous virez la prestation directement au prestataire, avec la référence de la facture. Vos frais de service sont virés à PING. Le paiement en ligne n&apos;est pas encore branché.</p>
        </div>

        <div style={hubt}>À régler</div>
        <div style={card}>
          {rows === null && <div style={{ padding: 16, fontSize: 12.5, color: '#4E6470' }}>Chargement…</div>}
          {rows !== null && due.length === 0 && <div style={{ padding: 16, fontSize: 12.5, color: '#4E6470' }}>Rien à régler.</div>}
          {due.map((t, i) => {
            const s = transferState(t)
            const late = s === 'en_retard'
            const open = s === 'a_payer' || late
            const st = TRANSFER_STATUS[s]
            return (
              <div key={t.id} onClick={() => go(t)} role="link" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') go(t) }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 56, padding: '12px 14px', borderTop: i ? '1px solid #EEF2F1' : 'none', cursor: 'pointer' }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ display: 'block', fontSize: 13.5, color: '#123644' }}>{t.reference} · {EUR(transferDue(t))}</b>
                  <small style={{ color: '#4E6470', fontSize: 12 }}>{who(t)} · {t.payee === 'ping' ? 'frais de service, à PING' : 'prestation, au prestataire'} · {t.suspended_at ? 'suspendu : litige ouvert' : `avant le ${dShort(t.due_at)}`}</small>
                </span>
                {open && !t.suspended_at
                  ? <span style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center', padding: '0 16px', borderRadius: 999, background: '#0B8374', color: '#fff', fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap' }}>{late ? 'En retard · régler' : 'Régler'}</span>
                  : <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 999, background: st.bg, color: st.fg, whiteSpace: 'nowrap' }}>{st.t}</span>}
              </div>
            )
          })}
        </div>

        {tips.length > 0 && <>
          <div style={hubt}>Pourboires annoncés</div>
          <div style={card}>
            {tips.map((t, i) => (
              <div key={t.transaction_id + i} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 56, padding: '12px 14px', borderTop: i ? '1px solid #EEF2F1' : 'none' }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ display: 'block', fontSize: 13.5, color: '#123644' }}>{EUR(t.tip_cents)} pour {names[t.transaction_id] || 'le prestataire'}</b>
                  <small style={{ color: '#4E6470', fontSize: 12 }}>intention, non prélevée : le paiement en ligne n&apos;est pas encore ouvert, remettez-le directement</small>
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 999, background: '#EEF2F1', color: '#4E6470' }}>Annoncé</span>
              </div>
            ))}
          </div>
        </>}

        <div style={hubt}>Réglé</div>
        <div style={card}>
          {rows !== null && done.length === 0 && <div style={{ padding: 16, fontSize: 12.5, color: '#4E6470' }}>Aucun règlement pour l&apos;instant.</div>}
          {done.map((t, i) => (
            <div key={t.id} onClick={() => go(t)} role="link" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') go(t) }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 56, padding: '12px 14px', borderTop: i ? '1px solid #EEF2F1' : 'none', cursor: 'pointer' }}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <b style={{ display: 'block', fontSize: 13.5, color: '#123644' }}>{t.reference} · {EUR(transferDue(t))}</b>
                <small style={{ color: '#4E6470', fontSize: 12 }}>{who(t)}</small>
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 999, background: TRANSFER_STATUS.recu.bg, color: TRANSFER_STATUS.recu.fg }}>{TRANSFER_STATUS.recu.t}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
