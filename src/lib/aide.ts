// Rubriques de « Comment ça marche » : une animation par rubrique, jamais tout d'affilée.
// `scene` = rang (1..n) de la scène dans le tableau UI de brand/anim-presentation/parts/d_scenes.js
// (1 Accroche, 2 La carte, 3 Le chat et le prix, 4 Agenda et facture, 5 Je cherche un prestataire,
// 6 Je suis prestataire, 11 Avis croisés). Les paramètres ?embed=1 et ?scene=N sont lus par les pages /animation*.
export type AideRubrique = {
  slug: string
  title: string
  sub: string
  src: string
  space: 'particulier' | 'pro' | 'tous'
  icon: 'pin' | 'chat' | 'agenda' | 'qr' | 'absent' | 'doc' | 'swap' | 'tag'
}

export const AIDE_RUBRIQUES: AideRubrique[] = [
  { slug: 'carte', title: 'Trouver un prestataire sur la carte', sub: 'Les prestataires disponibles près de chez vous, et comment les contacter.', src: '/animation-ping?embed=1&scene=2', space: 'particulier', icon: 'pin' },
  { slug: 'prix', title: 'Contacter et fixer le prix', sub: 'Le devis dans le chat, son acceptation et la fixation du rendez-vous.', src: '/animation-ping?embed=1&scene=3', space: 'particulier', icon: 'chat' },
  { slug: 'agenda', title: 'Agenda et rendez-vous', sub: 'Où retrouver vos rendez-vous confirmés.', src: '/animation-ping?embed=1&scene=4', space: 'particulier', icon: 'agenda' },
  { slug: 'apres-commande', title: 'Après la commande : arrivée, QR, fin', sub: 'Le QR à l’arrivée et au départ, et l’heure entamée.', src: '/animation-tuto?embed=1', space: 'tous', icon: 'qr' },
  { slug: 'absent', title: 'Vous ne serez pas sur place', sub: 'Valider l’arrivée du prestataire quand vous êtes absent.', src: '/animation-tuto-absent?embed=1', space: 'particulier', icon: 'absent' },
  { slug: 'facture', title: 'Facture, avis et pourboire', sub: 'La facture après la mission, puis les avis croisés.', src: '/animation-ping?embed=1&scene=11', space: 'tous', icon: 'doc' },
  { slug: 'devenir-prestataire', title: 'Devenir prestataire', sub: 'Créer votre profil prestataire pas à pas.', src: '/animation-inscription?embed=1&part=pro', space: 'pro', icon: 'swap' },
  { slug: 'etre-prestataire', title: 'Être prestataire : demandes, tarifs, disponibilités', sub: 'Fixer vos tarifs, indiquer vos créneaux et passer « Disponible ».', src: '/animation-ping?embed=1&scene=6', space: 'pro', icon: 'tag' },
]

export const AIDE_ICONS: Record<AideRubrique['icon'], string> = {
  pin: 'M21 10c0 6-9 12-9 12s-9-6-9-12a9 9 0 0 1 18 0zM12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  chat: 'M4 5h16v11H9l-5 4zM8 10h8M8 13h5',
  agenda: 'M3 5h18v16H3zM3 10h18M8 3v4M16 3v4',
  qr: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM20 14v3M14 20h3M20 20h1',
  absent: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM4 4l16 16',
  doc: 'M6 2h9l5 5v15H6zM14 2v6h6M9 13h6M9 17h6',
  swap: 'M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7',
  tag: 'M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z',
}
