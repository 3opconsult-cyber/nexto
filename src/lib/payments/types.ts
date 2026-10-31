// Contrat commun aux trois prestataires de paiement (Stripe Connect, Mangopay, Lemonway).
// Le reste de l'app ne parle qu'à cette interface : changer de prestataire = changer PAYMENT_PROVIDER.
//
// Même parcours pour les trois, seule la mécanique interne change :
//   1. le prestataire ouvre son compte de paiement (identité + IBAN, contrôlés par le PSP) ;
//   2. à la réservation, le client paie par carte : l'argent est bloqué chez le PSP (séquestre) ;
//   3. 24 h après le scan de fin, sans litige ouvert, le PSP verse au prestataire sa part
//      (prestation − commission prestataire) ; PING garde ses deux commissions ;
//   4. annulation ou litige tranché : remboursement total ou partiel au client.

export type ProviderName = 'stripe' | 'mangopay' | 'lemonway'

export type Party = {
  userId: string
  email: string
  firstName: string
  lastName: string
  birthDate?: string | null     // AAAA-MM-JJ (Mangopay / Lemonway, pour le prestataire)
  nationality?: string | null   // ISO 3166 alpha-2, FR par défaut
  country?: string | null       // pays de résidence, FR par défaut
}

export type AccountRow = {
  user_id: string
  provider: ProviderName
  role: 'buyer' | 'seller'
  external_id: string
  wallet_id: string | null
  bank_account_id: string | null
  status: 'pending' | 'active' | 'restricted'
  message: string | null
}

export type AccountPatch = Partial<Pick<AccountRow, 'external_id' | 'wallet_id' | 'bank_account_id' | 'status' | 'message'>>

export type PaymentRow = {
  id: string
  transaction_id: string
  provider: ProviderName
  kind: 'charge' | 'transfer' | 'payout' | 'refund'
  external_id: string | null
  amount_cents: number
  fee_cents: number
  status: 'pending' | 'succeeded' | 'failed' | 'cancelled'
  meta: Record<string, any>
}

export type Iban = { iban: string; bic?: string; holder: string; address?: { line1: string; city: string; postalCode: string; country?: string } }

// Événement normalisé tiré d'un webhook (après vérification de signature ou relecture chez le PSP).
export type WebhookEvent =
  | { type: 'payment'; externalId: string }
  | { type: 'account'; externalId: string }
  // Pare-feu des commissions (firewall.ts) : mandat SEPA révoqué ou refusé, prélèvement de commission
  // rejeté, opposition d'un client. Le prestataire est retrouvé par l'un des trois identifiants.
  | {
      type: 'incident'
      kind: 'mandate_revoked' | 'mandate_failed' | 'mandate_active' | 'debit_rejected' | 'chargeback'
      ref: string
      pingUserId?: string          // métadonnée posée par PING à la création (Stripe)
      sellerExternalId?: string    // identifiant du compte prestataire chez le PSP
      paymentExternalId?: string   // encaissement client concerné (opposition)
      amountCents?: number
    }

export interface PaymentProvider {
  name: ProviderName
  label: string
  configured(): boolean

  // Ouvre (ou complète) le compte bénéficiaire du prestataire. Stripe renvoie une page hébergée
  // où le pro saisit identité et IBAN ; Mangopay / Lemonway reçoivent l'IBAN saisi chez PING.
  onboardSeller(input: { seller: Party; account: AccountRow | null; iban?: Iban; returnUrl: string }): Promise<{ patch: AccountPatch; redirectUrl?: string }>
  // Relit l'état du compte (identité validée, virements possibles).
  refreshSeller(account: AccountRow): Promise<AccountPatch>
  // Pièce justificative (identité, Kbis…) déjà déposée dans « Mes pièces » : transmise au PSP.
  // Stripe la collecte lui-même dans sa page hébergée : no-op.
  submitKycDocument?(account: AccountRow, doc: { kind: 'identity' | 'registration'; bytes: Uint8Array; filename: string }): Promise<void>

  // Crée un paiement par carte et renvoie la page de paiement hébergée par le PSP.
  createCheckout(input: {
    transactionId: string
    amountCents: number
    label: string
    buyer: Party
    buyerAccount: AccountRow | null
    sellerAccount: AccountRow
    successUrl: string
    cancelUrl: string
  }): Promise<{ externalId: string; redirectUrl: string; buyerPatch?: AccountPatch; meta?: Record<string, any> }>
  // Statut réel d'un encaissement, relu chez le PSP (jamais déduit de l'URL de retour).
  getCharge(externalId: string): Promise<{ status: PaymentRow['status']; amountCents: number; meta?: Record<string, any> }>

  // Débloque le séquestre : `payoutCents` au prestataire, `keptCents` (les deux commissions) à PING.
  release(input: {
    transactionId: string
    charges: PaymentRow[]
    buyerAccount: AccountRow | null
    sellerAccount: AccountRow
    payoutCents: number
    keptCents: number
  }): Promise<Array<{ kind: 'transfer' | 'payout'; externalId: string; amountCents: number; feeCents: number }>>

  // Rembourse tout ou partie d'un encaissement.
  refund(input: { charge: PaymentRow; amountCents: number; reason: string; buyerAccount: AccountRow | null }): Promise<{ externalId: string }>

  // Vérifie et normalise un webhook entrant. Lève une erreur si la signature est fausse.
  parseWebhook(req: Request): Promise<WebhookEvent[]>
}

export class PaymentError extends Error {
  constructor(message: string, public status = 500, public details?: unknown) { super(message) }
}
