"use client"
import { useRouter } from 'next/navigation'
import OrderSummary from '@/components/presence/OrderSummary'

/**
 * Carte de commande du chat : toute la carte est un seul bouton (>= 44 px) qui ouvre le bon de commande
 * /mission/[id]/commande (demande de Romain 22/11 : la commande doit s'ouvrir en un appui, des deux côtés).
 * Le libellé « Voir la commande » remplace l'ancien petit lien « Récapitulatif du paiement » / « Commande reçue ».
 */
export default function OrderCardLink({ tx, asSeller, counterpart, payOn }: { tx: any; asSeller: boolean; counterpart?: string; payOn?: boolean }) {
  const router = useRouter()
  return (
    <button type="button" onClick={() => router.push(`/mission/${tx.id}/commande`)}
      aria-label={`Voir la commande. ${asSeller ? 'Commande reçue' : 'Commande validée'}`}
      style={{ display: 'block', width: '100%', minHeight: 44, textAlign: 'left', cursor: 'pointer', font: 'inherit', color: 'inherit',
        background: '#F6FAF9', border: '1.5px solid #BFE6DF', borderRadius: 12, padding: '10px 12px' }}>
      <OrderSummary tx={tx} asSeller={asSeller} counterpart={counterpart} payOn={payOn} compact />
      <span style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6, color: '#0B8374', fontWeight: 700, fontSize: 13, textDecoration: 'underline' }}>
        Voir la commande
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0B8374" strokeWidth="2.4" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
      </span>
    </button>
  )
}
