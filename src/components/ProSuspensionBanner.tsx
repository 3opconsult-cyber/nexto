"use client"
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// Bandeau « compte suspendu » (pare-feu des commissions, migration 019) : le prestataire voit pourquoi
// il n'apparaît plus sur la carte et ne reçoit plus de versement, et comment régulariser.
export default function ProSuspensionBanner() {
  const [s, setS] = useState<{ since: string; reason: string | null; debt: number } | null>(null)
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: pp } = await supabase.from('provider_profiles').select('payments_suspended_at').eq('id', user.id).maybeSingle()
      if (!pp?.payments_suspended_at) return
      const [{ data: priv }, { data: debts }] = await Promise.all([
        supabase.from('provider_private').select('suspension_reason').eq('id', user.id).maybeSingle(),
        supabase.from('commission_debts').select('amount_cents').eq('provider_id', user.id).eq('status', 'open'),
      ])
      setS({ since: pp.payments_suspended_at, reason: priv?.suspension_reason ?? null, debt: (debts ?? []).reduce((t, d) => t + d.amount_cents, 0) })
    })
  }, [])
  if (!s) return null
  return (
    <div role="alert" style={{ background: 'rgba(192,80,58,.08)', border: '1.5px solid rgba(192,80,58,.35)', borderRadius: 14, padding: 14, marginBottom: 14 }}>
      <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 14, color: '#a8402c' }}>Compte suspendu depuis le {new Date(s.since).toLocaleDateString('fr-FR')}</div>
      <p style={{ fontSize: 12.5, color: '#123644', lineHeight: 1.55, margin: '6px 0 0' }}>
        {s.reason || 'Une commission PING reste impayée.'}
        {s.debt > 0 && <> Montant dû : <b>{(s.debt / 100).toFixed(2).replace('.', ',')} €</b>.</>}
        {' '}Vous n&apos;apparaissez plus sur la carte et aucun versement n&apos;est effectué tant que la situation n&apos;est pas régularisée.
      </p>
      <a href="/support" style={{ display: 'inline-block', marginTop: 8, fontSize: 12.5, fontWeight: 700, color: '#0C8F7E' }}>Régulariser avec le support PING</a>
    </div>
  )
}
