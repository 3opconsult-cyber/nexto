import Link from 'next/link'

export const metadata = { title: 'Conditions générales — PING' }

// Version provisoire, volontairement factuelle : elle décrit ce que fait réellement l'app,
// sans mentions légales inventées (SIRET, adresse, dates) — à compléter après validation juridique.
const h2: React.CSSProperties = { fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 16, color: '#123644', margin: '22px 0 6px' }
const p: React.CSSProperties = { fontSize: 13.5, color: '#3d5561', lineHeight: 1.65, margin: '0 0 8px' }

export default function CguPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#F3F6F5', fontFamily: 'Inter, sans-serif', padding: '28px 16px 48px' }}>
      <div style={{ maxWidth: 680, margin: '0 auto', background: '#fff', borderRadius: 20, padding: '24px 22px', border: '1px solid #E7EDEB' }}>
        <Link href="/auth/signup" style={{ fontSize: 13, fontWeight: 700, color: '#4E6470', textDecoration: 'none' }}>← Retour à l&apos;inscription</Link>
        <h1 style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 24, color: '#123644', margin: '12px 0 8px' }}>Conditions générales d&apos;utilisation</h1>
        <div style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: '#9A6712', background: 'rgba(242,169,59,.15)', padding: '5px 10px', borderRadius: 999, marginBottom: 8 }}>
          Version provisoire — en cours de validation juridique
        </div>

        <h2 style={h2}>Qui sommes-nous</h2>
        <p style={p}>PING est une place de marché de services de proximité (ménage, repassage, nettoyage, vitres), exploitée par OpConsult. Elle met en relation des particuliers et des prestataires indépendants.</p>

        <h2 style={h2}>Le rôle de PING</h2>
        <p style={p}>PING n&apos;exécute pas les prestations : il permet de trouver un prestataire, d&apos;échanger avec lui, de fixer un tarif et de suivre la mission (code d&apos;arrivée et code de fin). Le contrat de prestation est conclu directement entre le particulier et le prestataire.</p>
        <p style={p}>Les informations présentées sur les profils (pièce d&apos;identité fournie, assurance renseignée, diplômes…) sont déclarées par les prestataires et collectées par PING, sans garantie de sa part.</p>

        <h2 style={h2}>Prix et facturation</h2>
        <p style={p}>Le tarif est fixé au moment de la réservation ou de l&apos;acceptation d&apos;une proposition dans la conversation ; seul un litige peut le remettre en cause. Pour un tarif horaire, la durée est mesurée entre le code d&apos;arrivée et le code de fin.</p>
        <p style={p}>La facture de la prestation est émise par le prestataire, sous son nom. PING facture séparément ses frais de service au particulier et sa commission au prestataire. Chaque document est disponible dans « Mes opérations ».</p>

        <h2 style={h2}>Annulation et réclamation</h2>
        <p style={p}>Une réservation peut être annulée sans frais tant que le prestataire n&apos;est pas en route ; des frais peuvent s&apos;appliquer au-delà. En cas de problème, une réclamation s&apos;ouvre depuis la conversation de la mission.</p>

        <h2 style={h2}>Engagements des utilisateurs</h2>
        <p style={p}>Chacun s&apos;engage à fournir des informations exactes, à rester courtois et à ne pas contourner la plateforme pour les missions trouvées grâce à elle. PING peut suspendre un compte en cas d&apos;abus.</p>

        <h2 style={h2}>Contact</h2>
        <p style={p}>Pour toute question : <a href="mailto:info@opconsult.co" style={{ color: '#0C8F7E', fontWeight: 700 }}>info@opconsult.co</a>. Voir aussi la <Link href="/confidentialite" style={{ color: '#0C8F7E', fontWeight: 700 }}>politique de confidentialité</Link>.</p>
      </div>
    </div>
  )
}
