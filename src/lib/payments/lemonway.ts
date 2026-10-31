// Serveur uniquement. Adaptateur Lemonway (API REST v2, « directkitrest »).
//
// Le prestataire a un compte de paiement Lemonway (bénéficiaire). Le client paie par carte sur ce
// compte : l'argent y reste bloqué (PING seul peut déclencher le virement). Au déblocage, un
// « money-out » vire la part du prestataire sur son IBAN ; la commission PING (commissionAmount)
// part sur le compte de la plateforme. Un remboursement avant déblocage revient sur la carte.
//
// Variables : LEMONWAY_API_KEY, LEMONWAY_API_BASE (URL propre à l'environnement, par ex.
// https://sandbox-api.lemonway.fr/mb/<env>/dev/directkitrest), LEMONWAY_TOKEN_URL (par défaut le jeton
// OAuth du bac à sable), LEMONWAY_WEBKIT_URL (page de paiement hébergée), LEMONWAY_HOOK_KEY.
// Notifications à déclarer chez Lemonway : https://<domaine>/api/payments/webhook/lemonway?k=<LEMONWAY_HOOK_KEY>
// Elles ne sont pas signées : on relit toujours la ressource. Noms de champs et codes de statut
// suivant la documentation publique v2 : à recontrôler sur l'environnement de test remis par Lemonway.
import { PaymentError, type PaymentProvider, type AccountPatch, type WebhookEvent } from './types'

const BASE = () => process.env.LEMONWAY_API_BASE!
const TOKEN_URL = () => process.env.LEMONWAY_TOKEN_URL || 'https://sandbox-api.lemonway.fr/oauth/api/v1/oauth/token'
const ISO3: Record<string, string> = { FR: 'FRA', MC: 'MCO', IT: 'ITA', BE: 'BEL', CH: 'CHE', DE: 'DEU', ES: 'ESP', PT: 'PRT', GB: 'GBR' }
const iso3 = (c?: string | null) => ISO3[(c || 'FR').toUpperCase()] || 'FRA'

let cached: { token: string; exp: number } | null = null
async function token() {
  if (cached && cached.exp > Date.now() + 30_000) return cached.token
  const res = await fetch(TOKEN_URL(), {
    method: 'POST', headers: { Authorization: `Basic ${process.env.LEMONWAY_API_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  })
  if (!res.ok) throw new PaymentError(`Authentification Lemonway refusée (${res.status})`, res.status)
  const j = await res.json() as { access_token: string; expires_in?: number }
  cached = { token: j.access_token, exp: Date.now() + (j.expires_in ?? 3600) * 1000 }
  return cached.token
}

async function call<T = any>(method: 'GET' | 'POST' | 'PUT', path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE()}${path}`, {
    method,
    headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json', Accept: 'application/json', 'PSU-IP-Address': '127.0.0.1' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => null)
  if (!res.ok || data?.error) throw new PaymentError(data?.error?.message || `Lemonway a refusé la requête (${res.status})`, res.ok ? 422 : res.status, data)
  return data as T
}

// Identifiant de compte Lemonway choisi par la plateforme (max 100 caractères).
const accountIdFor = (userId: string) => `PING-S-${userId}`

// Statuts de compte Lemonway : 5 = KYC 1, 6 = KYC 2 complet, 7 = KYC 3 ; 3/8/10/12 = refusé, expiré,
// bloqué, clos. Seuls 6 et 7 autorisent un virement sortant.
function accountStatus(s: number, hasIban: boolean): AccountPatch {
  if ([6, 7].includes(s) && hasIban) return { status: 'active', message: null }
  if ([3, 8, 10, 12].includes(s)) return { status: 'restricted', message: 'Compte Lemonway refusé, expiré ou bloqué' }
  return { status: 'pending', message: hasIban ? 'Pièces en cours de contrôle par Lemonway' : 'IBAN à renseigner' }
}

export const lemonway: PaymentProvider = {
  name: 'lemonway',
  label: 'Lemonway',
  configured: () => !!process.env.LEMONWAY_API_KEY && !!process.env.LEMONWAY_API_BASE && !!process.env.LEMONWAY_WEBKIT_URL,

  async onboardSeller({ seller, account, iban }) {
    const patch: AccountPatch = {}
    let accountId = account?.external_id
    if (!accountId) {
      if (!seller.birthDate) throw new PaymentError('Date de naissance requise', 422)
      accountId = accountIdFor(seller.userId)
      await call('POST', '/v2/accounts/individual', {
        accountId, email: seller.email, firstName: seller.firstName, lastName: seller.lastName,
        birth: { date: seller.birthDate.replace(/-/g, '/'), country: iso3(seller.nationality) },
        nationality: iso3(seller.nationality),
        adresse: iban?.address && { street: iban.address.line1, postCode: iban.address.postalCode, city: iban.address.city, country: iso3(iban.address.country) },
        payerOrBeneficiary: 2, // 2 = bénéficiaire
      })
      patch.external_id = accountId
    }
    if (iban) {
      const r = await call('POST', '/v2/moneyouts/iban', {
        accountId, holder: iban.holder, iban: iban.iban.replace(/\s/g, ''), bic: iban.bic || undefined,
        domiciliation1: iban.address?.line1, domiciliation2: iban.address?.city, comment: 'IBAN prestataire PING',
      })
      patch.bank_account_id = String(r?.iban?.id ?? r?.id ?? '')
    }
    patch.status = account?.status ?? 'pending'
    return { patch }
  },

  async refreshSeller(account) {
    const r = await call('GET', `/v2/accounts/${encodeURIComponent(account.external_id)}`)
    return accountStatus(Number(r?.account?.status), !!account.bank_account_id)
  },

  async submitKycDocument(account, doc) {
    await call('POST', `/v2/accounts/${encodeURIComponent(account.external_id)}/documents/upload`, {
      name: doc.filename, type: doc.kind === 'identity' ? 0 : 7, // 0 = pièce d'identité, 7 = Kbis / avis Insee
      buffer: Buffer.from(doc.bytes).toString('base64'),
    })
  },

  async createCheckout({ transactionId, amountCents, sellerAccount, successUrl, cancelUrl, label }) {
    const r = await call('POST', '/v2/moneyins/card/webinit', {
      accountId: sellerAccount.external_id, totalAmount: amountCents, commissionAmount: 0, autoCommission: false,
      reference: transactionId.slice(0, 50), comment: label.slice(0, 140),
      returnUrl: successUrl, errorUrl: cancelUrl, cancelUrl,
    })
    const tokenWk = r?.webKitToken
    if (!tokenWk) throw new PaymentError('Lemonway n’a pas renvoyé de page de paiement', 502, r)
    return {
      externalId: String(r.id),
      redirectUrl: `${process.env.LEMONWAY_WEBKIT_URL}?moneytoken=${encodeURIComponent(tokenWk)}`,
    }
  },

  async getCharge(externalId) {
    const r = await call('GET', `/v2/moneyins?transactionId=${encodeURIComponent(externalId)}`)
    const t = r?.transactions?.value?.[0] ?? r?.transaction
    // 3 = réussi, 4 = erreur ; 0 / 16 = en attente.
    const s = Number(t?.status)
    return { status: s === 3 ? 'succeeded' : s === 4 ? 'failed' : 'pending', amountCents: Number(t?.creditAmount ?? t?.totalAmount ?? 0) }
  },

  async release({ transactionId, sellerAccount, payoutCents, keptCents }) {
    if (!sellerAccount.bank_account_id) throw new PaymentError('IBAN du prestataire manquant chez Lemonway', 409)
    const r = await call('POST', '/v2/moneyouts', {
      accountId: sellerAccount.external_id, ibanId: Number(sellerAccount.bank_account_id) || sellerAccount.bank_account_id,
      totalAmount: payoutCents + keptCents, commissionAmount: keptCents, autoCommission: false,
      comment: `PING ${transactionId.slice(0, 8)}`,
    })
    return [{ kind: 'payout', externalId: String(r?.transaction?.id ?? r?.id), amountCents: payoutCents, feeCents: keptCents }]
  },

  async refund({ charge, amountCents, reason }) {
    if (!charge.external_id) throw new PaymentError('Encaissement Lemonway introuvable', 409)
    const r = await call('PUT', `/v2/moneyins/${encodeURIComponent(charge.external_id)}/refund`, { amountToRefund: amountCents, comment: reason.slice(0, 140) })
    return { externalId: String(r?.transaction?.id ?? r?.id ?? `${charge.external_id}-r`) }
  },

  async parseWebhook(req) {
    const url = new URL(req.url)
    if (!process.env.LEMONWAY_HOOK_KEY || url.searchParams.get('k') !== process.env.LEMONWAY_HOOK_KEY) throw new PaymentError('Clé de notification Lemonway invalide', 401)
    const raw = await req.text()
    let p: Record<string, any> = {}
    try { p = JSON.parse(raw) } catch { p = Object.fromEntries(new URLSearchParams(raw)) }
    const cat = String(p.NotifCategory ?? p.notifCategory ?? '')
    const out: WebhookEvent[] = []
    // 10 = money-in carte ; 8 = changement de statut du compte ; 9 = statut d'un document KYC.
    if (cat === '10' && (p.IdTransaction || p.IntId)) out.push({ type: 'payment', externalId: String(p.IdTransaction || p.IntId) })
    if ((cat === '8' || cat === '9') && (p.ExtId || p.accountId)) out.push({ type: 'account', externalId: String(p.ExtId || p.accountId) })
    // Pare-feu des commissions (firewall.ts). HYPOTHÈSE À VÉRIFIER sur la documentation remise par
    // Lemonway : catégorie 14 = prélèvement SEPA (SDD) rejeté, 15 = mandat SDD révoqué, 16 = opposition
    // sur carte. Tant que ce n'est pas confirmé, un incident mal classé finit au pire en alerte admin.
    const wallet = p.ExtId || p.accountId ? String(p.ExtId || p.accountId) : undefined
    const cents = p.Amount != null ? Math.round(Number(String(p.Amount).replace(',', '.')) * 100) : undefined
    if (cat === '14') out.push({ type: 'incident', kind: 'debit_rejected', ref: String(p.IdTransaction || p.IntId || ''), sellerExternalId: wallet, amountCents: cents })
    if (cat === '15') out.push({ type: 'incident', kind: 'mandate_revoked', ref: String(p.IdMandate || p.IntId || ''), sellerExternalId: wallet })
    if (cat === '16') out.push({ type: 'incident', kind: 'chargeback', ref: String(p.IdTransaction || p.IntId || ''), paymentExternalId: String(p.IdTransaction || p.IntId || ''), amountCents: cents })
    return out
  },
}
