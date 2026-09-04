# PING — Alignement de l'app réelle sur /demo

Référence maîtresse : **`/demo`** (public/app.html, 46 écrans interactifs).
`/presentation` est l'animation d'accroche 46 s (film, non interactif) — sert
d'appui visuel, pas de référence.

Principe : pour chaque page réelle, ouvrir l'écran équivalent de `/demo`,
relever tous les écarts en une passe, corriger d'un coup, vérifier (tsc +
fetch), passer à la suivante. Pas de correctif au coup par coup.

## Alignement écran par écran

| Écran réel | Écran /demo | État |
|---|---|---|
| `/map` — carte | `v_map` | ✅ Barre haute flottante, carte plein cadre, barre basse 2 onglets, aperçu au clic (pin + carte liste), zoom repositionné, page forcée dynamique (fin du cache) |
| `/pro/[id]` — fiche prestataire | `v_provider` | 🔄 En cours — hero, lignes d'info, spécialités, badges qualifications (identité/assurance/crédit d'impôt), avis « après prestation », mention place de marché |
| Menu burger (`NavDrawer`) | menu latéral /demo | ⬜ À faire |
| `/mission/[id]/chat` | `v_chat` | ⬜ À faire |
| `/pro/dashboard` | `p_dash` | ⬜ À faire |
| Réservation / paiement | `v_booking` / `v_pay` | ⬜ À faire |
| Suivi arrivée + QR | `v_track` / `v_qr` | ✅ Flux séquentiel 2 étapes déjà fait |
| Reçu + note | `v_receipt` / `v_review` | ⬜ À vérifier |

## Évolutions fonctionnelles à produire (après l'alignement)

### 1. Trois modes de tarification (PRIORITÉ — demandé le 04/09)
Le prestataire prédéfinit ses prestations et prix ; le client choisit, le prix
s'affiche directement (**pas de devis, pas de négociation**). Trois modes :

- **Forfait fixe** — prix unique quelle que soit la durée. Le scan sert de
  preuve de présence, ne change pas le prix.
- **Horaire pur** — prix à l'heure, facturé sur le temps réel mesuré au scan.
- **Forfait + socle d'heures + heures supp** — prix de base couvrant N heures
  incluses, puis tarif/heure au-delà. Ex : forfait 150 € (3 h incluses) +
  35 €/h ; arrivée 10 h → départ 15 h = 5 h → 150 € + 2×35 € = **220 €**.

Dans les trois cas, le **QR arrivée/départ déclenche le calcul final**.

Chantier : table `prestations` liée au prestataire (mode + prix forfait +
heures incluses + tarif heure supp), écran pro de gestion du catalogue,
affichage du choix côté client, extension du calcul dans
`/mission/[id]/scan/[phase]`. La fiche prestataire a déjà une structure
catégorie/définition/prix — le modal de saisie devra évoluer sur ce point.

Points à trancher avant de coder :
- Un prestataire peut-il mélanger plusieurs modes dans son catalogue ? (a priori
  oui, déjà partiellement le cas)
- Mode 3 : si le prestataire finit avant d'épuiser le socle, forfait plein ou
  ajusté à la baisse ?

## Adaptations assumées (divergences /demo justifiées)

- **« Contacter par chat » → parcours de réservation** : le chat n'existe qu'une
  fois une mission créée (pas de messagerie libre avant), donc l'action réelle
  mène à la réservation, pas à un chat sans mission. La démo montre un chat
  libre qui n'a pas d'équivalent réel en l'état.
- **Codes QR courts (« 3726 ») de la démo** : le vrai système utilise des jetons
  longs, pas de code court en base — non reproduit.
- **Carte** : la vraie carte (Leaflet, OSM) remplace le dessin schématique de la
  démo — c'est un gain, pas un écart à corriger.
