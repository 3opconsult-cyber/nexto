// Paiement par virement SEPA (décision Romain du 31/10/2026, migration 025) : tant que le paiement
// en ligne sous séquestre est en suspens, chaque facture se règle par virement.
//   prestation (FACT-/RECAP-) : client -> prestataire, sur l'IBAN du prestataire
//   frais de service (PING-C-) : client -> PING
//   commission (PING-V-)       : prestataire -> PING
// PING n'encaisse jamais le prix de la prestation pour le compte du prestataire.
import type { SupabaseClient } from '@supabase/supabase-js'

export type TransferStatus = 'a_payer' | 'declare_paye' | 'recu' | 'en_retard'
export type Transfer = {
  id: string; invoice_id: string; transaction_id: string
  payer_role: 'client' | 'pro'; payee: 'pro' | 'ping'
  payer_id: string; payee_id: string | null
  reference: string; amount_cents: number; status: TransferStatus
  due_at: string; declared_at: string | null; received_at: string | null; created_at: string
}

export const TRANSFER_STATUS: Record<TransferStatus, { t: string; fg: string; bg: string }> = {
  a_payer: { t: 'À régler', fg: '#8A6520', bg: 'rgba(242,169,59,.15)' },
  declare_paye: { t: 'Virement annoncé', fg: '#2C6E8F', bg: 'rgba(44,110,143,.12)' },
  recu: { t: 'Reçu', fg: '#0C8F7E', bg: 'rgba(18,179,156,.12)' },
  en_retard: { t: 'En retard', fg: '#c0503a', bg: 'rgba(192,80,58,.12)' },
}

export const cleanIban = (s: string) => s.replace(/[\s-]/g, '').toUpperCase()
export const formatIban = (s: string) => cleanIban(s).replace(/(.{4})/g, '$1 ').trim()

/** Contrôle ISO 13616 (clé modulo 97). Ne dit rien de l'existence du compte. */
export function ibanValid(raw: string): boolean {
  const s = cleanIban(raw)
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(s)) return false
  if (s.startsWith('FR') && s.length !== 27) return false
  const moved = s.slice(4) + s.slice(0, 4)
  let rem = 0
  for (const ch of moved) {
    const v = ch >= 'A' && ch <= 'Z' ? String(ch.charCodeAt(0) - 55) : ch
    for (const d of v) rem = (rem * 10 + Number(d)) % 97
  }
  return rem === 1
}

export const bicValid = (s: string) => !s.trim() || /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(s.trim().toUpperCase())

export type PingBank = { iban: string; bic: string; beneficiary: string }
export async function pingBank(db: SupabaseClient): Promise<PingBank> {
  const { data } = await db.from('app_settings').select('key, value').in('key', ['ping_iban', 'ping_bic', 'ping_beneficiary'])
  const get = (k: string) => { const v = (data ?? []).find(r => r.key === k)?.value; return typeof v === 'string' ? v : '' }
  return { iban: get('ping_iban'), bic: get('ping_bic'), beneficiary: get('ping_beneficiary') || 'PING' }
}

export async function transfersFor(db: SupabaseClient, transactionId: string): Promise<Transfer[]> {
  const { data } = await db.from('transfer_payments').select('*').eq('transaction_id', transactionId).order('created_at')
  return (data ?? []) as Transfer[]
}

export const TRANSFER_LABEL = (t: Transfer, viewerIsPayer: boolean) =>
  t.payee === 'pro' ? (viewerIsPayer ? 'Prestation, au prestataire' : 'Paiement du client')
  : t.payer_role === 'client' ? 'Frais de service, à PING'
  : 'Commission PING'
