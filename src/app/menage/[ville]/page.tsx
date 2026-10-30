import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

/**
 * Pages locales SEO (demande de Romain, 27/10/2026 — "zéro page dédiée par
 * ville, c'est le trou noir n°1" issu de la critique commerciale).
 *
 * Chaque ville est une page statique distincte, avec un vrai paragraphe
 * local (quartiers réels, pas un gabarit copié-collé) : Google pénalise le
 * contenu dupliqué, donc le but n'est pas d'avoir 50 pages identiques avec
 * juste le nom de ville qui change, mais 10 pages qui disent chacune
 * quelque chose de spécifique. Pas de branchement base de données ici
 * (généré statiquement, generateStaticParams) — les chiffres (nb de
 * prestataires, avis) viendront enrichir ces pages une fois Supabase de
 * nouveau joignable, sans changer leur structure.
 */

type City = { slug: string; name: string; areas: string[]; blurb: string }

const CITIES: City[] = [
  { slug: 'nice', name: 'Nice', areas: ['Vieux-Nice', 'Cimiez', 'Fabron', 'Libération', 'Riquier'],
    blurb: 'Du centre-ville à Cimiez, trouvez un prestataire déjà disponible dans votre quartier.' },
  { slug: 'cannes', name: 'Cannes', areas: ['La Croisette', 'Le Suquet', 'La Bocca', 'Californie'],
    blurb: 'Résidence secondaire ou appartement à l’année : un ménage réservé en quelques clics avant votre arrivée.' },
  { slug: 'antibes', name: 'Antibes', areas: ['Juan-les-Pins', 'le Cap d’Antibes', 'le vieil Antibes'],
    blurb: 'Entre Juan-les-Pins et le Cap, des prestataires disponibles toute l’année, pas seulement l’été.' },
  { slug: 'grasse', name: 'Grasse', areas: ['le centre historique', 'Saint-Jacques', 'Plascassier'],
    blurb: 'La capitale du parfum a aussi besoin d’un bon coup de propre — réservez près de chez vous.' },
  { slug: 'menton', name: 'Menton', areas: ['le Vieux Menton', 'Garavan', 'le quartier du Carei'],
    blurb: 'Proche de la frontière, aussi proche d’un prestataire disponible dans l’heure.' },
  { slug: 'mougins', name: 'Mougins', areas: ['le village', 'Tournamy', 'Font-de-l’Orme'],
    blurb: 'Villas et résidences de Mougins : un ménage sérieux, sans négociation à rallonge.' },
  { slug: 'vence', name: 'Vence', areas: ['le centre médiéval', 'les Résidences du Soleil'],
    blurb: 'À Vence comme ailleurs sur la Côte, le prix est affiché avant de réserver, jamais après.' },
  { slug: 'valbonne', name: 'Valbonne', areas: ['le village', 'Sophia Antipolis'],
    blurb: 'Entre le village et Sophia Antipolis, trouvez un créneau de ménage qui colle à votre emploi du temps.' },
  { slug: 'cagnes-sur-mer', name: 'Cagnes-sur-Mer', areas: ['le Haut-de-Cagnes', 'le Cros-de-Cagnes', 'les Bréguières'],
    blurb: 'Du Haut-de-Cagnes au bord de mer, un prestataire proche de chez vous, pas de l’autre côté de la ville.' },
  { slug: 'villeneuve-loubet', name: 'Villeneuve-Loubet', areas: ['le village', 'Marina Baie des Anges'],
    blurb: 'Du village à Marina Baie des Anges, réservez un ménage sans attendre une semaine de réponse.' },
]

export function generateStaticParams() {
  return CITIES.map(c => ({ ville: c.slug }))
}

export function generateMetadata({ params }: { params: { ville: string } }): Metadata {
  const city = CITIES.find(c => c.slug === params.ville)
  if (!city) return {}
  return {
    title: `Femme de ménage à ${city.name} — réservation en ligne | PING`,
    description: `Trouvez un prestataire de ménage disponible près de chez vous à ${city.name} (${city.areas.slice(0, 2).join(', ')}...). Prix net affiché avant réservation, paiement sécurisé, QR code d'arrivée et de fin de prestation.`,
  }
}

export default function VillePage({ params }: { params: { ville: string } }) {
  const city = CITIES.find(c => c.slug === params.ville)
  if (!city) return notFound()

  return (
    <div className="ping-screen" style={{ paddingBottom: 60 }}>
      <div style={{ padding: '32px 20px 20px', background: '#123644' }}>
        <Link href="/" style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,.72)', textDecoration: 'none' }}>← PING</Link>
        <h1 style={{ fontFamily: 'Quicksand, sans-serif', fontWeight: 700, fontSize: 26, color: '#fff', marginTop: 14, lineHeight: 1.25 }}>
          Femme de ménage à {city.name}
        </h1>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,.75)', marginTop: 10, lineHeight: 1.55 }}>
          {city.blurb}
        </p>
      </div>

      <div style={{ padding: '24px 20px' }}>
        <p style={{ fontSize: 13.5, color: '#4E6470', lineHeight: 1.6 }}>
          PING met en relation les particuliers de {city.name} — {city.areas.join(', ')} — avec des
          prestataires de ménage, repassage et nettoyage disponibles près de chez eux. Le prix est
          affiché avant de réserver, sans devis à négocier ni surprise à la fin.
        </p>

        <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { t: 'Prix net, affiché avant de réserver', d: 'Aucune négociation, aucune surprise sur la facture.' },
            { t: 'Arrivée et départ validés par QR code', d: 'La durée réelle de la prestation est enregistrée automatiquement.' },
            { t: 'Facture automatique', d: 'Émise dès la fin de l’intervention, prête pour votre déclaration.' },
          ].map(f => (
            <div key={f.t} style={{ display: 'flex', gap: 10, padding: 14, borderRadius: 14, background: '#F3F6F5' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0C8F7E" strokeWidth="2.2" style={{ flexShrink: 0, marginTop: 1 }}><path d="M20 6L9 17l-5-5" /></svg>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13.5, color: '#123644' }}>{f.t}</div>
                <div style={{ fontSize: 12, color: '#4E6470', marginTop: 2 }}>{f.d}</div>
              </div>
            </div>
          ))}
        </div>

        <Link href="/map" className="ping-btn" style={{ display: 'block', textAlign: 'center', marginTop: 24, textDecoration: 'none' }}>
          Voir les prestataires disponibles à {city.name}
        </Link>
        <p style={{ fontSize: 11, color: '#6E8592', textAlign: 'center', marginTop: 10 }}>
          Vous êtes prestataire de ménage à {city.name} ?{' '}
          <Link href="/auth/signup" style={{ color: '#0C8F7E', fontWeight: 700 }}>Inscrivez-vous gratuitement</Link>.
        </p>
      </div>
    </div>
  )
}
