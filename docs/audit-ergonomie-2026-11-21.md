# Audit ergonomie mesuré — 21/11/2026 (écrans du 20/11)

Méthode du 19/11 : Playwright, mobile 390×844 tactile (et 1280×900 pour les listes), comptes audit client et pro, missions de
test « QA ergo … » créées par réservation directe (jamais de données réelles). « Avant » = production (nexto-eta.vercel.app) ;
« après » = build local de cette branche contre la même base. Rien n'est poussé : les corrections ne sont pas en production.
Scripts non versionnés (scratchpad). Captures : `docs/audit-2026-11-21/`.
Limites : le délai « jusqu'au bouton » est mesuré sur un serveur local pour l'après (pas de latence Vercel) ; les mesures de
délai de l'agenda / Messages / fiche sont inexploitables (le texte attendu apparaissait déjà dans la coquille de page), seuls
les NOMBRES DE REQUÊTES sont fiables pour ces écrans.

## Défauts trouvés et corrigés

| # | Défaut (mesuré) | Correction |
|---|---|---|
| 1 | **Bloquant mobile** : les fenêtres d'annulation / report (`Sheet`, z-index 80) passaient SOUS la barre du bas (z-index 1500). Le bouton « Annuler quand même » et les boutons de confirmation étaient interceptés (Playwright : « app-bottom-bar intercepts pointer events », clic impossible, voir `avant-annulation-tardive-barre-par-dessus.webp`) | z-index 3000 (comme `Modal`) ; focus entré dans la fenêtre et rendu à l'ouverture |
| 2 | Chat : 63 à 103 requêtes au chargement, 7 à 9 `/auth/v1/user`, jusqu'à 19 `presence_state`, 4 à 6 `unread_counts`, 13 à 20 `transactions`, lecture en cascade (7 allers-retours en série) ; bouton clé visible en 1,0 à 2,1 s | `getUser` partagé 15 s (client Supabase), `presence_state` / `unread_counts` / `expire_pending_bookings` / « mission du jour » dédoublonnés, chat lu en parallèle avec la session locale. Résultat : 39 à 43 requêtes, 1 `/auth/v1/user`, 7 `presence_state`, 2 `unread_counts`, bouton clé en 0,85 s. Agenda 54-62 → 29-35 requêtes, Messages 48-57 → 22-30, fiche 56 → 25 |
| 3 | « Annuler » caché dans le menu « … » (3 appuis : « … », Annuler, Confirmer) ; réservation en attente côté client sans bouton visible | « Annuler » visible à côté de « Reporter » dans la mission (2 appuis) ; le menu « … » reste ; une seule fenêtre, état déjà lu (plus de « Chargement… » à l'ouverture) |
| 4 | Bandeau « N nouvelles réservations : accepter » posé par-dessus la zone de saisie du chat (cache le bouton Envoyer) | Jamais affiché dans une conversation (la carte Accepter/Refuser y est) |
| 5 | Formulaire de litige : zone de texte sans libellé ni indication ; volet sans `role="dialog"` | Libellé « Ce qui ne va pas » + indication, `dialog`, erreur effacée à la saisie |
| 6 | Cibles < 44 px : motifs de refus 40 px ; TransferCard « Copier » ~24 px et boutons ~38 px ; interrupteur « Je suis en intervention ici » 52×30 ; « Remplacer » (pièces client) 86×33 ; champs IBAN 42 px ; lien CGV 19 px | 44 px partout (interrupteur : zone de toucher 60×44 autour du même dessin) |
| 7 | Litiges (liste) : lignes cliquables sans rôle ni clavier ; bulle verte « Laisser un commentaire » par-dessus le fil du litige | `role="link"` + Entrée/Espace ; bulle masquée sur `/litiges/…` |

## Tableau tâche par tâche (mobile)

| Tâche | Appuis avant → après | Temps / requêtes | Cibles < 44 px | Note |
|---|---|---|---|---|
| Annuler, gratuite (réservation en attente) | 3 → **2** (Annuler, Confirmer) | fenêtre immédiate (plus d'attente) | aucune | 10 |
| Annuler, motif sérieux (prestataire en route) | impossible sur mobile (barre) → 3 par « … » / **2** par le bouton | idem | aucune | 10 |
| Annuler, frais totaux (double confirmation) | bloqué → 4 par « … » / **3** (Annuler, Annuler quand même, Confirmer et être facturé 108,00 €) | idem | aucune | 10 (la double confirmation est voulue) |
| Reporter (proposer) | 2 (bloqué au 2e par la barre) → **2** | idem | aucune | 10 |
| Report : l'autre partie accepte / refuse | **1** (Accepter 93×44) | | aucune | 9 : le bandeau est en haut de page alors que le fil est calé en bas, il faut remonter |
| « Le prestataire n'est pas arrivé » / « Clôturer sur preuve » | non testé en réel (exige un RDV passé de 30 min / 2 h sans la clé service) ; code relu : 2 appuis, cibles 44 px | | | non noté |
| Prestataire : accepter une réservation | **1** (Accepter 186×48) | chat prêt en 0,85 s | aucune | 10 |
| Prestataire : refuser (motif facultatif) | **2** (Refuser, Confirmer le refus) | | motifs 40 → 44 | 10 |
| Client : réservation en attente / refusée | texte clair, « Choisir un autre prestataire » 1 appui ; « Annuler » ajouté | | aucune | 10 |
| Prestataire : annuler (motif obligatoire) | **2** (Annuler, motif) | | aucune | 10 |
| Ouvrir un litige | **4** (Signaler, Ouvrir un litige, motif, Ouvrir le litige) + 1 saisie | 4,6 s avec la saisie | aucune | 9 : 2 appuis de choix avant le formulaire (le choix existe pour distinguer signalement privé et litige) |
| Dossier de litige (arrangement, intervention de PING) | **1** (Demander l'intervention de PING 328×44) | dossier prêt en 0,83 s | aucune | 9 : aucune confirmation avant d'appeler PING (action sans retour) ; le fil duplique le texte « paiement bloqué » |
| Carte « Litige » / message PING dans le chat | lecture seule, 44 px | | aucune | 10 |
| TransferCard « Non reçu » / « Mon virement est bien parti » | non déclenchable sans facture à virement ouverte ; code corrigé (boutons et « Copier » à 44 px) | | corrigé | non mesuré en réel |
| /pro/paiements | | 53 → 30 requêtes | champs 42 → 44, lien CGV 19 → 44 | 9 |
| /pro/documents, /client/documents (refus, « Renvoyer ») | | pro/documents 1,3 à 2,0 s avant le contenu | « Remplacer » 33 → 44 | 8 : 1,3 s, motif de refus non reproduit (aucune pièce refusée sur les comptes audit) |
| « Je suis en intervention ici » (carte pro, Mon entreprise) | 1 | | 30 → 44 | 10 |
| Repère « Ici aujourd'hui » (carte client) | non vérifié : aucune zone active sur les comptes audit (écriture géoloc non faite) | | | non noté |
| Fluidité chat | | requêtes 63-103 → 39-43 ; bouton clé 1,0-2,1 s → 0,85 s | | 9 |
| Admin | | `/admin` sans session redirige vers `/auth/login?next=/admin`, 0 erreur console | | 10 (état clair) |

## Fluidité : détail
Chat (client, mission acceptée, 2e visite) : 55 → 39 requêtes, `/auth/v1/user` 7 → 1, `unread_counts` 4 → 2, `presence_state` 13 → 7.
Chat (prestataire) : 73 → 43, `/auth/v1/user` 9 → 1, `expire_pending_bookings` 2 → 1. Aucune réponse 400/404 inutile n'a été relevée
avant ou après (les sondes de migration sont déjà mémorisées), zéro erreur console sur tous les écrans.
Le « bouton qui apparaît tard » du parcours de test : la cascade `getUser` → messages → `expire_pending_bookings` → transaction
→ profil → contreparties → avis retardait le rendu du bandeau et des boutons ; ils partent désormais en parallèle.

## Défauts restants et raisons
- `presence_state` encore appelé ~7 fois par chargement : les 3 missions du jour candidates du compte audit × 2 lectures (barre + page) ; borné par
  le dédoublonnage mais pas supprimé sans une RPC groupée (demande un changement en base, non permis ici).
- Le bandeau « Report proposé » est en tête de page ; la conversation se cale en bas : pas déplacé (refonte de la mise en page du chat).
- « Demander l'intervention de PING » sans confirmation : décision produit (1 appui voulu le 20/11), à trancher avec Romain.
- Absence du prestataire, clôture sur preuve, TransferCard en réel, pièce refusée, repère « Ici aujourd'hui » : non reproductibles avec ces comptes sans
  écriture en base ou clé service ; relus dans le code seulement.
- Délais mesurés « après » sur serveur local : à remesurer en production après déploiement.
- Missions de test « QA ergo … » laissées en base (annulées, une avec frais totaux et ses 3 documents de facturation, un litige ouvert).
