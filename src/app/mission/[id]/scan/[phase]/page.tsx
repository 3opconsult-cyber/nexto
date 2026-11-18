"use client"
import { useEffect, useState } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { trackEvent } from '@/lib/tracking'
import { billedHours, getHourThreshold, getRates } from '@/lib/pricing'
import { EUR } from '@/lib/invoice-pdf'
import { systemSender } from '@/lib/systemMessage'
import { PRESENCE_WARNING, durLabel, presenceAvailable, validatePresence } from '@/lib/presence'

// Écran ouvert par le QR du client quand le prestataire le scanne avec l'appareil photo de son téléphone
// (le scanner intégré de « Mission du jour » fait la même chose sans quitter l'application).
// Migration 038 : la preuve est vérifiée en base (validate_presence / arrive_with_onsite_token), qui calcule la
// durée et le montant et pose le message du fil. Sans 038 : ancien fonctionnement (jeton de la mission comparé
// ici, écriture directe). Plus aucun relevé GPS au scan (invariant : GPS seulement pour « client absent »).
export default function ScanQR() {
  const params = useParams<{ id: string; phase: string }>()
  const search = useSearchParams()
  const router = useRouter()
  const token = search.get('token') || ''
  const [status, setStatus] = useState<'checking' | 'ok' | 'error'>('checking')
  const [message, setMessage] = useState('Vérification du code…')
  const [detail, setDetail] = useState<string | null>(null)

  useEffect(() => {
    async function run() {
      const supabase = createClient()
      // Scanné avec l'appareil photo du téléphone : le navigateur n'est pas forcément connecté.
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        const here = window.location.pathname + window.location.search
        router.replace(`/auth/login?next=${encodeURIComponent(here)}`)
        return
      }
      const { data: tx } = await supabase.from('transactions').select('*').eq('id', params.id).maybeSingle()

      if (!tx) { setStatus('error'); setMessage('Mission introuvable pour ce compte. Connectez-vous avec le compte du prestataire de la mission.'); return }
      if (tx.status === 'cancelled') { setStatus('error'); setMessage('Cette réservation a été annulée.'); return }
      const v2 = await presenceAvailable(supabase)

      // Voie A : QR laissé sur place par le client (RPC, prestataire seul, jeton à usage unique).
      if (params.phase === 'onsite') {
        if (tx.arrived_at) { setStatus('ok'); setMessage('Arrivée déjà enregistrée.'); return }
        const { error: rpcErr } = await supabase.rpc('arrive_with_onsite_token', { p_transaction: tx.id, p_token: token })
        if (rpcErr) { setStatus('error'); setMessage(rpcErr.message || 'Code invalide ou déjà utilisé.'); return }
        setStatus('ok'); setMessage('Arrivée validée.' + (tx.hourly_rate_cents ? ' Le temps commence à courir.' : ''))
        if (!v2) {
          await supabase.from('messages').insert({
            transaction_id: tx.id, ...(await systemSender(supabase)),
            body: `✓ Arrivée validée à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} — QR laissé sur place par le client${tx.hourly_rate_cents ? ' — le chrono démarre' : ''}`,
          })
        }
        trackEvent('qr_scan_arrival', { transaction_id: tx.id, method: 'qr_sur_place' })
        return
      }

      const isArrival = params.phase === 'arrival'
      if (!isArrival && params.phase !== 'complete') { setStatus('error'); setMessage('Code inconnu.'); return }

      if (v2) {
        const r = await validatePresence(supabase, tx.id, isArrival ? 'arrivee' : 'fin', token)
        if (!r.ok) { setStatus('error'); setMessage(r.message || 'Code invalide ou expiré.'); return }
        if (r.already) { setStatus('ok'); setMessage(isArrival ? 'Arrivée déjà enregistrée.' : 'Fin déjà enregistrée.'); return }
        setStatus('ok')
        setMessage((isArrival ? 'Arrivée validée.' : 'Fin validée.') + (isArrival && tx.hourly_rate_cents ? ' Le temps commence à courir.' : ''))
        if (!isArrival && r.duration_minutes != null) {
          setDetail(`${durLabel(Number(r.duration_minutes))} sur place${r.subtotal_cents != null ? ` · prestation ${EUR(Number(r.subtotal_cents))}` : ''}`)
        }
        if (r.warning && PRESENCE_WARNING[r.warning]) setMessage(m => `${m} ${PRESENCE_WARNING[r.warning as string]}`)
        trackEvent(isArrival ? 'qr_scan_arrival' : 'qr_scan_complete', { transaction_id: tx.id, method: 'qr' })
        return
      }

      // ---------- Repli : migration 038 absente (ancien fonctionnement, sans GPS) ----------
      const expectedToken = isArrival ? tx.qr_arrival_token : tx.qr_complete_token
      if (token !== expectedToken) { setStatus('error'); setMessage('Code invalide ou déjà utilisé.'); return }

      if (isArrival) {
        if (tx.arrived_at) { setStatus('ok'); setMessage('Arrivée déjà enregistrée.'); return }
        // Le trigger refuse ce write à tout autre compte que le prestataire : vérifier qu'une ligne est revenue.
        const { data: updated, error } = await supabase.from('transactions')
          .update({ arrived_at: new Date().toISOString(), status: 'arrived' }).eq('id', tx.id).select().maybeSingle()
        if (error || !updated) { setStatus('error'); setMessage('Ce code doit être scanné depuis le compte du prestataire assigné à cette mission.'); return }
        setStatus('ok'); setMessage('Arrivée validée.' + (tx.hourly_rate_cents ? ' Le temps commence à courir.' : ''))
        await supabase.from('messages').insert({
          transaction_id: tx.id, ...(await systemSender(supabase)),
          body: `✓ Arrivée scannée à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}${tx.hourly_rate_cents ? ' — le chrono démarre' : ''}`,
        })
        trackEvent('qr_scan_arrival', { transaction_id: tx.id })
        return
      }

      if (!tx.arrived_at) { setStatus('error'); setMessage("L'arrivée n'a pas encore été validée — impossible de clôturer."); return }
      if (tx.completed_at) { setStatus('ok'); setMessage('Sortie déjà enregistrée.'); return }
      const now = new Date()
      const mins = Math.max(0, Math.round((now.getTime() - new Date(tx.arrived_at).getTime()) / 60000))
      const updates: Record<string, unknown> = { completed_at: now.toISOString(), status: 'completed', duration_minutes: mins }
      if (tx.hourly_rate_cents) {
        const threshold = await getHourThreshold()
        const live = await getRates()
        const rates = tx.subtotal_cents > 0
          ? { buyer: (tx.buyer_fee_cents ?? 0) / tx.subtotal_cents, seller: (tx.seller_fee_cents ?? 0) / tx.subtotal_cents }
          : live
        const subtotal = tx.base_forfait_cents != null && tx.included_hours != null
          ? tx.base_forfait_cents + tx.hourly_rate_cents * billedHours(Math.max(0, mins - tx.included_hours * 60), threshold)
          : tx.hourly_rate_cents * Math.max(1, billedHours(mins, threshold))
        const buyerFee = Math.round(subtotal * rates.buyer)
        const sellerFee = Math.round(subtotal * rates.seller)
        Object.assign(updates, {
          subtotal_cents: subtotal, buyer_fee_cents: buyerFee, seller_fee_cents: sellerFee,
          total_charged_cents: subtotal + buyerFee, payout_cents: subtotal - sellerFee,
        })
      }
      const { data: updated, error } = await supabase.from('transactions').update(updates).eq('id', tx.id).select().maybeSingle()
      if (error || !updated) { setStatus('error'); setMessage('Ce code doit être scanné depuis le compte du prestataire assigné à cette mission.'); return }
      const finalSubtotal = (updates.subtotal_cents as number | undefined) ?? tx.subtotal_cents ?? 0
      setStatus('ok'); setMessage('Sortie validée.'); setDetail(`${durLabel(mins)} sur place · prestation ${EUR(finalSubtotal)}`)
      await supabase.from('messages').insert({
        transaction_id: tx.id, ...(await systemSender(supabase)),
        body: `✓ Sortie scannée à ${now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} — ${durLabel(mins)}, prestation ${EUR(finalSubtotal)}`,
      })
      trackEvent('qr_scan_complete', { transaction_id: tx.id, duration_minutes: mins })
    }
    run()
  }, [params.id, params.phase, token, router])

  const done = status === 'ok' && params.phase === 'complete'
  return (
    <div style={{ minHeight: '100vh', background: '#F3F6F5', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: 'Inter, sans-serif' }}>
      <div style={{ background: '#fff', border: '1px solid #DCE5E3', borderRadius: 20, padding: 28, maxWidth: 360, width: '100%', textAlign: 'center' }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%', margin: '0 auto 16px', display: 'grid', placeItems: 'center',
          background: status === 'ok' ? 'rgba(18,179,156,.12)' : status === 'error' ? 'rgba(255,122,102,.12)' : '#F3F6F5',
        }}>
          {status === 'ok' && <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0C8F7E" strokeWidth="2.6" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>}
          {status === 'error' && <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#B3402F" strokeWidth="2.6" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>}
          {status === 'checking' && <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#12B39C', animation: 'pingPulse 1.4s ease-in-out infinite' }} />}
        </div>
        <h1 style={{ fontFamily: 'Quicksand, sans-serif', fontSize: 17, color: '#123644' }}>{message}</h1>
        {detail && (
          <div style={{ marginTop: 14, padding: 12, borderRadius: 12, background: '#F3F6F5' }}>
            <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 16, color: '#123644' }}>{detail}</div>
            <div style={{ fontSize: 10.5, color: '#4E6470', marginTop: 4 }}>Ce relevé fait foi en cas de litige.</div>
          </div>
        )}
        {status !== 'checking' && (
          <>
            <button onClick={() => router.push(done ? `/mission/${params.id}/facture` : `/mission/${params.id}/jour`)}
              style={{ width: '100%', marginTop: 18, padding: 13, borderRadius: 999, border: 'none', background: '#12B39C', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }}>
              {done ? 'Voir la facture' : 'Mission du jour'}
            </button>
            <button onClick={() => router.push(`/mission/${params.id}/chat`)}
              style={{ width: '100%', marginTop: 8, padding: 12, borderRadius: 999, border: '1.5px solid #DCE5E3', background: '#fff', color: '#123644', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              Retour à la conversation
            </button>
          </>
        )}
      </div>
    </div>
  )
}
