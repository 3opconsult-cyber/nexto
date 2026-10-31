// Serveur uniquement. Adaptateur Mangopay (API v2.01), modèle « séquestre dans le porte-monnaie client ».
//
// Le client a un utilisateur PAYER + un porte-monnaie : il paie par carte vers SON porte-monnaie
// (l'argent reste à son nom, chez Mangopay, établissement de monnaie électronique agréé).
// Au déblocage : transfert porte-monnaie client → porte-monnaie prestataire, avec les commissions PING
// en « Fees » (elles tombent dans le porte-monnaie de frais de la plateforme), puis virement du
// porte-monnaie prestataire vers son IBAN. Un remboursement avant déblocage revient sur la carte.
//
// Variables : MANGOPAY_CLIENT_ID, MANGOPAY_API_KEY, MANGOPAY_API_BASE (https://api.sandbox.mangopay.com
// pour essayer, https://api.mangopay.com en production), MANGOPAY_HOOK_KEY (secret libre, repris dans
// l'URL des hooks). Hooks à déclarer dans le tableau de bord Mangopay :
//   https://<domaine>/api/payments/webhook/mangopay?k=<MANGOPAY_HOOK_KEY>
// pour PAYIN_NORMAL_SUCCEEDED, PAYIN_NORMAL_FAILED, USER_KYC_REGULAR, USER_KYC_LIGHT,
// et pour le pare-feu des commissions (firewall.ts) : MANDATE_ACTIVATED, MANDATE_FAILED, MANDATE_EXPIRED,
// DISPUTE_CREATED (un prélèvement par mandat rejeté arrive en PAYIN_NORMAL_FAILED de type DIRECT_DEBIT).
// Les hooks Mangopay ne sont pas signés : on ne fait jamais confiance au contenu, on relit la ressource.
// Noms de champs suivant la documentation publique v2.01 : à recontrôler en bac à sable.
import { PaymentError, type PaymentProvider, type AccountPatch, type WebhookEvent } from './types'

const BASE = () => process.env.MANGOPAY_API_BASE || 'https://api.sandbox.mangopay.com'
const CID = () => process.env.MANGOPAY_CLIENT_ID!
const EUR = (cents: number) => ({ Currency: 'EUR', Amount: cents })

let cached: { token: string; exp: number } | null = null
async function token() {
  if (cached && cached.exp > Date.now() + 30_000) return cached.token
  const basic = Buffer.from(`${CID()}:${process.env.MANGOPAY_API_KEY}`).toString('base64')
  const res = await fetch(`${BASE()}/v2.01/oauth/token`, {
    method: 'POST', headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  })
  if (!res.ok) throw new PaymentError(`Authentification Mangopay refusée (${res.status})`, res.status)
  const j = await res.json() as { access_token: string; expires_in?: number }
  cached = { token: j.access_token, exp: Date.now() + (j.expires_in ?? 3600) * 1000 }
  return cached.token
}

async function call<T = any>(method: 'GET' | 'POST' | 'PUT', path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
  const headers: Record<string, string> = { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json' }
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey
  const res = await fetch(`${BASE()}/v2.01/${CID()}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new PaymentError(data?.Message || `Mangopay a refusé la requête (${res.status})`, res.status, data)
  return data as T
}

const unix = (d?: string | null) => d ? Math.floor(new Date(`${d}T12:00:00Z`).getTime() / 1000) : undefined

export const mangopay: PaymentProvider = {
  name: 'mangopay',
  label: 'Mangopay',
  configured: () => !!process.env.MANGOPAY_CLIENT_ID && !!process.env.MANGOPAY_API_KEY,

  async onboardSeller({ seller, account, iban }) {
    const patch: AccountPatch = {}
    let userId = account?.external_id
    let walletId = account?.wallet_id
    if (!userId) {
      if (!seller.birthDate) throw new PaymentError('Date de naissance requise', 422)
      if (!iban?.address) throw new PaymentError('Adresse requise', 422)
      const u = await call('POST', '/users/natural', {
        FirstName: seller.firstName, LastName: seller.lastName, Email: seller.email,
        Birthday: unix(seller.birthDate), Nationality: seller.nationality || 'FR', CountryOfResidence: seller.country || 'FR',
        Address: { AddressLine1: iban.address.line1, City: iban.address.city, PostalCode: iban.address.postalCode, Country: iban.address.country || 'FR' },
        UserCategory: 'OWNER', TermsAndConditionsAccepted: true, Tag: seller.userId,
      }, `seller-${seller.userId}`)
      userId = u.Id as string
      patch.external_id = userId
    }
    if (!walletId) {
      const w = await call('POST', '/wallets', { Owners: [userId], Currency: 'EUR', Description: 'PING — prestataire', Tag: seller.userId })
      walletId = w.Id as string
      patch.wallet_id = walletId
    }
    if (iban) {
      const b = await call('POST', `/users/${userId}/bankaccounts/iban`, {
        OwnerName: iban.holder, IBAN: iban.iban.replace(/\s/g, ''), BIC: iban.bic || undefined,
        OwnerAddress: iban.address && { AddressLine1: iban.address.line1, City: iban.address.city, PostalCode: iban.address.postalCode, Country: iban.address.country || 'FR' },
        Tag: seller.userId,
      })
      patch.bank_account_id = b.Id
    }
    patch.status = account?.status ?? 'pending'
    patch.message = 'Pièce d’identité en cours de contrôle par Mangopay'
    return { patch }
  },

  async refreshSeller(account) {
    const u = await call('GET', `/users/${account.external_id}`)
    if (u.KYCLevel === 'REGULAR' && account.bank_account_id) return { status: 'active', message: null }
    return { status: 'pending', message: account.bank_account_id ? 'Pièce d’identité en cours de contrôle par Mangopay' : 'IBAN à renseigner' }
  },

  async submitKycDocument(account, doc) {
    const d = await call('POST', `/users/${account.external_id}/kyc/documents`, { Type: doc.kind === 'identity' ? 'IDENTITY_PROOF' : 'REGISTRATION_PROOF' })
    await call('POST', `/users/${account.external_id}/kyc/documents/${d.Id}/pages`, { File: Buffer.from(doc.bytes).toString('base64') })
    await call('PUT', `/users/${account.external_id}/kyc/documents/${d.Id}`, { Status: 'VALIDATION_ASKED' })
  },

  async createCheckout({ transactionId, amountCents, buyer, buyerAccount, successUrl }) {
    let userId = buyerAccount?.external_id
    let walletId = buyerAccount?.wallet_id
    const buyerPatch: AccountPatch = {}
    if (!userId) {
      const u = await call('POST', '/users/natural', {
        FirstName: buyer.firstName, LastName: buyer.lastName, Email: buyer.email,
        UserCategory: 'PAYER', TermsAndConditionsAccepted: true, Tag: buyer.userId,
      }, `buyer-${buyer.userId}`)
      userId = u.Id as string
      Object.assign(buyerPatch, { external_id: userId, status: 'active' })
    }
    if (!walletId) {
      const w = await call('POST', '/wallets', { Owners: [userId], Currency: 'EUR', Description: 'PING — séquestre client', Tag: buyer.userId })
      walletId = w.Id as string
      buyerPatch.wallet_id = walletId
    }
    const p = await call('POST', '/payins/card/web', {
      AuthorId: userId, CreditedWalletId: walletId, DebitedFunds: EUR(amountCents), Fees: EUR(0),
      ReturnURL: successUrl, CardType: 'CB_VISA_MASTERCARD', Culture: 'FR', Tag: transactionId,
    })
    return { externalId: p.Id, redirectUrl: p.RedirectURL, buyerPatch: Object.keys(buyerPatch).length ? buyerPatch : undefined }
  },

  async getCharge(externalId) {
    const p = await call('GET', `/payins/${externalId}`)
    const status = p.Status === 'SUCCEEDED' ? 'succeeded' : p.Status === 'FAILED' ? 'failed' : 'pending'
    return { status, amountCents: p.DebitedFunds?.Amount ?? 0 }
  },

  async release({ transactionId, buyerAccount, sellerAccount, payoutCents, keptCents }) {
    if (!buyerAccount?.wallet_id || !sellerAccount.wallet_id) throw new PaymentError('Porte-monnaie Mangopay manquant', 409)
    if (!sellerAccount.bank_account_id) throw new PaymentError('IBAN du prestataire manquant chez Mangopay', 409)
    const out: Array<{ kind: 'transfer' | 'payout'; externalId: string; amountCents: number; feeCents: number }> = []
    const t = await call('POST', '/transfers', {
      AuthorId: buyerAccount.external_id, DebitedWalletId: buyerAccount.wallet_id, CreditedWalletId: sellerAccount.wallet_id,
      DebitedFunds: EUR(payoutCents + keptCents), Fees: EUR(keptCents), Tag: transactionId,
    }, `transfer-${transactionId}`)
    if (t.Status === 'FAILED') throw new PaymentError(t.ResultMessage || 'Transfert Mangopay refusé', 502, t)
    out.push({ kind: 'transfer', externalId: t.Id, amountCents: payoutCents, feeCents: keptCents })
    if (payoutCents > 0) {
      const po = await call('POST', '/payouts/bankwire', {
        AuthorId: sellerAccount.external_id, DebitedWalletId: sellerAccount.wallet_id, BankAccountId: sellerAccount.bank_account_id,
        DebitedFunds: EUR(payoutCents), Fees: EUR(0), BankWireRef: 'PING', Tag: transactionId,
      }, `payout-${transactionId}`)
      out.push({ kind: 'payout', externalId: po.Id, amountCents: payoutCents, feeCents: 0 })
    }
    return out
  },

  async refund({ charge, amountCents, buyerAccount }) {
    if (!charge.external_id || !buyerAccount) throw new PaymentError('Encaissement Mangopay introuvable', 409)
    const r = await call('POST', `/payins/${charge.external_id}/refunds`, {
      AuthorId: buyerAccount.external_id, DebitedFunds: EUR(amountCents), Fees: EUR(0), Tag: charge.transaction_id,
    })
    return { externalId: r.Id }
  },

  async parseWebhook(req) {
    const url = new URL(req.url)
    if (!process.env.MANGOPAY_HOOK_KEY || url.searchParams.get('k') !== process.env.MANGOPAY_HOOK_KEY) throw new PaymentError('Clé de hook Mangopay invalide', 401)
    const type = url.searchParams.get('EventType') || ''
    const id = url.searchParams.get('RessourceId') || ''
    if (!id) return []
    const out: WebhookEvent[] = []
    if (type.startsWith('PAYIN_NORMAL_')) out.push({ type: 'payment', externalId: id })
    if (type.startsWith('USER_KYC_')) out.push({ type: 'account', externalId: id })
    // Pare-feu : on relit chaque ressource (hooks non signés). Révocation par le titulaire = mandat
    // FAILED ou EXPIRED selon la banque : à recontrôler en bac à sable.
    if (type === 'MANDATE_ACTIVATED' || type === 'MANDATE_FAILED' || type === 'MANDATE_EXPIRED') {
      const m = await call<any>('GET', `/mandates/${id}`).catch(() => null)
      out.push({ type: 'incident', kind: type === 'MANDATE_ACTIVATED' ? 'mandate_active' : type === 'MANDATE_FAILED' ? 'mandate_failed' : 'mandate_revoked', ref: id, sellerExternalId: m?.UserId })
    }
    if (type === 'PAYIN_NORMAL_FAILED') {
      const pi = await call<any>('GET', `/payins/${id}`).catch(() => null)
      if (pi?.PaymentType === 'DIRECT_DEBIT') out.push({ type: 'incident', kind: 'debit_rejected', ref: id, sellerExternalId: pi.AuthorId, amountCents: pi.DebitedFunds?.Amount })
    }
    if (type === 'DISPUTE_CREATED') {
      const d = await call<any>('GET', `/disputes/${id}`).catch(() => null)
      out.push({ type: 'incident', kind: 'chargeback', ref: id, paymentExternalId: d?.InitialTransactionId, amountCents: d?.DisputedFunds?.Amount })
    }
    return out
  },
}
