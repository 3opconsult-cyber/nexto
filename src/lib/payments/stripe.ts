// Serveur uniquement. Adaptateur Stripe Connect (comptes Express, « separate charges and transfers »).
//
// Le client paie PING (compte plateforme Stripe) ; l'argent reste chez Stripe jusqu'au déblocage ;
// au déblocage, un transfert envoie sa part au compte connecté du prestataire, Stripe le vire ensuite
// sur son IBAN (virements automatiques). Ce qui reste sur le compte plateforme = les commissions PING.
//
// Variables : STRIPE_SECRET_KEY (sk_test_… pour essayer), STRIPE_WEBHOOK_SECRET (whsec_…).
// Webhook à déclarer dans le tableau de bord Stripe : https://<domaine>/api/payments/webhook/stripe
// avec les événements checkout.session.completed, checkout.session.async_payment_succeeded,
// checkout.session.async_payment_failed, checkout.session.expired et account.updated
// (« Événements des comptes connectés » coché pour ce dernier).
// Pare-feu des commissions (firewall.ts) : ajouter aussi mandate.updated, payment_intent.payment_failed
// et charge.dispute.created. Les prélèvements SEPA de commission doivent porter les métadonnées
// ping_kind=commission et ping_user_id, et le client Stripe du prestataire metadata.ping_user_id.
// Noms d'événements et champs selon la documentation publique : à recontrôler en mode test.
import { createHmac, timingSafeEqual } from 'crypto'
import { PaymentError, type PaymentProvider, type AccountPatch, type WebhookEvent } from './types'

const API = 'https://api.stripe.com/v1'

// Stripe attend du x-www-form-urlencoded avec des clés imbriquées : a[b][0][c]=…
function form(obj: Record<string, any>, prefix = '', out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue
    const key = prefix ? `${prefix}[${k}]` : k
    if (typeof v === 'object' && !Array.isArray(v)) form(v, key, out)
    else if (Array.isArray(v)) v.forEach((item, i) => typeof item === 'object' ? form(item, `${key}[${i}]`, out) : out.append(`${key}[${i}]`, String(item)))
    else out.append(key, String(v))
  }
  return out
}

async function call<T = any>(method: 'GET' | 'POST', path: string, params?: Record<string, any>, idempotencyKey?: string): Promise<T> {
  const headers: Record<string, string> = { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` }
  let url = `${API}${path}`
  let body: string | undefined
  if (params && method === 'GET') url += `?${form(params)}`
  if (params && method === 'POST') { body = form(params).toString(); headers['Content-Type'] = 'application/x-www-form-urlencoded' }
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey
  const res = await fetch(url, { method, headers, body })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new PaymentError(data?.error?.message || `Stripe a refusé la requête (${res.status})`, res.status, data)
  return data as T
}

function accountStatus(a: any): AccountPatch {
  if (a?.requirements?.disabled_reason) return { status: 'restricted', message: a.requirements.disabled_reason }
  const ok = a?.capabilities?.transfers === 'active' && a?.payouts_enabled
  return { status: ok ? 'active' : 'pending', message: ok ? null : 'Identité ou IBAN à compléter chez Stripe' }
}

export const stripe: PaymentProvider = {
  name: 'stripe',
  label: 'Stripe',
  configured: () => !!process.env.STRIPE_SECRET_KEY && !!process.env.STRIPE_WEBHOOK_SECRET,

  async onboardSeller({ seller, account, returnUrl }) {
    let id = account?.external_id
    if (!id) {
      const a = await call('POST', '/accounts', {
        type: 'express', country: seller.country || 'FR', email: seller.email, business_type: 'individual',
        capabilities: { transfers: { requested: true } },
        individual: { first_name: seller.firstName, last_name: seller.lastName, email: seller.email },
        business_profile: { mcc: '7349', product_description: 'Ménage, repassage et nettoyage à domicile via PING' },
        metadata: { user_id: seller.userId },
      }, `acct-${seller.userId}`)
      id = a.id as string
    }
    // Lien à usage unique vers la page Stripe où le pro saisit identité, pièce et IBAN.
    const link = await call('POST', '/account_links', { account: id, type: 'account_onboarding', refresh_url: returnUrl, return_url: returnUrl })
    return { patch: { external_id: id, status: account?.status ?? 'pending' }, redirectUrl: link.url }
  },

  async refreshSeller(account) {
    return accountStatus(await call('GET', `/accounts/${account.external_id}`))
  },

  async createCheckout({ transactionId, amountCents, label, buyer, successUrl, cancelUrl }) {
    const s = await call('POST', '/checkout/sessions', {
      mode: 'payment',
      locale: 'fr',
      customer_email: buyer.email,
      client_reference_id: transactionId,
      line_items: [{ quantity: 1, price_data: { currency: 'eur', unit_amount: amountCents, product_data: { name: label } } }],
      payment_intent_data: { transfer_group: transactionId, metadata: { transaction_id: transactionId } },
      metadata: { transaction_id: transactionId },
      success_url: successUrl,
      cancel_url: cancelUrl,
    })
    return { externalId: s.id, redirectUrl: s.url }
  },

  async getCharge(externalId) {
    const s = await call('GET', `/checkout/sessions/${externalId}`, { expand: ['payment_intent'] })
    const pi = s.payment_intent
    const meta = { payment_intent: typeof pi === 'string' ? pi : pi?.id, charge: typeof pi === 'object' ? pi?.latest_charge : undefined }
    const status = s.payment_status === 'paid' ? 'succeeded' : s.status === 'expired' ? 'cancelled' : pi?.status === 'canceled' ? 'failed' : 'pending'
    return { status, amountCents: s.amount_total ?? 0, meta }
  },

  async release({ transactionId, charges, sellerAccount, payoutCents }) {
    if (payoutCents <= 0) return []
    // Avec un seul encaissement, on lie le transfert à la charge : l'argent est transférable tout de
    // suite, même si les fonds de la charge ne sont pas encore « disponibles » sur le solde Stripe.
    const single = charges.length === 1 && charges[0].meta?.charge && payoutCents <= charges[0].amount_cents
    const t = await call('POST', '/transfers', {
      amount: payoutCents, currency: 'eur', destination: sellerAccount.external_id,
      transfer_group: transactionId, source_transaction: single ? charges[0].meta.charge : undefined,
      metadata: { transaction_id: transactionId },
    }, `release-${transactionId}`)
    return [{ kind: 'transfer', externalId: t.id, amountCents: payoutCents, feeCents: 0 }]
  },

  async refund({ charge, amountCents, reason }) {
    if (!charge.meta?.payment_intent) throw new PaymentError('Encaissement Stripe introuvable', 409)
    const r = await call('POST', '/refunds', {
      payment_intent: charge.meta.payment_intent, amount: amountCents, metadata: { transaction_id: charge.transaction_id, motif: reason },
    })
    return { externalId: r.id }
  },

  async parseWebhook(req) {
    const raw = await req.text()
    const header = req.headers.get('stripe-signature') || ''
    const parts = Object.fromEntries(header.split(',').map(p => p.split('=') as [string, string]))
    const sigs = header.split(',').filter(p => p.startsWith('v1=')).map(p => p.slice(3))
    const t = Number(parts.t)
    if (!t || !sigs.length || Math.abs(Date.now() / 1000 - t) > 300) throw new PaymentError('Signature Stripe absente ou périmée', 400)
    const expected = createHmac('sha256', process.env.STRIPE_WEBHOOK_SECRET!).update(`${t}.${raw}`).digest('hex')
    const ok = sigs.some(s => s.length === expected.length && timingSafeEqual(Buffer.from(s), Buffer.from(expected)))
    if (!ok) throw new PaymentError('Signature Stripe invalide', 400)
    const evt = JSON.parse(raw)
    const obj = evt.data?.object
    const out: WebhookEvent[] = []
    if (String(evt.type).startsWith('checkout.session.')) out.push({ type: 'payment', externalId: obj.id })
    if (evt.type === 'account.updated') out.push({ type: 'account', externalId: obj.id })
    if (evt.type === 'mandate.updated' && (obj.status === 'active' || obj.status === 'inactive')) {
      // Le mandat ne porte pas de métadonnée : on remonte au client Stripe du prestataire.
      const pm = obj.payment_method ? await call<any>('GET', `/payment_methods/${obj.payment_method}`).catch(() => null) : null
      const cus = pm?.customer ? await call<any>('GET', `/customers/${pm.customer}`).catch(() => null) : null
      out.push({ type: 'incident', kind: obj.status === 'active' ? 'mandate_active' : 'mandate_revoked', ref: obj.id, pingUserId: cus?.metadata?.ping_user_id })
    }
    if (evt.type === 'payment_intent.payment_failed' && obj.metadata?.ping_kind === 'commission') {
      out.push({ type: 'incident', kind: 'debit_rejected', ref: obj.id, pingUserId: obj.metadata?.ping_user_id, amountCents: obj.amount })
    }
    if (evt.type === 'charge.dispute.created') {
      out.push({ type: 'incident', kind: 'chargeback', ref: obj.id, paymentExternalId: obj.payment_intent, amountCents: obj.amount })
    }
    return out
  },
}
