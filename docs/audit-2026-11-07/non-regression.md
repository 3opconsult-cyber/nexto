# Contrôle de non-régression : app en production et démo /demo face à la maquette de refonte

Date : 7/11/2026. Lecture seule du dépôt : aucun fichier existant n'a été modifié.

Ce qui a été comparé :
- **App en production** : `src/app`, `src/components`, `src/lib`, plus le super admin `public/admin.html`. Chaque élément a été vérifié dans le code. Les références sont données en `fichier:ligne`, chemins relatifs à la racine du dépôt.
- **Démo** : `public/app.html` (servie sur `/demo`, 46 balises `<section class="view">`).
- **Maquette** : `docs/audit-2026-11-07/maquette-artefact/index.html` et `data.js` (copie servie : `public/maquette.html`). Les noms d'écran cités sont les clés `SC.<écran>` de la maquette. On les ouvre depuis le panneau « Aller à » (`GOTO`).
  - La maquette était **en cours de modification pendant l'audit** : elle est passée de 711 à 785 lignes. Ont été ajoutés en cours de route : `mailck`, `onb`, `locperm`, `attente`, `a_catalog`, `a_catnew`.
  - L'état retenu est celui de 18 h 25 UTC. Les numéros de ligne de la maquette ne sont pas cités, car ils bougent.

Légende de la colonne « Maquette » :
- **présent** : la fonction existe dans un écran de la maquette, avec le même bénéfice.
- **partiel** : elle est esquissée, mais il manque une partie qui fonctionne aujourd'hui.
- **absent** : aucun écran ne la porte.

---

## 1. Visiteur et inscription

| # | Fonction | Où dans l'app (fichier:ligne) | Bien fait parce que… | Maquette | Écran maquette | À ajouter |
|---|---|---|---|---|---|---|
| V1 | L'app n'est pas visitable sans compte : redirection vers l'inscription, avec `?next=` | `src/components/AuthGate.tsx:41` | Décision Romain du 03/11. Après inscription, le visiteur revient sur la page qu'il voulait ouvrir. | présent | `welcome` (META) | Garder `?next=` après inscription et connexion. |
| V2 | Plaquette `/bienvenue` : choix du rôle, puis « Suivre le parcours » ou « Voir l'animation », puis écran bêta | `public/bienvenue.html` (généré par `brand/plaquettes/build_bienvenue.py`) | Un seul lien à envoyer aux prospects. Le rôle est choisi d'entrée. | partiel | `welcome` | Bouton « Voir l'animation » (`/animation-client` ou `/animation-prestataire` selon le rôle). Rappel bêta : les paiements ne sont pas réels. |
| V3 | Inscription en 2 étapes, avec glisser et bouton retour | `src/app/auth/signup/page.tsx:37`, `:87-93` | L'étape 2 se défait sans perte de saisie. Le glisser marche au doigt. | présent (en 1 écran) | `signup` | Rien. Garder la conservation de la saisie quand on ouvre les CGV. |
| V4 | Écran « Vérifiez votre boîte mail » | `src/app/auth/signup/page.tsx` | Évite l'impasse d'un compte non confirmé. | présent | `mailck` | Lien « Voir l'animation » (il existe aujourd'hui sur cet écran). |
| V5 | Code de parrainage `?ref=` gardé puis enregistré, et attribution des liens `/l/<code>` (stickers, QR) | `src/app/auth/signup/page.tsx:51`, `src/lib/referral.ts:29`, `src/app/l/[code]/route.ts` | Permet de savoir quel sticker ou quel parrain amène l'inscrit. Invisible pour l'utilisateur. | absent | `signup` | Mention « Invité par … » si un code est présent. Conserver le mécanisme invisible. |
| V6 | Connexion avec `?next=`, « Mot de passe oublié » qui envoie un vrai e-mail, et page de nouveau mot de passe | `src/app/auth/login/page.tsx:39`, `:52` ; `src/app/auth/reset/page.tsx:41` | Parcours de récupération complet. | partiel | `login` | Écran « Nouveau mot de passe » (`/auth/reset`). |
| V7 | Accueil du particulier en 3 écrans, montré une seule fois | `src/components/WelcomeCarousel.tsx:9` (`ping_welcome_seen`) | Comble l'asymétrie avec le tunnel du prestataire. | présent | `onb` | Rien. |
| V8 | Assistant du prestataire : une décision par écran, barre de progression, glisser | `src/components/OnboardingStep.tsx`, `src/app/pro/onboarding/page.tsx:63` | Parcours « clic en clic » demandé par Romain. | présent | `pwiz` (4 étapes, brouillon) | Rien. |
| V9 | SIRET : recherche dans l'annuaire public, statut juridique deviné | `src/lib/legalLookup.ts`, `src/app/pro/onboarding/page.tsx:6` | Le pro tape 14 chiffres, le reste se remplit tout seul. | présent | `siret`, `pwiz` étape 1 | Rien. |
| V10 | Pro « particulier » : ni étape entreprise ni Kbis | `src/app/pro/onboarding/page.tsx:14`, `:106` ; `src/app/pro/onboarding/documents/page.tsx:50` | Ouvre la plateforme aux non-immatriculés. | présent | `pwiz` (Entreprise / Particulier) | Masquer aussi URSSAF et Kbis dans `pprofile` pour un particulier. |
| V11 | Téléphone obligatoire au format français, chiffré, jamais publié | `src/app/pro/onboarding/page.tsx:18`, `:39` | Contact de secours sans fuite publique. | présent | `pwiz` étape 2 | Rien. |
| V12 | CGV prestataires obligatoires, versionnées (`cgv_accepted_at`, `cgv_version`) | `src/components/CgvAccept.tsx`, `src/lib/cgv.ts` | Preuve contractuelle du contrat de commission et du mandat SEPA. | présent | `pwiz` étape 4 | Lien vers le texte des CGV (`/cgu#prestataires`). |
| V13 | Visibilité du pro : `is_active=true` dès la fin de l'assistant, et conservée quand il réédite | `src/app/pro/onboarding/page.tsx:105`, `:198` | Le pro n'est jamais masqué par erreur. | partiel (règle différente) | `attente` | **Décision à confirmer** : la maquette rend le pro visible après validation de l'identité, l'app dès la fin de l'assistant. |
| V14 | Écran de clôture du prestataire (`/pro/attente`), avec « Voir l'animation » | `src/app/pro/attente/page.tsx:28` | Dit au pro ce qui se passe ensuite. | présent | `attente` | Bouton « Voir l'animation ». |
| V15 | Bulle verte « Laisser un commentaire », masquée sur `/auth`, `/mission/*`, `/essai` | `src/components/FeedbackBubble.tsx:9`, `:60` ; `src/app/layout.tsx:62` | C'est le canal des retours de l'avant-première, annoncé sur `/bienvenue`. | absent (seul l'admin `a_fb` existe) | `map` | Bulle sur les écrans utilisateur, placée au-dessus du volet sans couvrir les boutons de la carte. |
| V16 | Invitation à installer l'application (PWA) | `src/components/InstallPrompt.tsx:27` | Raccourci sur l'écran d'accueil du téléphone. | absent | – | Invitation discrète après la première mission. |
| V17 | Pages légales `/cgu` (dont `#prestataires`) et `/confidentialite` | `src/app/cgu/page.tsx`, `src/app/confidentialite/page.tsx` | Requises pour l'acceptation des CGV. | absent (simple message) | `signup` (`cgv`) | Volet de lecture des CGV et de la confidentialité. |
| V18 | Support PING : conversation en direct | `src/app/support/page.tsx:39` (canal Supabase) | Un humain répond. Entrée en bas du menu. | absent | `help` | Ligne « Écrire au support » dans l'Aide et dans le profil. |

## 2. Client (particulier)

| # | Fonction | Où dans l'app (fichier:ligne) | Bien fait parce que… | Maquette | Écran maquette | À ajouter |
|---|---|---|---|---|---|---|
| C1 | Carte réelle (Leaflet et OSM) avec position et prestataires proches (`providers_nearby`, `p_lat`/`p_lng`) | `src/components/LiveMap.tsx`, `src/components/DemoShell.tsx:131` | Vraie carte, sans GPS en continu. | présent (carte dessinée) | `map` | Rien. |
| C2 | Écho radar autour des prestataires disponibles, et bouton PING qui relance la recherche | `src/components/LiveMap.tsx:11-15`, `src/components/DemoShell.tsx:167` | C'est la signature visuelle de la marque (anneaux d'écho). | partiel | `map` (écho sur les épingles `.a.live`) | Bouton rond « PING » à halo (`.pingbtn`), qui relance la recherche avec l'onde radar. |
| C3 | Filtres : Disponible, Pièce d'identité fournie, Assurance RC renseignée, moins d'1 km, 4 étoiles et plus | `src/components/DemoShell.tsx:112-116`, `:264` | Tri par niveau de confiance, en langage déclaratif. | partiel (Disponible et service seulement) | `map` | Filtres de confiance et de distance, et tri « Plus proches / Mieux notés / Prix croissant » (démo `v_search`). |
| C4 | Bascule vers l'espace prestataire depuis la carte | `src/components/ModeSwitchPill.tsx`, `src/components/DemoShell.tsx` | Un même compte, deux espaces (comme Airbnb). | présent | `map` (bouton d'échange) | Rien. |
| C5 | Fiche prestataire : pièces fournies, avis « après prestation », accroche, points forts, galerie, rayon d'intervention | `src/app/pro/[id]/page.tsx:145-165`, `:208` ; `src/components/ListingExtras.tsx` | Fiche riche et déclarative. Le nom de l'auteur d'un avis passe par la RPC `review_rater_names`. | partiel | `procard` | Galerie de photos, points forts, rayon. « Vérifié par PING » seulement si `documents.status = valid`. |
| C6 | Favoris : cœur sur la fiche et liste dédiée | `src/app/pro/[id]/page.tsx:60-61`, `:126` ; `src/app/client/favoris/page.tsx:19` | On retrouve son prestataire en un appui. | partiel (liste seulement) | `favs` | Cœur sur `procard`. |
| C7 | « Réserver » passe par l'écran de prix (`mission/new`) : choix forfait ou horaire, prix figé | `src/app/pro/[id]/page.tsx:67`, `src/app/mission/new/page.tsx` | Règle suprême du tarif : le prix est validé au départ. | présent | `book` | Rien. |
| C8 | Créneaux réservables du pro (`provider_slots`, réservation atomique `book_slot`, revérifiée juste avant) | `src/app/mission/new/page.tsx:65`, `:129`, `:181` ; `src/lib/slots.ts:10` | Pas de double réservation. Le créneau se libère à l'annulation. | partiel (3 pastilles fixes) | `book` (« Quand ? ») | Grille des créneaux réels du pro, par jour (démo `v_booking`). |
| C9 | Date et heure au choix quand le pro n'a pas publié de créneau | `src/app/mission/new/page.tsx:232`, `src/components/DayTimePicker.tsx` | Pose toujours `scheduled_at`, donc l'agenda est daté. | partiel | `book` | Sélecteur jour et heure en repli. |
| C10 | Adresse du profil présélectionnée ; une autre adresse passe en « à valider », masquée sans numéro | `src/components/AddressChoice.tsx:60`, `src/app/mission/new/page.tsx:226`, `src/lib/address.ts` | Respecte l'invariant de l'adresse. Rien à ressaisir. | présent | `book` (3. Adresse) | Rien côté client (le côté pro est en P8). |
| C11 | Frais de service lus dans le réglage (`getRates()`), pas codés en dur | `src/lib/pricing.ts`, `src/app/mission/new/page.tsx` | La commission se règle sans déploiement. | présent (8 % affiché) | `book` | Dans le code final, lire le taux et ne pas le coder en dur. |
| C12 | Fenêtre « rien n'est débité », règlement par virement sur facture | `src/components/PaymentPendingModal.tsx`, `src/app/mission/new/page.tsx:10` | Honnête : le paiement en ligne est éteint. | partiel | `book`, `pay` | Une phrase sous « Confirmer » : « Vous réglerez par virement après la mission ». |
| C13 | Avance immédiate du crédit d'impôt (« payez 50 % »), prête mais éteinte | `src/lib/creditImpot.ts`, `src/app/client/avance-immediate/page.tsx:77` | Prête au branchement de l'API Urssaf. | partiel (onglet Après le lancement) | – | Ligne « Crédit d'impôt » dans le profil, avec la mention « bientôt ». |
| C14 | Annonce détaillée : heures, surface, nombre de pièces, kilos et types de linge, fréquence 1 à 3 fois par semaine, foyer, CESU ou paiement direct, date et créneau, budget minimum et maximum | `src/app/client/demandes/new/page.tsx:35-278`, `src/components/RequestDetails.tsx:24-46` | Champs adaptés au service : surface pour le ménage, kilos pour le repassage. Le pro chiffre sans aller-retour. | partiel (service, moment, urgence, budget, texte libre) | `reqnew` | Champs conditionnels par service : surface et pièces, linge, fréquence, CESU. |
| C15 | « C'est urgent » : épingle orange et demande en tête de liste | `src/app/client/demandes/new/page.tsx:53`, `:130`, `:250` | Réactivité, l'argument de la marque. | présent | `reqnew` | Rien. |
| C16 | Adresse d'intervention géocodée : la position de l'annonce est l'adresse, pas le téléphone | `src/app/client/demandes/new/page.tsx:95` | Les distances vues par les pros sont justes. | **absent** | `reqnew` | Bloc Adresse (profil confirmé, ou autre adresse). |
| C17 | Refus du téléphone et de l'e-mail dans le titre et la description | `src/app/client/demandes/new/page.tsx` | Anti-contournement dès l'annonce. | partiel (mention dans META) | `reqnew` | Message d'erreur à la saisie. |
| C18 | Mes demandes : plusieurs propositions comparables (prix, note, distance, extrait, Accepter), annulation de la demande | `src/app/client/demandes/page.tsx:181`, `:192`, `:234`, `:249` | Plus aucune proposition perdue (bug corrigé le 17/09). | partiel (prix et note) | `myreqs`, `props` | Distance, extrait du message, « Échanger », « Annuler la demande » (démo `v_offre_detail`). |
| C19 | Négociation dans le chat : offre forfait, horaire seul, ou forfait avec heures incluses et dépassement, photo jointe, Accepter / Refuser / contre-proposition | `src/app/mission/[id]/chat/page.tsx:45-48`, `:227-303`, `:828` | Seul mécanisme de prix d'une demande ouverte. Le cas forfait avec dépassement est validé en réel (17/09). | partiel (accepter, lien sans formulaire) | `chat` | Formulaire « Proposer un tarif » (3 modes, heures incluses, tarif de dépassement), bouton Refuser, contre-offre affichée. Le tout masqué dès qu'un devis est accepté. |
| C20 | Carte « Fixez le rendez-vous » après l'accord (adresse et date, géocodage) | `src/app/mission/[id]/chat/page.tsx:537` | Sans elle, un « Contacter » n'aboutit jamais à une mission datée (bloquant corrigé le 30/10). | **absent** | `chat` | Carte RDV dans la conversation dès que le prix est confirmé. |
| C21 | Récapitulatif de la demande en tête du chat | `src/app/mission/[id]/chat/page.tsx:504` | Contexte constant pendant la négociation. | absent | `chat` | Encadré repliable de la demande. |
| C22 | Filtre anti-contournement : téléphone, e-mail et adresse masqués dans les messages | `src/lib/chatFilter.ts:20-24`, `src/app/mission/[id]/chat/page.tsx:17` | Protège la commission et la sécurité. | absent | `chat` | Rien de visible à concevoir. Prévoir le message « numéro masqué ». |
| C23 | Messages système (réservation, en route, arrivée, fin, annulation, litige) au nom de l'auteur | `src/lib/systemMessage.ts` | Fil chronologique fiable. Aucun `sender_id` nul. | partiel (frise de mission) | `mission`, `chat` | Lignes système dans le chat (style gris, sans emoji). |
| C24 | « Signaler cet échange » : modération, distincte du litige | `src/app/mission/[id]/chat/page.tsx:81-99` | Sert à un comportement inapproprié avant toute mission. | absent | `chat` | Entrée « Signaler » dans le menu de la conversation. |
| C25 | Annulation de la mission, avec frais tardifs de 15 % si le pro est en route ; pas d'annulation après l'arrivée | `src/app/mission/[id]/chat/page.tsx:314-322` | Règle claire, appliquée aussi en base par un trigger. | **absent** | `mission` | Bouton « Annuler la mission », avec confirmation et montant des frais. |
| C26 | « Mes codes QR » accessibles depuis le chat | `src/app/mission/[id]/chat/page.tsx:550`, `:564` | Les QR sont trouvables hors réservation directe. | présent | `mission`, `qr`, bandeau | Rien. |
| C27 | QR unique « sur place », imprimable, pour un client absent | `src/app/mission/[id]/qrcodes/page.tsx:30`, `:147` ; `src/app/mission/[id]/qrcodes/imprimer/page.tsx` | Le client laisse le QR sur place, le pro valide son arrivée sans lui. | absent | `qr` | Bouton « Laisser un QR sur place (imprimer) ». |
| C28 | Code à 6 chiffres lu par le client (valable 15 min, 5 essais) | `src/app/api/arrival/route.ts:9`, `:53` ; `src/lib/arrival.ts` | Secours sans GPS si le client est joignable. | partiel (une phrase) | `qr` | Écran client « Votre code d'arrivée : 482 913 ». |
| C29 | « Un problème ? Signaler avant de valider » à l'étape du QR de fin | `src/app/mission/[id]/qrcodes/page.tsx:127` | Le litige se fait avant de valider la fin. | partiel (bouton Signaler dans la mission) | `mission`, `qr` | Lien « Signaler avant de valider » sur le QR de fin. |
| C30 | Bandeau « Intervention en cours » ; « Je pars » posé par le pro seul, jamais effacé | `src/components/DepartureBar.tsx:53-55` | Le client sait où en est le pro, sans GPS. | présent | `missionBanner`, `mission` | Rien. |
| C31 | Heure entamée : durée réelle au scan de fin, forfait avec dépassement, minimum 1 h | `src/app/mission/[id]/scan/[phase]/page.tsx:114-118`, `src/lib/pricing.ts:39` | Règle Romain du 29/10, seuil réglable. | partiel (« durée calculée », réglage admin) | `mission`, `qr`, `invoice` | Après le scan de fin : « Durée : 4 h 12, facturée 4 h (seuil 10 min) » et détail du dépassement. |
| C32 | Agenda Jour / Semaine / Mois, litige en tête, badges Confirmé / En route, mission terminée vers facture, rendez-vous confirmés seulement | `src/components/calendar/Calendar.tsx:8-33`, `src/app/agenda/page.tsx:84-109`, `:162` | Romain aime l'agenda de la démo. Vue datée par `scheduled_at`. | **absent** (liste Missions seulement) | `missions` | Vue Agenda (onglet ou bascule Liste / Calendrier dans Missions). |
| C33 | Facture : 3 documents, PDF (y compris au-delà de 1 000 €), en-tête du prestataire, chacun ne voit que sa commission | `src/app/mission/[id]/facture/page.tsx:72`, `src/lib/invoice-pdf.ts` (`pdfSafe`) | Modèle juridique validé, vérifié de bout en bout. | présent | `invoice` | Rien. |
| C34 | Carte virement : IBAN du pro donné après la mission, statuts à payer / annoncé / reçu / en retard, « J'ai fait le virement » | `src/components/TransferCard.tsx:57`, `:98`, `:149` ; `src/lib/transfers.ts` | C'est le seul moyen de paiement actif. Relance automatique à 15 jours. | partiel | `pay`, `invoice` | IBAN et référence sur la facture. Statut du virement. Mention « CESU ou espèces : le pro note reçu ». |
| C35 | Mes opérations : export CSV, relevé annuel PDF et CSV, partage d'une facture (comptable, SMS, e-mail) | `src/app/documents/page.tsx:105-109`, `:241` ; `src/components/ShareInvoiceSheet.tsx:24-57` | Utile pour l'Urssaf, les impôts et le comptable. | **absent** (« Télécharger le PDF » seulement) | `missions:fact`, `invoice` | Boutons Partager, Relevé annuel, Export CSV dans l'onglet Factures. |
| C36 | Avis : note de qualité, note de service, « je recommande », pourboire (une intention), commentaire | `src/components/ReviewModal.tsx:39-69` | Note fine. Recalcul automatique de la note du pro. | partiel (étoiles et commentaire) | `review` | Deux critères, « Recommandez-vous ? », pourboire facultatif. |
| C37 | Avis proposé depuis la facture (`chat?avis`), jamais seul pendant un litige | `src/app/mission/[id]/facture/page.tsx:329` | Avis à la demande, au bon moment. | présent | `invoice`, `review` | Rien. |
| C38 | « Avis publiés » par le client | `src/app/client/avis/page.tsx:27` | Transparence sur ses propres avis. | absent | `profile` | Ligne « Mes avis » dans le profil. |
| C39 | Litige structuré : motif, montant réclamé, photos, échéance de 48 h posée en base | `src/components/DisputeFields.tsx:45`, `src/app/mission/[id]/chat/page.tsx:412` | Dossier complet dès l'ouverture. | présent | `dnew` | Photo obligatoire et descriptions des motifs, comme la démo `v_litige`. |
| C40 | Dossier de litige dédié `/litiges/[id]` : fil, médiation PING, photos visibles par l'autre partie, versement bloqué | `src/app/litiges/[id]/page.tsx:44`, `:64`, `:96` | Centre de résolution à la Airbnb. Rien ne se perd dans le chat. | présent | `dispute` | Afficher les photos du dossier. Bloc « Sa demande / Sa proposition / Écart » (démo `v_litige_suivi`). |
| C41 | « Mes réclamations » (liste des litiges) | `src/app/litiges/page.tsx:34` | Accès direct. | partiel (dans Terminées) | `missions` | Filtre « Litiges » ou badge dans Missions. |
| C42 | Messages non lus : pastille sur l'onglet, ligne en gras, lecture notée à l'ouverture | `src/lib/unread.ts:13`, `src/components/BottomTabBar.tsx:5-6`, `src/app/messages/page.tsx:191` | On voit tout de suite ce qui attend. | partiel (étiquette « Nouveau ») | `messages`, barre du bas | Pastille numérotée sur l'onglet Messages. |
| C43 | Séparation des espaces (achats en particulier, ventes en pro), cloche qui signale ce qui attend dans l'autre espace | `src/lib/mode.ts`, `src/components/ModeHint.tsx:8`, `src/app/messages/page.tsx:108` | Un compte mixte ne mélange pas ses missions. | partiel (bascule seule) | `profile`, `pprofile` | Cloche « 1 conversation vous attend dans l'espace prestataire ». |
| C44 | E-mails de notification (message, offre, réservation, litige), au plus 1 toutes les 10 min, sans le contenu du message | `src/lib/notify.ts`, `src/app/api/notify` | Prêts, éteints sans clé d'envoi. | présent (Après le lancement) | – | Rien. |
| C45 | Profil en rubriques (Mon activité, Paiements, Mon compte, Plus) | `src/app/client/profil/page.tsx:103-127`, `src/components/Hub.tsx` | Même structure dans les deux espaces (demande Romain du 30/10). | présent | `profile` | Rien. |
| C46 | Pièce d'identité du client : dépôt et visionneuse | `src/app/client/documents/page.tsx:45` | Statut clair, document jamais public. | présent | `idcap` | Rien. |
| C47 | « Coordonnées et confidentialité » : ce qui est visible et ce qui est masqué | `src/app/client/confidentialite/page.tsx` | Rassure en langage déclaratif. | absent | `profile`, `account` | Ligne « Ce que voit le prestataire ». |
| C48 | Parrainage avec les vrais compteurs (filleuls, missions terminées), sans récompense annoncée | `src/app/client/parrainage/page.tsx:17`, `src/lib/referral.ts` | Fonction en place. Rien n'est promis. | **absent** | `profile` | Ligne « Mon parrainage » (code, partage, compteurs). |
| C49 | « Comment ça marche » : une animation par rubrique | `src/lib/aide.ts:19`, `src/components/TutoPlayer.tsx:6`, `src/app/aide/[slug]/page.tsx:17` | Tutoriels en vidéo réels, déjà construits. | partiel (simple message) | `help` | Lecteur intégré `/animation-client?embed=1&scene=N`. |
| C50 | « Proposer mes services » depuis le profil | `src/app/client/profil/page.tsx:127` | Recrutement des prestataires depuis la base des clients. | présent (bascule) | `profile` | Rien. |
| C51 | Édition du profil (nom, téléphone chiffré, adresse) | `src/app/client/profil/page.tsx` | Modifiable sur place. | présent | `account` | Rien. |
| C52 | « Moyens de paiement » volontairement inerte (« Bientôt ») | `src/app/client/profil/page.tsx:113` | Aucune fausse interface de paiement. | présent (virement) | `pay` | Rien. |

## 3. Prestataire

| # | Fonction | Où dans l'app (fichier:ligne) | Bien fait parce que… | Maquette | Écran maquette | À ajouter |
|---|---|---|---|---|---|---|
| P1 | Demandes ouvertes autour de soi (RPC `requests_nearby` en SECURITY DEFINER, position floutée à environ 500 m, sans ses propres demandes) | `src/app/pro/carte/page.tsx:133`, `:305` | Corrige le bug majeur du 30/10 (carte toujours vide). Pas de fuite d'adresse. | présent | `pmap` | Rien. |
| P2 | Demandes urgentes en orange, placées en tête | `src/app/pro/carte/page.tsx:27`, `:176`, `:305` | Réactivité. | présent | `pmap`, `preq` | Rien. |
| P3 | Interrupteur Disponible / Hors ligne relié à `is_active`, écho radar sur sa propre position | `src/app/pro/carte/page.tsx:93-94`, `:226`, `:372` | Le pro sait vraiment s'il est visible (correction du 17/09). | partiel (pastille, sans écho sur sa position) | `pmap` | Écho radar autour de « Vous » quand le pro est disponible, et carte « Disponible » (démo `p_dash` `.availcard`). |
| P4 | Rayon de 5 à 50 km, enregistré dans `service_radius_km` | `src/app/pro/carte/page.tsx:58`, `:341` | La zone est gardée d'une session à l'autre. | présent | `pmap` (volet Zone) | Rien. |
| P5 | Alerte « Nouvelle demande à X km » | `src/app/pro/carte/page.tsx:131`, `:379-383` | Temps réel, cœur de la promesse « Recevez un ping ». | **absent** | `pmap` | Bandeau de nouvelle demande, orange si urgente. |
| P6 | Vue « Mes interventions » sur la carte pro (adresse exacte seulement si utilisable) | `src/app/pro/carte/page.tsx:273-301`, `:356` | Le pro voit où il va, dans le respect de l'invariant de l'adresse. | absent | `pmap` | Pastille « Mes interventions ». |
| P7 | « Contacter le client » (RPC `provider_respond_to_request`), puis chat et négociation | `src/lib/services.ts:194` | Contourne proprement la RLS de `transactions`. Négociation dans le chat. | partiel (prix envoyé directement, pas de chat) | `preq` | « Contacter le client » en plus de « Envoyer ma proposition ». |
| P8 | Détails de l'annonce (heures, surface, linge, fréquence, CESU, foyer) visibles par le pro | `src/components/RequestDetails.tsx:37-46` | Le pro chiffre juste. | absent | `preq` | Bloc de détails. |
| P9 | Adresse masquée (`maskAddress`) ; le pro accepte ou refuse une « autre adresse » dans le chat | `src/app/pro/carte/page.tsx:273-274`, `src/app/mission/[id]/chat/page.tsx:515`, `:526` | Seul le pro valide, seul le client propose (règle posée par un trigger). | partiel (mention dans `preq`) | `chat`, `mission` | Carte « Adresse à valider : Accepter / Refuser ». |
| P10 | Catalogue de tarifs : un prix par service, forfait, à l'heure, forfait avec heures incluses et dépassement, sur devis | `src/app/pro/tarifs/page.tsx:12-13`, `:34`, `:60` | Couvre le modèle de prix validé en réel. | partiel (pas de forfait avec heures) | `services`, `svcedit` | Mode « Forfait + heures incluses + tarif au-delà ». |
| P11 | Disponibilités : calendrier du mois à grandes cases, plages horaires, répétition « ce jour / toute la semaine / 4 semaines », heure d'été | `src/app/pro/disponibilites/page.tsx:15`, `:173`, `:214`, `:133` | Alimente les créneaux que les clients réservent. | **absent** (la ligne « Zone et disponibilités » ouvre la carte) | `pprofile` | Écran Disponibilités. |
| P12 | Agenda du pro avec « Mes créneaux libres » | `src/app/agenda/page.tsx:103` | Le pro voit ses trous à remplir. | absent | `missions` | Vue agenda du pro (voir C32). |
| P13 | Mon entreprise en rubriques : Mon activité, Prix et revenus, Paiements et fiscalité, Mon entreprise, Plus | `src/app/pro/dashboard/page.tsx:238-282` | Structure identique à celle du client. | partiel (vérifications et 4 lignes) | `pprofile` | Lignes Revenus, Opérations, DAC7, SAP, CGV, Parrainage, Support, « Revenir en particulier ». |
| P14 | Bloc « Mon activité du mois » : chiffres du mois, prochains rendez-vous, alerte litige | `src/components/ProMonthBlock.tsx:8`, `:88`, `:107` | Pilotage en un coup d'œil (démo `p_dash`). | **absent** | `pprofile` | Tuiles CA du mois, interventions, note ; prochains RDV ; alerte litige 48 h. |
| P15 | Mon annonce : couverture, logo, galerie, accroche, points forts, rayon, aperçu de la fiche publique | `src/app/pro/annonce/page.tsx:45-55`, `:130` ; `src/components/ProListingPreview.tsx` | Le pro voit ce que voit le client avant de publier. | partiel (photo et présentation, fiche publique) | `pedit`, `pubcard` | Galerie, accroche, points forts. |
| P16 | Mes pièces : identité, assurances, Kbis et URSSAF, statuts Fourni / Expiré / Refusé, visionneuse | `src/app/pro/documents/page.tsx:24-51` | Statut lisible, document jamais public. | présent | `pprofile`, `idcap`, `qualadd` | Afficher l'expiration et le motif du refus. |
| P17 | Revenus : récapitulatif, numéro fiscal (NIF) pour DAC7, numéro SAP | `src/app/pro/revenus/page.tsx:24-28`, `:73`, `:147` | Obligation fiscale de la plateforme. Prépare l'avance immédiate. | **absent** | `pprofile` | Écran Mes revenus. |
| P18 | Paiements du pro : IBAN, BIC et titulaire contrôlés, commissions à régler et leur statut | `src/app/pro/paiements/page.tsx:8-16`, `src/lib/transfers.ts` | Le pro vire sa commission. La dette est suivie. | partiel (IBAN seul) | `pay` | Liste « Commissions à régler (PING-V-…) » avec statut. |
| P19 | Bannière de suspension (commission impayée, mandat révoqué) | `src/components/ProSuspensionBanner.tsx`, `src/app/pro/dashboard/page.tsx:158` | Le pro comprend pourquoi il n'est plus visible. | absent | `pprofile`, `pmap` | Bandeau rouge, motif et action. |
| P20 | Avis du pro sur le client : public ou privé, étiquettes, note privée (`client_private_notes`) | `src/components/ClientReviewModal.tsx:10`, `:43-89` | Avis croisés, sans pourboire. | **absent** | `mission`, `review` | « Noter le client » après la fin. |
| P21 | Note publique du client et notes privées affichées au pro dans le chat | `src/app/mission/[id]/chat/page.tsx:159-162` | Le pro décide en connaissance de cause. | absent | `chat`, `preq` | Note du client sous son nom. |
| P22 | Viseur de scan QR côté pro | `src/app/mission/[id]/scan/[phase]/page.tsx:50-71` | Seul le pro pose l'arrivée. | présent | `qr` | Rien. |
| P23 | Client absent : photo horodatée et GPS une seule fois avec consentement, ou saisie du code à 6 chiffres | `src/components/ArrivalProof.tsx:15-29`, `:108`, `:144` | La seule exception GPS de l'invariant, avec consentement. | partiel (une phrase) | `qr` | Écran pro « Client absent ? » : Photo et position, ou Code. |
| P24 | Reçoit la contre-proposition du client et l'accepte ou la refuse | `src/app/mission/[id]/chat/page.tsx:265-303` | La négociation va dans les deux sens. | partiel | `chat` | Voir C19. |
| P25 | « Propositions envoyées » suivies | (`transactions` via `provider_respond_to_request`) | La proposition ne disparaît pas. | présent | `missions` | Rien. |
| P26 | Facture émise à son en-tête, et « Vous percevez X € » dans le devis | `src/app/mission/[id]/chat/page.tsx:737`, `src/components/MissionRecap.tsx` | Le pro voit son net avant d'accepter. | partiel (facture oui, net absent) | `invoice`, `chat`, `preq` | « Vous percevez X € après commission » sous chaque tarif. |
| P27 | Parrainage du pro | `src/app/pro/dashboard/page.tsx:278` | Recrutement par le bouche-à-oreille. | absent | `pprofile` | Ligne « Mon parrainage ». |

## 4. Admin

| # | Fonction | Où dans l'app (fichier:ligne) | Bien fait parce que… | Maquette | Écran maquette | À ajouter |
|---|---|---|---|---|---|---|
| A1 | Vue d'ensemble et activité en données réelles, case « Inclure les données fictives » | `public/admin.html:457`, `:509`, `:538-540`, `:3576` (`admin_pipeline`) | Le réel n'est pas mélangé au fictif. | présent | `a_home` | Rien. |
| A2 | Annonces en cours (urgentes marquées) | `public/admin.html:3591` | Qui cherche quoi. | partiel (sans « urgent ») | `a_ann` | Badge Urgent. |
| A3 | Utilisateurs : recherche par nom, ville ou métier ; séparation propose / réserve | `public/admin.html:560` | Retrouver quelqu'un vite. | partiel (filtres par activité, sans recherche) | `a_ppl` | Champ de recherche, onglets Pro / Particulier, fiche de la personne. |
| A4 | Transactions réelles, cliquables vers la mission | `public/admin.html:581` | Suivi de toutes les missions. | **absent** | – | Écran « Missions » de l'admin. |
| A5 | Réglage des taux et de l'heure entamée sans déploiement | `src/app/admin/commission/page.tsx:33-38` | Décision Romain du 26/10. | partiel (heure entamée en lecture seule) | `a_money` | Rendre le seuil de l'heure entamée réglable. Ajouter le plafond d'impayé (`unpaid_ceiling_cents`). |
| A6 | Paiements : rapprochement des virements, IBAN de PING, pare-feu (alertes, suspendus, levée) | `src/app/admin/paiements/page.tsx:15-16`, `:45`, `:70` | Seul PING note reçus ses frais et lève une suspension. | partiel (rapprochement seul) | `a_money` | Coordonnées bancaires de PING (vides à ce jour). Alertes et comptes suspendus. |
| A7 | Validation des pièces avec aperçu (Valider / Rejeter) | `public/admin.html:3189-3190`, `:2166` | Allume « vérifié par PING ». | présent (avec motif de refus) | `a_docs` | Rien. |
| A8 | Litiges : médiation, remboursement (séquestre ou retenue sur dette), clôture résolu / non retenu | `src/app/litiges/[id]/page.tsx:54`, `:96`, `:103-111` ; `public/admin.html:845` | Admin médiateur, l'argent est visible. | présent | `a_disp`, `dispute` | Choix « résolu / non retenu » à la clôture. |
| A9 | Export horodaté du dossier de litige | `public/admin.html:1637`, `:1415` | Preuve en cas de recours. | absent | `dispute` | Bouton Exporter. |
| A10 | Signalements de modération (distincts des litiges) | `public/admin.html:866`, `:880` | Traite les comportements, pas l'argent. | **absent** | – | Écran Signalements. |
| A11 | Documents et factures horodatés, conservés 10 ans | `public/admin.html:772` | Archive légale. | absent | – | Liste des factures réelles (lecture de la table `invoices`, cf. QC). |
| A12 | Échéances documentaires (alerte à 45 jours) | `public/admin.html:817` | Assurances expirées détectées. | absent | `a_docs` | Onglet « Expirent bientôt ». |
| A13 | DAC7 : collecte et récapitulatif par vendeur | `public/admin.html:785-808` | Obligation de la plateforme. | absent | – | Après le lancement (P2). |
| A14 | Retours des testeurs (`beta_feedback`) | `src/app/admin/retours/page.tsx:45` | Lecture de la bulle verte. | présent | `a_fb` | Rien. |
| A15 | Visites : journal des événements par personne | `src/app/admin/visites/page.tsx:38-39` | Comprendre l'usage réel. | partiel (« connecté il y a … ») | `a_ppl` | Fil d'activité dans la fiche de la personne. |
| A16 | Parcours d'inscription et attribution des liens (`signup_attributions`) | `src/app/admin/parcours/page.tsx:35-36` | Quel sticker ou quel QR convertit. | absent | – | Écran Acquisition (P2). |
| A17 | Communication et commercialisation : lien prospects, plaquettes, aperçu des animations Téléphone / Ordinateur | `public/admin.html:604-692` | Tout le marketing au même endroit. | absent | – | À garder tel quel dans l'admin actuelle (hors maquette). |
| A18 | Prospects : CRM, « flash terrain », leads | `public/admin.html:913-923` | Prospection terrain. | absent | – | Idem A17. |
| A19 | État du prestataire de paiement et des fonds détenus | `public/admin.html:884` | Transparence : 0 € détenu. | partiel (onglet Après le lancement) | – | Rien avant le choix du prestataire de paiement. |

## 5. Transversal

| # | Fonction | Où dans l'app (fichier:ligne) | Bien fait parce que… | Maquette | Écran maquette | À ajouter |
|---|---|---|---|---|---|---|
| T1 | Pictogrammes SVG, aucun emoji | `src/components/NavDrawer.tsx`, `src/components/Hub.tsx` (`HUB_ICONS`) | Règle Romain du 27/10. | présent (`ic()`) | partout | Rien. |
| T2 | Barre latérale sur ordinateur (1 000 px et plus), avec pastille de non lus | `src/components/DesktopShell.tsx:88-95` | L'app est utilisable sur ordinateur. | **absent** (maquette téléphone seulement) | – | Gabarit ordinateur : barre latérale, carte et panneau permanent (`.detail-panel`). |
| T3 | Menu à 4 entrées, identique dans les deux espaces, plus Support PING | `src/components/NavDrawer.tsx`, `src/components/BottomTabBar.tsx` | Décision Romain du 30/10 (« ça fait trop », « tout pareil partout »). | partiel (5 onglets, Agenda remplacé par Missions et Demander) | barre du bas | **Décision à confirmer** avec Romain : 5 onglets au lieu de 4, et disparition de l'Agenda. |
| T4 | Mode persistant (`ping_mode`) : seules certaines routes forcent le mode, synchronisé entre onglets | `src/components/DesktopShell.tsx:88-95`, `src/components/AuthGate.tsx:35` | Le mode ne saute pas. | partiel | `profile`, `pprofile` | Mémoriser le dernier espace utilisé. |
| T5 | Langage déclaratif (« pièce fournie », « assurance renseignée ») ; « vérifié par PING » seulement si validé | `src/app/pro/[id]/page.tsx:165`, `:184` | Invariant juridique. | présent (`VLAB`, `liveV`) | `procard`, `pprofile` | Vérifier que « Diplôme fourni, vérifié par PING » ne s'affiche qu'après validation. |
| T6 | Suivi d'usage (`trackEvent`, avec le mode dans `metadata.mode`) | `src/lib/tracking.ts`, `src/components/PageViewTracker.tsx` | Mesure réelle. | sans objet | – | Conserver dans le code final. |
| T7 | Bouton retour sur chaque écran | (`router.back` dans chaque page) | Navigation sûre. | présent (`hist`) | partout | Rien. |

---

## 6. Éléments de design de la démo `/demo` à reprendre

Emplacements dans `public/app.html` : `CSS` désigne la feuille de style en tête du fichier, les autres numéros renvoient au balisage.

| Élément | Où dans app.html | Pourquoi le reprendre | Dans la maquette ? |
|---|---|---|---|
| **Épingle en goutte (`.mk`, rotation 45°) avec pictogramme du métier** et anneau pulsant (`.pinring`) | CSS 63-66 et 236 ; épingles 433-437 | Le métier se lit sur la carte sans ouvrir la fiche. | Partiel : l'épingle est une pastille avec l'initiale, le prix et la note. Ajouter le pictogramme du métier. |
| **Onde radar depuis sa position (`.radar`) et bouton « PING » à halo (`.pingbtn`)** | CSS 306-311 ; 443-444 (client), 1124-1125 (pro) | Signature de la marque, cohérente avec les animations et les posts. | Absent. |
| **Onglet central PING dans la barre du bas (`.tab.tping`)**, couleur or en mode pro (`.tabbar.pro`) | CSS 48-52 ; 1376-1378, 1431-1433 | Bouton central identifiable, couleur de l'espace. | Présent (onglet « Demander », picto ping, or côté pro). |
| **Carte d'aperçu du prestataire en bas de carte (`.preview`)** : avatar, nom, méta, pastilles, prix à droite, point « disponible », boutons Contacter et Profil | CSS 71-81 ; 448-453 | Décision sans quitter la carte. | Partiel : le volet liste ouvre directement la fiche. Ajouter l'aperçu au toucher d'une épingle. |
| **Barre de recherche flottante avec logo** (`.searchbar .lg`) et **pastilles de catégories** sous la barre | CSS 57-59 ; 438-441 | Hiérarchie claire. | Présent (sélecteur de service et pastilles). |
| **Grille des catégories (`.catgrid`) et tri segmenté « Plus proches / Mieux notés / Prix croissant » (`#sortSeg`)** | CSS 188 ; 463, 469 | Tri explicite. | Absent (le tri manque). |
| **En-tête de la fiche en dégradé teal (`.hero`)** : grand avatar carré arrondi, nom, « 4,9 (214 avis) · à 350 m », disponibilité | CSS 108-111 ; 483, 806 | Fiche identifiable, distance visible. | Partiel : carte centrée, sans dégradé ni distance. |
| **Lignes de vérification (`.vrow.ok`)** : pictogramme dans une pastille teal, titre, sous-titre, état à droite | CSS 112-116 ; 486-488, 695, 812-814 | Lisible, homogène client et pro. | Présent (`vrow()`, `verifBlock`). Prendre le style à pastille `.vi`. |
| **Mention de place de marché** : « informations déclarées par le prestataire et collectées par PING, sans garantie » | 489 | Protection juridique. | Absent. À placer sous les vérifications, en adaptant pour les pièces validées. |
| **Compétences en pastilles (`.sk`)** | CSS 117 ; 489 | Lecture rapide des savoir-faire. | Partiel (étiquettes de qualifications). |
| **Avis en cartes (`.rev`) avec coche « vérifié » (`.ver`) sur l'auteur, badge « après prestation »** | CSS 104, 118-121 ; 490-492 | Avis crédibles. | Partiel (avis en texte avec étoiles, sans auteur). |
| **Carte de disponibilité (`.availcard` et `.livedot` avec écho)** : interrupteur et phrase « Vous n'apparaissez pas… » | CSS 221-233 ; 720 | Le pro comprend l'effet de l'interrupteur. | Partiel (pastille « Disponible » sur la carte). |
| **Tuiles de chiffres (`.statgrid`)** : CA du mois, interventions, note | CSS 163 ; 721, 771, 868 | Pilotage du pro. | Absent (voir P14). |
| **Raccourcis (`.qa`, `.qab`)** « Piloter mes finances » : tarifs, devis, documents | CSS 205 ; 723-727 | Accès direct aux tâches fréquentes. | Partiel (boutons « Ma fiche publique » et « Mes services »). |
| **Jauge « Profil complété »** dans « Votre visibilité » | 729 | Incite à compléter. | Présent (jauge dans `pprofile`). |
| **Carte d'alerte litige en tête (fond crème `#FFFBF2`, badge « 48 h »)** | 662-667 (`v_agenda`), 712-717 (`p_dash`) | Ce qui urge passe en premier. | Partiel (litige en ligne dans Terminées). Le mettre en tête de Missions. |
| **Bandeau de jours défilant (`.days`) et « Créneau libre » dans l'agenda** | CSS 138 ; 555 (`v_booking`), 750-753 (`p_agenda`) | Choix d'un créneau en un geste. | Absent (voir C8, C32, P12). |
| **Cartes de demande (`.notif`)** : point teal « À 400 m · aujourd'hui », titre, texte, actions | CSS 169-173 ; 741-742 | Demandes lisibles d'un coup d'œil. | Partiel (lignes de liste). |
| **Filtres des demandes pro « Toutes / moins d'1 km / Ponctuel / Récurrent »**, « Propositions déjà envoyées : 3 » | 1151-1160 (`p_offres`) | Le pro voit la concurrence. | Partiel (filtre par service seulement). |
| **Proposition comparée (`v_offre_detail`)** : « répond en ~10 min », extrait, Échanger / Accepter avec le prix | 1021-1065 | Comparer sans ouvrir trois chats. | Partiel (`props`). |
| **Suivi de litige « Ma demande / Sa proposition / Écart », « Sans accord sous 48 h, PING rendra une décision »** | 1260-1294 (client), 1313-1330 (pro, « Je perçois ») | Négociation de sortie de crise claire. | Partiel (`dispute`, fil seul). |
| **Fiche assurance du prestataire (`v_assur`)**, en langage déclaratif | 1295-1312 | Démarche en cas de dommage. | Absent. |
| **Visionneuse de document (`v_docview`)** : horodatage, conservation RGPD, « jamais visible par les clients » | 1243-1259 | Rassure sur la confidentialité. | Partiel (`idcap`, état envoyé). |
| **Profil particulier (`v_profile`)** : carte d'identité avec adresse, téléphone masqué « 06 12 •• •• 45 », e-mail | 679-708 | Coordonnées visibles et rassurantes. | Partiel (`account` en formulaire). |

---

## 7. Manques à ajouter dans la maquette, par priorité

### P0 : indispensable au lancement (fonctionne en production aujourd'hui, sa disparition serait une régression)
1. **Agenda Jour / Semaine / Mois** (C32, P12), avec litige en tête, badges Confirmé / En route et créneaux libres du pro. Romain aime cet écran.
2. **Disponibilités du pro** (P11), avec répétition jour / semaine / 4 semaines, et **grille de créneaux réels dans la réservation** (C8, C9). Sans elles, `book_slot` n'est plus alimenté.
3. **Négociation dans le chat** (C19, P24, P26) : formulaire de tarif en 3 modes avec forfait, heures incluses et dépassement ; Refuser ; contre-proposition ; « Vous percevez X € ».
4. **« Fixez le rendez-vous » dans le chat** (C20) : sans cette carte, le flux « Contacter » n'aboutit à aucune mission datée.
5. **Annonce détaillée et adresse d'intervention** (C14, C16, P8) : surface, pièces, linge, fréquence, CESU, foyer, adresse géocodée. Les mêmes détails doivent être visibles par le pro.
6. **Adresse à valider côté pro** (P9) : Accepter / Refuser. C'est un invariant appliqué par un trigger.
7. **Annulation de mission avec frais tardifs** (C25).
8. **Client absent** (C27, C28, P23) : QR sur place imprimable, code à 6 chiffres du client, photo et position avec consentement côté pro.
9. **Heure entamée visible au scan de fin** (C31) : durée réelle, heures facturées, dépassement.
10. **Virement** (C34, P18) : IBAN du pro et référence sur la facture, statut du virement, commissions à régler par le pro. C'est le seul moyen de paiement actif.
11. **Bulle verte de retours** (V15) : c'est le canal annoncé aux testeurs de l'avant-première.
12. **Contacter le client** côté pro (P7), qui ouvre le chat : c'est le flux principal de réponse à une demande.

### P1 : à intégrer dans la refonte
13. Avis complet : qualité, service, recommandation, pourboire (C36). Avis du pro sur le client avec note privée (P20, P21).
14. Mes opérations : partage, relevé annuel, export CSV (C35).
15. Revenus, DAC7 et SAP (P17) ; rubriques complètes de Mon entreprise (P13) ; bloc « Mon activité du mois » (P14).
16. Pastille de non lus sur l'onglet Messages (C42) ; cloche de l'autre espace (C43).
17. Filtres de confiance et tri de la carte (C3) ; aperçu du prestataire en bas de carte (démo `.preview`).
18. Alerte « Nouvelle demande » et vue « Mes interventions » sur la carte pro (P5, P6) ; écho radar sur sa propre position (P3).
19. Gabarit ordinateur avec barre latérale (T2).
20. Parrainage, client et pro (C48, P27).
21. Signaler un échange, modération (C24), et écran Signalements de l'admin (A10).
22. Support PING en direct (V18) ; pages CGU et confidentialité (V17) ; écran de nouveau mot de passe (V6).
23. Favoris : cœur sur la fiche (C6) ; galerie et points forts de l'annonce (C5, P15).
24. Bannière de suspension du pro (P19) ; propositions comparées avec distance et extrait (C18).
25. Admin : transactions (A4), pare-feu et IBAN de PING (A6), heure entamée réglable (A5), échéances documentaires (A12), factures réelles (A11).
26. Lecteur d'animation intégré dans l'Aide (C49) ; messages système dans le chat (C23) ; récapitulatif de la demande dans le chat (C21).

### P2 : après le lancement ou confort
27. Installation PWA (V16) ; « Mes avis » du client (C38) ; « Ce que voit le prestataire » (C47) ; CGV consultables après l'inscription.
28. Admin : DAC7 (A13), acquisition et parcours (A16), journal des visites (A15), export du dossier de litige (A9). Communication et CRM (A17, A18) : garder l'admin actuelle.
29. Bouton PING et onde radar sur la carte client (démo `.pingbtn`, `.radar`) ; fiche assurance `v_assur` ; mention « place de marché ».

### Décisions à faire trancher par Romain (divergences maquette / app)
- **Visibilité du pro** : dès la fin de l'assistant (app) ou après validation de l'identité (maquette `attente`) ?
- **Barre du bas** : 5 onglets (Carte, Missions, Demander, Messages, Profil) au lieu du menu à 4 entrées décidé le 30/10, et l'Agenda devient un onglet de Missions.
- **Réponse du pro à une demande** : prix envoyé directement (maquette `preq`) ou « Contacter » puis chat (app) ? Garder les deux.

---

### Décompte
- **123 éléments recensés** : 18 visiteur et inscription, 52 client, 27 prestataire, 19 admin, 7 transversaux.
- **Absents de la maquette : 39.** Partiels : 42. Présents : 41. Sans objet : 1 (T6, suivi d'usage).
- **Éléments de design de la démo** recensés à part : 24.
