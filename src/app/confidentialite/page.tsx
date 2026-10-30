import Link from 'next/link'

export const metadata = { title: 'Politique de confidentialité — PING' }

// Version provisoire, volontairement factuelle : elle décrit les données que l'app collecte
// réellement, sans engagements juridiques inventés — à compléter après validation juridique.
const h2: React.CSSProperties = { fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 16, color: '#123644', margin: '22px 0 6px' }
const p: React.CSSProperties = { fontSize: 13.5, color: '#3d5561', lineHeight: 1.65, margin: '0 0 8px' }
const li: React.CSSProperties = { fontSize: 13.5, color: '#3d5561', lineHeight: 1.65 }

export default function ConfidentialitePage() {
  return (
    <div style={{ minHeight: '100vh', background: '#F3F6F5', fontFamily: 'Inter, sans-serif', padding: '28px 16px 48px' }}>
      <div style={{ maxWidth: 680, margin: '0 auto', background: '#fff', borderRadius: 20, padding: '24px 22px', border: '1px solid #E7EDEB' }}>
        <Link href="/auth/signup" style={{ fontSize: 13, fontWeight: 700, color: '#6E8592', textDecoration: 'none' }}>← Retour à l&apos;inscription</Link>
        <h1 style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 24, color: '#123644', margin: '12px 0 8px' }}>Politique de confidentialité</h1>
        <div style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: '#9A6712', background: 'rgba(242,169,59,.15)', padding: '5px 10px', borderRadius: 999, marginBottom: 8 }}>
          Version provisoire — en cours de validation juridique
        </div>

        <h2 style={h2}>Responsable</h2>
        <p style={p}>Les données sont traitées par OpConsult, qui exploite PING.</p>

        <h2 style={h2}>Données collectées</h2>
        <ul style={{ margin: '0 0 8px', paddingLeft: 20 }}>
          <li style={li}>Identité et coordonnées : nom, prénom, email, téléphone, adresse, date de naissance si vous l&apos;indiquez.</li>
          <li style={li}>Pièces déposées : pièce d&apos;identité, justificatifs du prestataire (statut, assurance, diplômes).</li>
          <li style={li}>Missions : demandes, tarifs, horaires d&apos;arrivée et de fin, factures, avis.</li>
          <li style={li}>Messages échangés dans les conversations de mission.</li>
        </ul>

        <h2 style={h2}>Localisation</h2>
        <p style={p}>PING ne suit pas votre position en continu. La carte utilise votre position pour afficher les prestataires proches. Seule exception : quand le client est absent, le prestataire valide son arrivée par une photo horodatée accompagnée de sa position à cet instant.</p>

        <h2 style={h2}>Ce que voit l&apos;autre partie</h2>
        <p style={p}>L&apos;adresse du rendez-vous n&apos;est visible par le prestataire qu&apos;une fois la mission confirmée. Le détail est présenté dans « Profil » → « Confidentialité » une fois connecté.</p>

        <h2 style={h2}>Vos droits</h2>
        <p style={p}>Vous pouvez demander l&apos;accès, la rectification ou la suppression de vos données en écrivant à <a href="mailto:info@opconsult.co" style={{ color: '#0C8F7E', fontWeight: 700 }}>info@opconsult.co</a>.</p>

        <p style={{ ...p, marginTop: 18 }}>Voir aussi les <Link href="/cgu" style={{ color: '#0C8F7E', fontWeight: 700 }}>conditions générales</Link>.</p>
      </div>
    </div>
  )
}
