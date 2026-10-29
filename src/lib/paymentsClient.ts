"use client"
import { useEffect, useState } from 'react'

// Côté navigateur : le paiement en ligne est-il actif ? (réponse du serveur, jamais de clé ici).
// null tant que la réponse n'est pas arrivée ; false si éteint ou injoignable.
let cache: Promise<boolean> | null = null
export function paymentsActive(): Promise<boolean> {
  cache ||= fetch('/api/payments').then(r => r.json()).then(j => !!j.actif).catch(() => false)
  return cache
}

export function usePaymentsActive() {
  const [actif, setActif] = useState<boolean | null>(null)
  useEffect(() => { paymentsActive().then(setActif) }, [])
  return actif
}

export async function startCheckout(transactionId: string): Promise<{ redirectUrl?: string; error?: string }> {
  const r = await fetch('/api/payments/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transactionId }) })
  return r.json().catch(() => ({ error: 'Paiement indisponible.' }))
}
