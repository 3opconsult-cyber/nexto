# Audit : annonce, visibilité, carte (26/11/2026, session Prestataire)
Demande de Romain : une seule annonce par pro, publication simple, position floutée, carte et fiche à la Airbnb, litige en offre, rien de contournable. Lu dans le code, rien modifié. « Non vérifié » = pas vu sur capture.

## Ce qui est déjà bon
- Une annonce par prestataire : `provider_profiles` a une ligne par compte, `/pro/annonce` modifie cette ligne. Pas de second drapeau possible.
- Visible / Masqué existe (`VisibilitySwitch.tsx`). Facture automatique à la mission : en place (`generate_invoices`).
- Fiche publique `/pro/[id]` : ni téléphone ni adresse affichés.
- Zone « en intervention ici » : floutée par la base (grille 0,005 deg, soit environ 500 m ; A-TRANCHER m dit 2 km, à lever).

## Défauts trouvés (par gravité)
1. **Position exacte du domicile envoyée au client.** `providers_nearby` (dernière définition trouvée : 005) renvoie `ST_Y/ST_X` de `p.location`, sans flou. Tout client connecté lit les vraies coordonnées dans la réponse réseau. Le flou de 50 m voulu n'existe pas. Fichiers : `supabase/migrations/005_...sql`, `src/lib/services.ts`, `LiveMap.tsx`.
2. **Annonce publique sans filtre anti-contournement.** `chatFilter.ts` n'est appelé que dans le chat, les litiges et `demandes/new`. Accroche (90 car.) et présentation (1200 car.) de `/pro/annonce` acceptent téléphone, e-mail, rue.
3. **Publication en deux endroits.** Onboarding (596 lignes, 5 à 7 étapes) puis `/pro/annonce` (460 lignes) : le pro saisit adresse, tarif, présentation deux fois selon le chemin. Minimum de mise en ligne actuel : un tarif et une position (`canPublish`), ce qui est juste ; l'écran, lui, n'est pas guidé.
4. **Critères de confiance incomplets sur la carte.** La RPC renvoie `has_identity`, `has_rcpro`. Absents : CESU accepté, TVA récupérable, crédit d'impôt (le code existe : `creditImpot.ts`, `vatStatus` à l'onboarding), pas exposés au client.
5. **Carte : zoom, bandeau d'icônes, PING.** Non vérifié : besoin de ta capture iPhone (déjà en attente dans A-FAIRE Particulier). Le code a de la logique de recadrage (`LiveMap.tsx` l.193-285) mais aucune cause prouvée.
6. **Litige : la règle voulue n'est pas dans le code.** Aujourd'hui : litige dans les 24 h, arrangement par avoir (`AmicableSettlement`), décision PING. Voulu : le client fait une offre, le pro accepte ou refuse, le pro peut demander un règlement, le client a 24 h pour refuser, sinon accepté.
7. **Suppression de l'annonce** : non trouvée dans le code (seulement masquer). Non vérifié.

## Réponse à tes questions
- Plusieurs annonces par pro : non, et la structure l'empêche déjà. À écrire dans REGLES-METIER.
- Flou : 50 m est possible mais faible (à 50 m on retrouve l'immeuble). Je propose un réglage en base (`app_settings`, règle 3), 50 m par défaut comme décidé, et un décalage fixe par pro (pas aléatoire à chaque appel, sinon la moyenne retrouve le point). Tu peux le monter à 150 m sans toucher au code.
- Pro face à une demande de particulier : « Envoyer un PING » existe déjà côté pro. Manque : la fiche du pro avec critères et le geste Accepter / Refuser côté client.

## Qui fait quoi (règle ROUTAGE : un point = une session)
| Point | Session |
|---|---|
| 1 flou 50 m (migration SQL + test de fuite) | Données SQL (agent securite-donnees), voir aussi Prestataire |
| 2 filtre sur l'annonce, 3 publication en un parcours, 7 suppression | **Prestataire (cette conversation)** |
| Maquette de l'annonce, fiche pro en bas de carte, 5 zoom et PING | Design, voir aussi Particulier |
| 4 critères visibles (RPC) | Données SQL, puis Particulier pour l'affichage |
| Swipe Accepter / Refuser côté client | Particulier |
| 6 litige en offre, 24 h tacite, règle « une annonce par pro » | Règles métier (A-TRANCHER) |
| IBAN, carte bancaire partielle | Facturation et paiement (séquestre éteint, D-19 : aucun prestataire de paiement choisi, donc pas de carte enregistrée pour l'instant) |
| Facture auto | déjà fait ; rien à ouvrir |

Ordre proposé : 1 (sécurité), puis 2 et 3 (Prestataire), puis la maquette validée, puis la fiche sur la carte.
Maquette : `docs/maquette/maquette-annonce-v12.html` (3 écrans : publier, carte avec fiche, litige en offre).

## Précisions de Romain (26/11/2026, après la première maquette)
- Deux repères sur la carte : (1) point fixe de l'attache (entreprise ou résidence), jamais exact : zone d'environ 50 m ; (2) « Ici aujourd'hui », le prestataire actif en déplacement (existe, 058). Adresse exacte seulement après contrat payé.
- Le GPS du pro sert de témoin à l'arrivée et au message « en route, arrivée dans X min », calculé avec sa position. **Écart avec la règle 6** : aujourd'hui `DepartureBar.tsx` n'utilise aucun GPS (le pro choisit sa durée ; seul un minimum plausible est calculé depuis l'adresse). Y ajouter le GPS est une 3e exception : A-TRANCHER o.
- Charte : la maquette v12 n'était pas celle de l'application (polices, couleurs, barre du bas). Remplacée par **v13**, refaite sur `ping-ui.css` et les captures du 23/11. v12 est gardée, marquée remplacée.
- Fiche du pro : manquait le résumé court au toucher d'une épingle (maquette 2) ; la fiche complète existe déjà (maquette 3).
- Chat : accès direct à la commande des deux côtés, lien « Traiter le litige » (maquette 4).
- Litige en note : j'accepte, offre, contre-offre, j'annule mon litige (5). Si le problème vient du client : le pro se justifie, refuse, demande le règlement (6) ; le client a 24 h, doit refuser par écrit avec un motif, sinon le pro est payé (7). Existant : un seul montant proposé, accepté ou refusé (`AmicableSettlement`, 040). « Contre-offre », « Annuler mon litige » et le décompte de 24 h sur la demande de règlement : à créer.
Maquette : `docs/maquette/maquette-annonce-v13.html` (+ .png).
