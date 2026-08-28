import { NextRequest, NextResponse } from 'next/server'

/**
 * Liens courts de campagne — /l/<code>
 *
 * Pourquoi : une URL avec ses quatre paramètres UTM fait ~120 caractères, ce qui
 * pousse le QR vers une version très dense. Imprimé à 20 mm sur un sticker, il
 * ne se scanne plus (constaté en décodant les PDF rendus : le QR du sticker pro
 * ne passait pas). Un code court tient en QR version basse, lisible même petit.
 *
 * Bénéfice secondaire : la destination et l'attribution se changent ICI, sans
 * réimprimer un seul support. Les codes sont donc définitifs — on peut modifier
 * la cible d'un code, jamais le supprimer tant que des supports circulent.
 *
 * Toute modification doit rester synchronisée avec brand/kit.py (SHORT).
 */

const CAMPAIGN = 'lancement_grasse'

type Dest = { path: string; source: string; medium: string; content: string }

const LINKS: Record<string, Dest> = {
  // --- particuliers ---
  fp:  { path: '/landing-particulier', source: 'flyer',    medium: 'print',  content: 'flyer_a5_part' },
  af:  { path: '/landing-particulier', source: 'affiche',  medium: 'print',  content: 'affiche_a4' },
  ch:  { path: '/landing-particulier', source: 'chevalet', medium: 'print',  content: 'chevalet_a5' },
  st:  { path: '/landing-particulier', source: 'sticker',  medium: 'print',  content: 'sticker_part' },
  ig:  { path: '/landing-particulier', source: 'instagram', medium: 'social', content: 'post_part' },
  pp:  { path: '/comment-ca-marche',   source: 'pitch',    medium: 'presentation', content: 'pitch_part' },

  // --- prestataires ---
  fpr: { path: '/landing-pro', source: 'flyer',     medium: 'print',  content: 'flyer_a5_pro' },
  stp: { path: '/landing-pro', source: 'sticker',   medium: 'print',  content: 'sticker_pro' },
  igp: { path: '/landing-pro', source: 'instagram', medium: 'social', content: 'post_pro' },
  ppr: { path: '/comment-ca-marche', source: 'pitch', medium: 'presentation', content: 'pitch_pro' },

  // --- prospection directe (DM, vignettes de campagne) ---
  // ?c=<nom_du_prospect> est repris tel quel dans utm_content : un lien par prospect
  // sans avoir à créer un code pour chacun.
  dm:  { path: '/landing-pro', source: 'prospection_directe', medium: 'dm', content: 'vignette' },
}

export function GET(req: NextRequest, { params }: { params: { code: string } }) {
  const dest = LINKS[params.code?.toLowerCase()]
  const origin = req.nextUrl.origin

  // Code inconnu : on n'affiche pas d'erreur à quelqu'un qui vient de scanner un
  // flyer dans la rue — on l'envoie sur la carte, sans attribution.
  if (!dest) return NextResponse.redirect(new URL('/map', origin), 307)

  const custom = req.nextUrl.searchParams.get('c')
  const url = new URL(dest.path, origin)
  url.searchParams.set('utm_source', dest.source)
  url.searchParams.set('utm_medium', dest.medium)
  url.searchParams.set('utm_campaign', CAMPAIGN)
  url.searchParams.set('utm_content', custom ? custom.slice(0, 60) : dest.content)

  return NextResponse.redirect(url, 307)
}
