"use client"
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import AddressChoice, { resolveAddress, type AddressValue } from '@/components/AddressChoice'
import { Sheet } from '@/components/MissionSheets'
import { C, btn, p, Row } from '@/components/missionUi'
import { maskAddress } from '@/lib/address'
import { geocodeAddress } from '@/lib/geocode'
import { systemSender } from '@/lib/systemMessage'

/**
 * « Modifier l'adresse » (bon de commande) : le client choisit l'adresse de son profil ou une autre.
 * Même écriture que « Fixez le rendez-vous » du chat (règle 023) : une autre adresse passe au statut
 * `a_valider`, le prestataire la voit sans le numéro et l'accepte ou la refuse. Le prix ne change pas.
 */
export default function AddressEditSheet({ tx, userId, currentAddress, onClose, onDone }: {
  tx: any; userId: string; currentAddress: string | null; onClose: () => void
  onDone: (patch: { address: string; address_status: string; lat?: number; lng?: number }) => void
}) {
  const [profileAddr, setProfileAddr] = useState<string | null | undefined>(undefined)
  const [choice, setChoice] = useState<AddressValue>({ mode: 'profil', other: '', confirmed: true })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    createClient().from('profiles').select('address').eq('id', userId).maybeSingle()
      .then(({ data }) => setProfileAddr((data as any)?.address ?? null))
  }, [userId])

  async function save() {
    if (profileAddr === undefined) return
    const r = resolveAddress(profileAddr, choice)
    if ('error' in r) { setErr(r.error as string); return }
    if (r.address === currentAddress && r.status !== 'a_valider') { onClose(); return }
    setBusy(true); setErr('')
    const supabase = createClient()
    if (r.saveToProfile) await supabase.from('profiles').update({ address: r.address }).eq('id', userId)
    const reqId = tx.request_id
    const pos = await geocodeAddress(r.address).catch(() => null)
    if (reqId) {
      const { error } = await supabase.from('requests').update({ address: r.address, ...(pos ? { lat: pos.lat, lng: pos.lng } : {}) }).eq('id', reqId)
      if (error) { setBusy(false); setErr('Adresse non enregistrée, réessayez.'); return }
    }
    const { data: upd, error: txErr } = await supabase.from('transactions').update({ address_status: r.status }).eq('id', tx.id).select('address_status').maybeSingle()
    if (txErr || !upd) { setBusy(false); setErr('Adresse non enregistrée, réessayez.'); return }
    await supabase.from('messages').insert({
      transaction_id: tx.id, ...(await systemSender(supabase)),
      body: r.status === 'a_valider'
        ? `✓ Adresse modifiée : autre adresse à valider par le prestataire : ${maskAddress(r.address)}`
        : '✓ Adresse d’intervention modifiée : adresse du profil, transmise au prestataire',
    })
    setBusy(false)
    onDone({ address: r.address, address_status: (upd as any).address_status, ...(pos ? { lat: pos.lat, lng: pos.lng } : {}) })
    onClose()
  }

  return (
    <Sheet title="Modifier l’adresse" onClose={onClose}>
      <p style={p}>Une adresse autre que celle de votre profil est soumise au prestataire : il la voit sans le numéro, puis l’accepte ou la refuse. Le prix ne change pas.</p>
      {profileAddr === undefined ? <p style={p}>Chargement…</p> : <AddressChoice profileAddress={profileAddr} value={choice} onChange={setChoice} error={err || undefined} />}
      <Row>
        <button type="button" style={btn('#fff', C.navy, C.line)} onClick={onClose}>Fermer</button>
        <button type="button" disabled={busy || profileAddr === undefined} style={btn(C.teal, '#fff')} onClick={save}>{busy ? 'Enregistrement…' : 'Enregistrer l’adresse'}</button>
      </Row>
    </Sheet>
  )
}
