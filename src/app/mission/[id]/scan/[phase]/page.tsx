"use client"
import { useEffect, useState } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { trackEvent } from '@/lib/tracking'
import { billedHours, getHourThreshold, getRates } from '@/lib/pricing'
import { distanceKm, getOneShotPosition } from '@/lib/geo'

// Double sécurité demandée par Romain : au scan, un relevé GPS ponctuel
// (jamais de suivi continu) comparé à l'adresse du rendez-vous. Ne bloque
// jamais le scan — beaucoup refusent la permission ou sont en intérieur
// sans signal — juste une note horodatée en cas de litige.
async function gpsNote(reqLat?: number | null, reqLng?: number | null): Promise<string> {
  if (reqLat == null || reqLng == null) return ''
  const pos = await getOneShotPosition()
  if (!pos) return ''
  const km = distanceKm(pos.lat, pos.lng, reqLat, reqLng)
  return km > 0.3 ? ` · position GPS à ${km.toFixed(1)} km de l'adresse` : ' · position GPS conforme'
}

export default function ScanQR() {
  const params = useParams<{ id: string; phase: string }>()
  const search = useSearchParams()
  const router = useRouter()
  const token = search.get('token') || ''
  const [status, setStatus] = useState<'checking' | 'ok' | 'error'>('checking')
  const [message, setMessage] = useState('Vérification du code…')
  const [duration, setDuration] = useState<string | null>(null)

  useEffect(() => {
    async function run() {
      const supabase = createClient()
      const { data: tx } = await supabase.from('transactions').select('*, requests(lat, lng)').eq('id', params.id).single()

      if (!tx) { setStatus('error'); setMessage('Mission introuvable.'); return }

      const isArrival = params.phase === 'arrival'
      const expectedToken = isArrival ? tx.qr_arrival_token : tx.qr_complete_token

      if (token !== expectedToken) {
        setStatus('error'); setMessage('Code invalide ou déjà utilisé.'); return
      }

      if (isArrival) {
        if (tx.arrived_at) { setStatus('ok'); setMessage('Arrivée déjà enregistrée.'); return }
        // La base refuse ce write si le compte connecté n'est pas le prestataire
        // assigné (trigger `enforce_arrival_departure_by_seller`, migration 011) —
        // donc il faut vérifier qu'une ligne est vraiment revenue, pas juste
        // l'absence d'exception : un refus RLS silencieux ne renvoie pas d'erreur,
        // juste 0 ligne modifiée.
        const { data: updated, error } = await supabase.from('transactions')
          .update({ arrived_at: new Date().toISOString(), status: 'arrived' }).eq('id', tx.id).select().maybeSingle()
        if (error || !updated) {
          setStatus('error')
          setMessage("Ce code doit être scanné depuis le compte du prestataire assigné à cette mission.")
          return
        }
        setStatus('ok'); setMessage('Arrivée validée.')
        if (tx.hourly_rate_cents) setMessage(m => m + ' Le temps commence à courir.')
        const now = new Date()
        const gps = await gpsNote(tx.requests?.lat, tx.requests?.lng)
        await supabase.from('messages').insert({
          transaction_id: tx.id, sender_id: null,
          body: `✓ Arrivée scannée à ${now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}${tx.hourly_rate_cents ? ' — le chrono démarre' : ''}${gps}`,
        })
        trackEvent('qr_scan_arrival', { transaction_id: tx.id })
      } else {
        if (!tx.arrived_at) { setStatus('error'); setMessage("L'arrivée n'a pas encore été scannée — impossible de clôturer."); return }
        if (tx.completed_at) { setStatus('ok'); setMessage('Sortie déjà enregistrée.'); return }
        const now = new Date()
        const mins = Math.max(0, Math.round((now.getTime() - new Date(tx.arrived_at).getTime()) / 60000))

        const updates: Record<string, unknown> = {
          completed_at: now.toISOString(), status: 'completed', duration_minutes: mins,
        }
        if (tx.hourly_rate_cents) {
          // Heure entamée = heure due au-delà du seuil réglé dans l'admin (15 min par défaut).
          // Taux de commission : ceux figés à la réservation (jamais le réglage du jour).
          const threshold = await getHourThreshold()
          const live = await getRates()
          const rates = tx.subtotal_cents > 0
            ? { buyer: (tx.buyer_fee_cents ?? 0) / tx.subtotal_cents, seller: (tx.seller_fee_cents ?? 0) / tx.subtotal_cents }
            : live
          let subtotal: number
          if (tx.base_forfait_cents != null && tx.included_hours != null) {
            // Forfait + dépassement : le forfait est dû en entier, seules les heures au-delà de celles
            // incluses sont facturées au tarif de dépassement (jamais l'inverse).
            const overtime = billedHours(Math.max(0, mins - tx.included_hours * 60), threshold)
            subtotal = tx.base_forfait_cents + tx.hourly_rate_cents * overtime
          } else {
            // Horaire pur : au moins une heure dès que le prestataire s'est déplacé.
            subtotal = tx.hourly_rate_cents * Math.max(1, billedHours(mins, threshold))
          }
          const buyerFee = Math.round(subtotal * rates.buyer)
          const sellerFee = Math.round(subtotal * rates.seller)
          updates.subtotal_cents = subtotal
          updates.buyer_fee_cents = buyerFee
          updates.seller_fee_cents = sellerFee
          updates.total_charged_cents = subtotal + buyerFee
          updates.payout_cents = subtotal - sellerFee
        }
        const { data: updated, error } = await supabase.from('transactions').update(updates).eq('id', tx.id).select().maybeSingle()
        if (error || !updated) {
          setStatus('error')
          setMessage("Ce code doit être scanné depuis le compte du prestataire assigné à cette mission.")
          return
        }

        const h = Math.floor(mins / 60), m = mins % 60
        setDuration(`${h > 0 ? h + ' h ' : ''}${m} min`)
        setStatus('ok'); setMessage('Sortie validée.')
        const finalTotal = (updates.total_charged_cents as number | undefined) ?? tx.total_charged_cents
        const gpsOut = await gpsNote(tx.requests?.lat, tx.requests?.lng)
        await supabase.from('messages').insert({
          transaction_id: tx.id, sender_id: null,
          body: `✓ Sortie scannée à ${now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} — ${h > 0 ? h + ' h ' : ''}${m} min, ${(finalTotal / 100).toFixed(2)} € facturés${gpsOut}`,
        })
        trackEvent('qr_scan_complete', { transaction_id: tx.id, duration_minutes: mins })
      }
    }
    run()
  }, [params.id, params.phase, token])

  return (
    <div style={{ minHeight: '100vh', background: '#F3F6F5', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: 'Inter, sans-serif' }}>
      <div style={{ background: '#fff', border: '1px solid #DCE5E3', borderRadius: 20, padding: 28, maxWidth: 360, width: '100%', textAlign: 'center' }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
          background: status === 'ok' ? 'rgba(18,179,156,.12)' : status === 'error' ? 'rgba(255,122,102,.12)' : '#F3F6F5',
        }}>
          {status === 'ok' ? '✓' : status === 'error' ? '✕' : '…'}
        </div>
        <h1 style={{ fontFamily: 'Quicksand, sans-serif', fontSize: 17, color: '#123644' }}>{message}</h1>
        {duration && (
          <div style={{ marginTop: 14, padding: 12, borderRadius: 12, background: '#F3F6F5' }}>
            <div style={{ fontSize: 11, color: '#6E8592', fontWeight: 600 }}>Durée réelle de la prestation</div>
            <div style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 20, color: '#123644', marginTop: 2 }}>{duration}</div>
            <div style={{ fontSize: 10.5, color: '#6E8592', marginTop: 4 }}>Ce relevé fait foi en cas de litige.</div>
          </div>
        )}
        {status !== 'checking' && (
          <button onClick={() => router.push(`/mission/${params.id}/chat`)}
            style={{ width: '100%', marginTop: 18, padding: 13, borderRadius: 999, border: 'none', background: '#123644', color: '#fff', fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 13.5 }}>
            Retour à la conversation
          </button>
        )}
      </div>
    </div>
  )
}
