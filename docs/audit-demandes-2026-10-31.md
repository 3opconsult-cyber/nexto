# Audit de traçabilité des demandes de Romain — 31/10/2026

**Ce qui a été lu :**
- le journal de la conversation : 140 messages de Romain, plus 39 messages envoyés en cours de tâche, plus les résumés de passation qui couvrent la période du 20/09 au 31/10 ;
- `CLAUDE.md` : audits du 17/09, du 28/10 et du 30/10, décisions, « restent ouverts » ;
- `docs/audit-marketing-2026-10-31.md`.

**Méthode :** chaque demande a été vérifiée dans le code (`src/app`, `src/components`, `src/lib`, `supabase/migrations`, `public/*.html`, `brand/`). Un texte affiché à l'écran ne suffit pas : une demande n'est notée FAIT que si un bouton est relié, une requête ou une table existe. La base de production n'a pas été interrogée : l'état des tables s'appuie sur les migrations et sur l'usage dans le code.

**Chantiers parallèles du 31/10 :**
- Trois chantiers sont en cours chez d'autres agents : le paiement par virement SEPA (`025_virement_sepa.sql`), la page « Mon annonce » du prestataire (`026_annonce_prestataire.sql`) et l'animation pour les pros (`brand/anim-pro/`). Ils sont notés **EN COURS** et comptés comme absents.
- Le durcissement de sécurité (`027_durcissement_securite.sql`) a été **appliqué le 31/10** par le coordinateur. Il corrige : les faux avis, les litiges ouverts sur la mission d'autrui, la baisse du prix après validation, l'acceptation de sa propre offre, l'accepté / refusé des offres jamais enregistré, les pièces auto-validées par le pro, et l'accès anonyme à `auto_release` / `generate_invoices`. Les lignes concernées sont notées **FAIT (corrigé 31/10)**.

**États :**
- **FAIT** : la fonction existe et elle est reliée.
- **PARTIEL** : il manque quelque chose, précisé dans la ligne.
- **ABSENT** : rien dans le code.
- **REPORTÉ / ABANDONNÉ** : décision de Romain, citée dans la ligne.

## Bilan

| | Nombre |
|---|---|
| Demandes distinctes (doublons regroupés) | **176** |
| FAIT | **124** (dont 3 corrigés le 31/10 par la migration 027) |
| PARTIEL | **29** |
| ABSENT (dont 3 EN COURS ailleurs) | **19** |
| REPORTÉ / ABANDONNÉ par décision | **4** |

---

## Carte et recherche

| Demande | Date | État | Où / ce qui manque |
|---|---|---|---|
| Carte des prestataires autour de soi, recherche par service | 17/09 | FAIT | `/map`, `DemoShell.tsx`, `LiveMap.tsx`, RPC `providers_nearby` |
| Prix au-dessus de l'épingle (goutte verte + point), sur toutes les cartes | 30/10 | FAIT | `LiveMap.tsx` `pinPriceLabel` |
| Filtres de la carte qui marchent (disponible, pièce, assurance, ≤ 1 km, 4★) | 30/10 | FAIT | `DemoShell.tsx` l.111-116 |
| Afficher les prix tôt dans le parcours (comme Wecasa ou Uber) | 26/10 | FAIT | épingles, fiche pro, réservation |
| Fiche prestataire avec avis, étoiles, prestations, « Réserver » par service | 26/10 | FAIT | `/pro/[id]` (le bug des 5 étoiles est corrigé) |
| « Contacter » sans être connecté : connexion puis retour | 17/09 | FAIT | `DemoShell.tsx`, `auth/login?next=` |
| Carte pro : « Demandes ouvertes », « Mes interventions », « Autres pros » fonctionnels | 30/10 | FAIT | `/pro/carte` (commit c706cab) |
| Carte pro sur téléphone : le panneau s'affiche | 30/10 | FAIT | `/pro/carte` (`preview show`) |
| Alerte « Nouvelle demande à … » et écho radar autour du pro disponible (comme dans l'animation) | 31/10 | FAIT | `/pro/carte` : relecture toutes les 60 s, seulement quand la page est ouverte |
| « Aller à la direction » ne fait pas quitter l'application | 26/10 | FAIT | `DepartureBar.tsx` l.96 (`target="_blank"`) |
| Recherche aussi interactive que Leboncoin, « one-click » | 26/10 | PARTIEL | Contacter et Réserver se font en un clic. Pas de fil d'annonces à parcourir côté client. |
| Filtres des demandes côté pro (service, urgence, distance) | 28/10 | ABSENT | `/pro/carte` n'a aucun filtre de demandes |
| Boost, classement, visibilité pour les pros actifs | 26/10 | ABSENT | rien en dehors des paliers de parrainage |

## Demande / annonce du particulier

| Demande | Date | État | Où / ce qui manque |
|---|---|---|---|
| Publier une demande ouverte (titre, date, créneau, budget, position) | 17/09 | FAIT | `/client/demandes/new` |
| Annonce détaillée comme sur Airbnb : heures, surface, kilos et types de linge, fréquence de 1 à 3 fois par semaine, taille du foyer, CESU ou paiement direct, à l'adresse du profil | 31/10 | FAIT | migration 024, `RequestDetails.tsx`, `AddressChoice.tsx` |
| Caractère urgent, visible sur la carte | 30/10 | FAIT | case « C'est urgent », épingle orange (017, 024) |
| Photos jointes à la demande | 30/10 | ABSENT | ni colonne `photo_paths` sur `requests`, ni envoi de fichier dans le formulaire |
| Anti-contournement : pas de téléphone ni d'e-mail dans la demande | 30/10 | FAIT | `filterMessage` dans `demandes/new` l.89 |
| Bouton « Déposer une demande » visible (carte, Mes demandes, Mon profil) | 31/10 | FAIT | commit 9665c7a |
| 5 demandes ouvertes fictives | 30/10 | FAIT | `scripts/demo/factice.mjs` |
| Plusieurs propositions visibles, pas seulement la dernière | 17/09 | FAIT | `/client/demandes` |
| Comparer les propositions reçues (prix, note, distance, badges, Accepter), comme l'écran `v_offre_detail` de la démo | 28/10 | PARTIEL | `/client/demandes` l.140-150 ne montre que le nom et « Voir la conversation ». Pas de prix, de note, de distance ni de bouton Accepter. |
| Règle « sans réponse sous 48 h, la demande du client s'applique » | 28/10 | REPORTÉ | vague 3, décision de Romain attendue (CLAUDE.md, audit du 28/10) |

## Annonce et profil du prestataire

| Demande | Date | État | Où / ce qui manque |
|---|---|---|---|
| Inscription pro pas à pas : statut en vignettes, SIRET qui pré-remplit, adresse | 26/10 | FAIT | `/pro/onboarding`, `legalLookup.ts` (recherche-entreprises.api.gouv.fr) |
| Fiche établissement façon Google : photo de couverture et logo | 26/10 | FAIT | migration 009, envoi dans `/pro/dashboard`, affichage sur `/pro/[id]` |
| Site internet dans Mon entreprise › Coordonnées | 30/10 | FAIT | migration 018 |
| **« Lancer mon annonce »**, page Mon annonce du prestataire | 31/10 (« on en a parlé depuis le début ») | ABSENT, EN COURS | rien dans `main`. Chantier en cours (026 non commitée). Aujourd'hui, seul le lien « Voir mon profil public » existe. |
| Disponible ou hors ligne en un geste, toujours accessible (comme Airbnb) | 27/10 | FAIT | `NavDrawer.tsx`, `/pro/carte`, relié à `is_active` |
| Le prestataire note le client : avis publié ou note privée, étiquettes, sans pourboire | 30/10 | FAIT | migration 016, `ClientReviewModal.tsx`, note affichée au pro dans le chat |
| Droit de réponse du pro à un avis | 27/10 | ABSENT | ni colonne, ni écran |
| Préparer un cadre multi-produits tout en restant mono-produit | 26/10 | PARTIEL | catalogue `trades.ts` et table `services`. Rien de plus, et c'est voulu (invariant mono-produit). |
| Tableau de bord pro comme la démo (`p_dash`) : CA du mois, prochains rendez-vous, « N demandes près de vous », alerte litige 48 h, jauge du profil | 28/10 | PARTIEL | Mon entreprise n'est plus qu'une liste de liens (`pro/dashboard`). Le CA du mois est seulement dans `/pro/revenus`. Pas de jauge, d'alerte litige ni de compteur de demandes. |
| Boîte « Réservations reçues » avec Accepter / Refuser | 28/10 | ABSENT | une réservation directe est confirmée (`price_confirmed`) sans accord du pro |
| Entreprises de nettoyage : équiper leurs salariés pour qu'ils deviennent des points sur la carte | 27/10 | ABSENT | seulement la plaquette `#entreprises`. Pas de compte entreprise avec plusieurs salariés. |

## Tarifs

| Demande | Date | État | Où / ce qui manque |
|---|---|---|---|
| Article : nom, descriptif, forfait (nombre d'heures), taux horaire, heures en plus | 26/10 | FAIT | table `services`, `PricingEditor.tsx` |
| Un prix par service (ménage, repassage, nettoyage, mise en blanc) : forfait, à l'heure, ou forfait + heures sup., au plus près de la démo | 30/10 | FAIT | `/pro/tarifs` (commit e985831), « Remise à blanc » proposée |
| Pouvoir ajouter une prestation (bouton +) | 30/10 | FAIT | `/pro/tarifs` l.194 |
| Mode « sur devis » | 17/09 | FAIT | enum `devis`, prestation libre |
| Forfait mensuel | 30/10 | ABANDONNÉ | Romain : « je pense qu'on va rester sur forfait à l'heure et heure supplémentaire » |
| Tarifs et articles pour les prestataires fictifs | 26/10 | FAIT | migrations 007 et 008 |
| Commission partagée 8 % client + 17 % pro, réglable dans l'admin | 26/10 | FAIT | `app_settings`, `/admin/commission`, `getRates()` |
| Heure entamée due à partir de 15 min, réglable dans l'admin. Si la mission est plus courte, remboursement seulement en horaire | 29/10 | FAIT | `billedHours()`, `/admin/commission` |
| Prix affiché : comprendre « 100 € ou 108 € » (Romain : « le client paie 100 €, le prestataire encaisse 75 € », puis « on reste sur une notion de partage ») | 30/10 | PARTIEL, À TRANCHER | l'épingle montre le prix du pro. Le total de réservation ajoute 8 % (« Frais de service PING inclus », `mission/new` l.289). Il faut une décision écrite de Romain. |

## Agenda et disponibilités

| Demande | Date | État | Où / ce qui manque |
|---|---|---|---|
| Un seul agenda partout, vues jour, semaine, mois | 30/10 | FAIT | `components/calendar/Calendar.tsx`, utilisé par `/agenda`, `/pro/disponibilites`, `mission/new` |
| Disponibilités ultra simples : toucher un jour, puis journée complète, tranches, toute la semaine ou chaque même jour | 30/10 | FAIT | `/pro/disponibilites` |
| « Agenda plus ergonomique et plus simple » | 31/10 | PARTIEL | seul le choix de date au doigt a changé (`DayTimePicker.tsx`). La page `/agenda` n'a pas bougé depuis le 30/10. |
| Agenda : litige en tête, badges Confirmé et En route, mission terminée vers la facture, tri par heure de rendez-vous | 28/10 | FAIT | `/agenda` |
| Seulement les rendez-vous confirmés dans l'agenda | 30/10 | FAIT | `/agenda` |
| Le rendez-vous « apparaît » avec une animation, comme dans l'animation | 31/10 | ABSENT | noté « à faire » dans l'audit marketing |
| Synchronisation avec un agenda externe (Google Agenda) | 27/10 | ABSENT | pas d'export iCal ni de synchronisation |

## Réservation

| Demande | Date | État | Où / ce qui manque |
|---|---|---|---|
| Réservation d'un créneau publié par le pro | 28/10 | FAIT | migration 012, RPC `book_slot`, `mission/new` |
| Réservation instantanée comme dans l'animation (bandeau de 4 jours + grille de créneaux) | 28/10 | PARTIEL | calendrier semaine/jour. Pas la mise en page de l'animation (audit marketing). |
| Parcours client allégé jusqu'au paiement, un seul total | 26/10 | FAIT | `mission/new` (paiement en ligne éteint) |
| Annulation comme Uber : gratuite avant « en route », frais ensuite, impossible après l'arrivée | 27/10 | FAIT | `cancelMission` dans le chat, déclencheur en base |
| Politique d'annulation affichée | 27/10 | FAIT | `mission/new` l.307 |
| Date et heure du rendez-vous enregistrées | 30/10 | FAIT | `transactions.scheduled_at` |
| Heure d'arrivée plausible selon la distance (« à 4 km, on ne peut pas être là dans les 22 secondes ») | 27/10 | FAIT | `DepartureBar.tsx` (`distanceKm`) |
| Interdire de réserver avec soi-même | 29/10 | FAIT | contrainte `transactions_buyer_ne_seller` |
| Code promo, réduction sur la première réservation | 27/10 | ABSENT | rien dans `pricing.ts` ni dans `mission/new` |
| Garantie « premier rendez-vous satisfait ou remboursé » | 27/10 | PARTIEL | seulement la phrase « Pas satisfait ? réclamation ». Aucune garantie formalisée. |
| Prestation récurrente, avec paiement et venue automatisés | 26-27/10 | PARTIEL | la fréquence est un simple champ de la demande. Aucune mission récurrente n'est créée. |

## Chat et négociation

| Demande | Date | État | Où / ce qui manque |
|---|---|---|---|
| Liste des conversations comme WhatsApp (date, nom, dernier message) | 26/10 | FAIT | `/messages` |
| Tri par date (mois, année) ou par client, recherche | 26/10 | FAIT | `/messages` l.38, l.114 |
| Négociation du devis : offre, contre-offre, accepter, refuser, forfait + heures incluses + dépassement | 17/09 | FAIT (corrigé 31/10) | chat. L'accepté ou le refusé de l'offre n'était jamais enregistré (aucune règle d'écriture sur `messages`), et une partie pouvait accepter sa propre offre. Corrigé par 027 (policy « messages offer answer », déclencheur `trg_guard_message_write`). |
| « Vous percevez X € » dans le devis | 28/10 | FAIT | chat l.700, `MissionRecap.tsx` |
| Anti-contournement (téléphone, e-mail) dans le chat | 26/10 | FAIT | `chatFilter.ts` |
| Codes QR et récapitulatif accessibles depuis le chat | 30/10 | FAIT | bouton « Mes codes QR », `MissionRecap.tsx` |
| Revoir toute une mission depuis la conversation (échanges, contrat, note, factures) | 30/10 | FAIT | `MissionRecap.tsx` |
| Messages système enregistrés (réservation, en route, arrivée, fin, annulation) | 30/10 | FAIT | `systemMessage.ts` |
| Voir que le prestataire est en route | 26/10 | FAIT | `DepartureBar.tsx` |
| Nom de l'interlocuteur partout | 17/09 | FAIT | RPC `transaction_counterparts` |

## Adresse

| Demande | Date | État | Où / ce qui manque |
|---|---|---|---|
| Le pro ne voit l'adresse qu'une fois la mission validée et payée | 30/10 | FAIT | `addressUsable()`, filtrage dans l'application (la RLS `requests` reste « parties à la transaction ») |
| Adresse du profil présélectionnée et confirmée. Une autre adresse est soumise au pro, sans le numéro | 31/10 | FAIT | migration 023, `AddressChoice.tsx`, `maskAddress` |
| Géocoder l'adresse saisie quand le GPS ne répond pas | 21/09 | FAIT | `geocode.ts` |
| Fixer l'adresse et la date dans le chat après un « Contacter » | 30/10 | FAIT | carte « Fixez le rendez-vous » |

## QR et intervention

| Demande | Date | État | Où / ce qui manque |
|---|---|---|---|
| QR d'arrivée et de départ, un par mission et par étape | 17/09 | FAIT | `/mission/[id]/qrcodes`, `/scan/[phase]` |
| Verrou : le client ne peut pas valider l'arrivée lui-même | 26/10 | FAIT | migration 013, `trg_enforce_arrival_departure` |
| Double code PIN, ou QR croisé client et prestataire | 26/10 | ABANDONNÉ | Romain : « un QR code appartient à un client, un QR code appartient à un prestataire… on ne recrée pas un deuxième système ». Remplacé par le verrou en base et un relevé GPS. |
| Relevé GPS ponctuel au scan, comme double sécurité | 27/10 | FAIT | `scan/[phase]` `gpsNote` |
| Photo horodatée + GPS quand le client est absent | invariant | FAIT | `ArrivalProof.tsx` |
| Photo horodatée au départ | 27/10 | ABSENT | reporté par l'assistant le 27/10, jamais construit |
| Durée sur place et « Signaler avant de valider » à l'étape 2 | 28/10 | FAIT | `/qrcodes` |
| Écran « Comment s'est passée l'intervention » réservé au client (il s'affichait côté pro) | 26/10, 30/10 | FAIT | commit 12c1ac9 |

## Facturation et opérations

| Demande | Date | État | Où / ce qui manque |
|---|---|---|---|
| Trois documents : facture du prestataire sous son en-tête, commission client, commission pro | 17/09 | FAIT | `generate_invoices`, `invoice-pdf.ts` |
| Facture au nom du bon prestataire, pas d'OP Consult | 26/10 | FAIT | vérifié le 26/10 |
| Chaque partie ne voit que sa propre commission | 29/10 | PARTIEL | l'écran est correct. Mais la RLS `invoices` laisse lire la commission de l'autre partie par appel direct (connu, non corrigé). |
| Mission terminée = facture visible (bug « pas de facture ») | 30/10 | FAIT | corrigé, test `scripts/e2e/factures.mjs` |
| Factures classées par mois, envoi au comptable par e-mail, WhatsApp, SMS, CSV, relevé annuel | 27/10, 30/10 | FAIT | `/documents`, `ShareInvoiceSheet.tsx`, `invoiceShare.ts` |
| Reporting mensuel et KPI « pré-envoyés » au comptable et pour la déclaration | 26/10 | PARTIEL | l'envoi est manuel. Aucun envoi automatique. |
| Transmettre à l'Urssaf | 30/10 | PARTIEL | `AvanceImmediateCard` prête mais éteinte : l'habilitation manque |
| Factures PDF de 1 000 € et plus | 31/10 | FAIT | `pdfSafe()` |

## Avis

| Demande | Date | État | Où / ce qui manque |
|---|---|---|---|
| Avis : étoiles, commentaire, pourboire, note du pro recalculée | 17/09 | FAIT | `ReviewModal.tsx` |
| Laisser un avis depuis la facture ou la fin du QR | 28/10 | FAIT | `chat?avis` |
| Pouvoir écrire dans la fenêtre d'avis (le focus sautait) | 31/10 | FAIT | `Modal.tsx` |

(La réponse aux avis et la note du client sont dans « Annonce et profil du prestataire ».)

## Litiges

| Demande | Date | État | Où / ce qui manque |
|---|---|---|---|
| Ouvrir un litige depuis la mission ou le chat | 17/09 | FAIT | chat l.394, table `disputes` |
| Dossier dédié comme chez Airbnb : un fil par litige | 31/10 | FAIT | migration 021, `/litiges/[id]` |
| PING médiateur : il clôt le dossier, rembourse depuis le séquestre ou retient sur les versements, et l'admin vérifie | 31/10 | FAIT | migration 022, `/api/payments/refund`, `commission_debts`. Effet réel seulement quand le paiement en ligne sera actif. |
| Versement bloqué tant qu'un litige est ouvert | 29/10 | FAIT | `/api/payments/release` |
| Litiges fictifs (Fictif 1 à 5) | 31/10 | FAIT | données |
| Litige complet comme la démo : motif structuré, montant demandé, échéance 48 h, contre-offre chiffrée | 28/10 | PARTIEL | fil et médiation existent. Pas de catégorie, de montant, d'échéance ni de négociation chiffrée. |
| Une réclamation exige une photo et un contact avec le service client (texte dicté pour `PaymentPendingModal`) | 26/10 | PARTIEL | le texte le promet, mais aucune photo n'est demandée ni stockée |
| Avoir (facture ajustée) à la clôture | 28/10 | ABSENT | |
| Fiche assurance du pro transmise dans le litige (`v_assur`) | 28/10 | ABSENT | |

## Paiement, séquestre, SEPA, Urssaf, parrainage

| Demande | Date | État | Où / ce qui manque |
|---|---|---|---|
| Trouver moins cher que Stripe, chiffrer les coûts | 26/10 | FAIT | réponse donnée, trois adaptateurs |
| Coder Stripe, Mangopay et Lemonway « au cas où », éteints | 29/10 | FAIT | `src/lib/payments/`. Jamais testés en bac à sable. |
| Séquestre libéré uniquement par PING (antifraude) | 29/10 | FAIT | cron et admin seulement, `/admin/paiements` |
| Fenêtre de simulation : « prélevé à la validation, séquestre, libéré 24 h après la fin sans réclamation » | 26/10 | FAIT | `PaymentPendingModal.tsx` |
| **Virement SEPA d'abord, séquestre mis en suspens** | 31/10 | ABSENT, EN COURS | 025 non commitée |
| Pare-feu des commissions : mandat SEPA révoqué ou prélèvement rejeté, alerte, dette, suspension, levée par l'admin | 30/10 | PARTIEL | logique et verrous faits (019), testés sur une base simulée. La création du mandat et des prélèvements n'est pas codée. |
| CGV : contrat de commission d'affaires et autorisation bancaire, acceptation obligatoire | 30/10 | PARTIEL | faites, mais PROVISOIRES : à valider par un juriste (`/cgu#prestataires`, `cgv.ts`) |
| RIB, numéro fiscal et déclaration visibles dans le profil pro, même en « bientôt » | 30/10 | FAIT | Mon entreprise › Paiements et fiscalité, `/pro/paiements`, `/pro/revenus` |
| Avance immédiate Urssaf : code prêt au branchement | 29/10 | FAIT | migration 013, `urssaf/avanceImmediate.ts`, routes `/api/avance-immediate`. Éteint. |
| Côté client : identifiant Urssaf, inscription | 29/10 | FAIT | `/client/avance-immediate` (éteint) |
| Numéro SAP (NOVA) du pro | 29/10 | FAIT | `/pro/revenus#sap`, Mes pièces |
| PING organisme habilité auprès de l'Urssaf (il encaisse et reverse) | 29/10 | REPORTÉ | validation juridique d'abord |
| Parrainage dans les deux sens, avec une vraie réduction de commission (paliers de 10 % à 50 %), visible et ludique, séparé particulier / pro | 26-27/10 | PARTIEL | page et paliers affichés (`/client/parrainage`). Mais l'inscription avec un code n'enregistre jamais le parrainage : `signup` l.116 lit `profiles.referral_code`, ce que la RLS bloque. Et aucune réduction n'est appliquée au prix. |

## Pièces et KYC

| Demande | Date | État | Où / ce qui manque |
|---|---|---|---|
| Identité (carte ou passeport), assurances RC Pro et décennale, diplômes ; plusieurs pièces par rubrique, en photo ou en fichier | 30/10 | FAIT | `/pro/documents` |
| RIB et récépissé SAP dans Mes pièces | 29/10 | FAIT | enum `doc_kind` |
| Pièce d'identité du client, avec visionneuse | 17/09 | FAIT | `/client/documents` |
| Langage déclaratif (« fournie », « renseignée », jamais « vérifiée ») | 17/09 | PARTIEL | l'application est propre. `public/admin.html` contient encore 11 « vérifié(e)(s) ». |

## Navigation, menus, espaces

| Demande | Date | État | Où / ce qui manque |
|---|---|---|---|
| Menu réduit à 4 entrées, même structure côté particulier et côté pro | 30/10 | FAIT | `DesktopShell.tsx`, `NavDrawer.tsx` |
| Mon entreprise et Mon profil rangés en rubriques identiques | 27/10, 30/10 | FAIT | `Hub.tsx` |
| Séparer les espaces particulier et pro sur un même compte (comme Airbnb), y compris actions, factures et suivi | 29/10 | FAIT | `mode.ts`, test `separation-espaces.mjs` (26 OK) |
| Changer d'espace seulement depuis le menu, et toute l'interface change | 30/10 | PARTIEL | fait dans le menu. Mais Mon entreprise garde une ligne « Revenir en mode particulier » (`pro/dashboard` l.242). |
| Cloche avec point rouge quand l'autre espace attend quelque chose | 30/10 | FAIT | `ModeHint.tsx` |
| Barre du bas sur toutes les pages, plus contrastée, qui ne disparaît pas | 30/10 | FAIT | `BottomTabBar.tsx`, `--tabbar-h` |
| Textes plus foncés | 30/10 | FAIT | #4E6470 |
| Retirer les placeholders de **tous** les champs | 26/10 | PARTIEL | il en reste 14 : `AddressChoice.tsx` (×2), `ShareInvoiceSheet.tsx` (« cabinet@exemple.fr »), `pro/onboarding` (« www.monentreprise.fr »), `pro/revenus`, `client/avance-immediate` (« rue de la Paix »), `client/demandes/new` (×3), `litiges/[id]` (×3), `messages` |
| Pas d'emoji, des pictogrammes qui correspondent au titre | 27/10 | PARTIEL | l'application est propre. 2 emoji (👉 et 🙂) dans les textes prêts à poster de `public/admin.html` l.1085-1088. |
| Inscription clic par clic en carrousel (glisse, swipe, retour) | 18/09 | FAIT | `OnboardingStep.tsx`, `auth/signup` |
| Accompagner le particulier juste après l'inscription (carrousel ou « guide pop-up page à page ») | 18/09, 21/09 | PARTIEL | `/welcome` supprimé le 21/09. `/comment-ca-marche` existe mais n'est jamais montré après l'inscription (`signup` l.124 renvoie vers `/map`). Pas de guide pop-up. |
| Connexion avec retour (`?next=`), mot de passe oublié, écran « vérifiez votre boîte mail » | 30/10 | FAIT | `auth/login`, `auth/signup` |
| Date de naissance en roue, saisie automatique | 21/09 | FAIT | `DateWheelPicker.tsx`, `autoComplete` |
| Mes opérations remplies d'exemples, côté pro et côté client | 30/10 | FAIT | données fictives |

## Notifications

| Demande | Date | État | Où / ce qui manque |
|---|---|---|---|
| Prévenir le client quand un favori redevient disponible | 27/10 | ABSENT | |
| Notifications hors de l'application (push, e-mail, SMS) : nouvelle demande, message, réservation, litige ; compteur de non-lus | 29/10 (« push notifications : pas commencé ») | ABSENT | aucun envoi, aucun compteur. Seuls signaux : la cloche entre espaces et le bandeau de la carte pro, page ouverte. |

## Admin

| Demande | Date | État | Où / ce qui manque |
|---|---|---|---|
| « Communication & commercialisation » : je clique et je vois ce que les gens verront | 20/09, 28/10 | FAIT | `public/admin.html` › Supports & visuels |
| Résultats du retour de campagne (avis des testeurs) | 20/09 | FAIT | `/admin/retours` |
| Journal et mapping des inscriptions et des parcours des testeurs | 20/09 | FAIT | `/admin/parcours` |
| Onglet visites : commentaires, coordonnées, temps passé | 01/10 | FAIT | `/admin/visites` |
| Paiements : libérer, rembourser, lever une suspension | 29-31/10 | FAIT | `/admin/paiements` |
| Voir tout le parcours client et pro sans se connecter | 26/10, 31/10 | FAIT | `/parcours-navigable` (captures réelles). À relancer après chaque changement : `scripts/parcours/capture.mjs`. |
| Un seul système réel, pas d'espace parallèle : visiteurs et QR suivis dans la vraie base | 26/10 | FAIT | `events`, `/l/<code>`, migration 015 |
| Régie publicitaire : encart sponsor ou annonceur dans l'application | 26/10, 28/10 | PARTIEL | `SponsorBanner.tsx` existe mais n'est utilisé nulle part. Pas de table `sponsors`, pas d'écran admin. Le faux encart a été retiré le 30/10. |

## Marketing et supports

| Demande | Date | État | Où / ce qui manque |
|---|---|---|---|
| Page testeurs `/essai` : texte de Romain, 2 boutons (particulier / pro), 3 « Et si » par public, puis vraie inscription | 21/09 | FAIT | `/essai` |
| Bulle de commentaires sur chaque page (valider la page ou écrire, dictée possible) + note finale | 21/09, 27/10 | FAIT | `FeedbackBubble.tsx` (dans `layout.tsx`), `/essai/avis` |
| Posts Instagram « Et si… » minimalistes, avec QR | 18/09 | FAIT | `brand/src/ig-*-v2.html` |
| Stickers fort contraste, liens tracés par emplacement | 18/09 | FAIT | `stickers-contraste.html`, `/l/[code]` |
| Pages SEO par ville | 27/10 | FAIT | `/menage/[ville]` |
| Document illustré sur le crédit d'impôt | 27/10 | FAIT | `/plan-marketing` (pont crédit d'impôt) |
| Plan marketing et stratégie commerciale (critique, 4 cibles, plan d'action) | 27/10 | FAIT | `/plan-marketing` |
| Plaquettes en carrousel pour 5 publics, pictogrammes, souscription directe (QR, lien, info@opconsult.co) | 27-28/10 | FAIT | `/plaquettes`. L'orthographe de l'e-mail reste à confirmer. |
| Présentation : identité, séquestre, facture automatique, assurance, 50 % de crédit d'impôt | 29/10 | FAIT | `/presentation` (écran « En toute confiance », mentions « bientôt ») |
| Présentation, animation et démo alignées sur l'application | 31/10 | FAIT | `docs/audit-marketing-2026-10-31.md` (3 points restent) |
| Accroche « aussi simple qu'Airbnb… », en texte seul | 28/10 | FAIT | plaquettes |
| Page d'accueil épurée, accès direct à la carte | 27/10 | FAIT | `/` renvoie vers `/map`, landings |
| Analyse concurrentielle (Wecasa, TaskRabbit, Airbnb…) | 26/10 | FAIT | réponses données, `/plan-marketing` |
| Affichettes A2 à A5 avec QR | 27/10 | PARTIEL | A4 (affiche) et A5 (flyers, chevalet) existent. Pas d'A3 ni d'A2. |
| Kit de prospection « beaucoup plus fini » : TikTok, Facebook, Marketplace, mailing pro | 27/10 | PARTIEL | des textes dans `admin.html` (prototype) et le MP4 de l'animation. Ni création finie par canal, ni mailing pro final. |
| Montrer où apparaît l'annonceur dans l'application | 28/10 | PARTIEL | la plaquette dit « emplacement mis en ligne à la signature ». Aucun emplacement réel. |
| Animation explicative (pro qui se déplace, écho, messages, QR, étoiles, pourboire), 25 à 30 s, avec agenda, chat et réservation | 27-28/10 | PARTIEL | `/animation` fait 42 s, au-delà des 25-30 s demandés. Le MP4 date du 29/10 alors que le HTML date du 31/10 : la vidéo est périmée, à ré-enregistrer. |
| Logo : crochet du « ? » coupé, écho mal placé (« ça fait 10 fois ») | 27/10 | PARTIEL | correction faite dans une maquette, jamais reportée dans `brand/kit.py` `device()` (l.74, viewBox d'origine) ni dans `Brand.tsx` l.63 |
| Animation pour les prestataires | 31/10 | ABSENT, EN COURS | `brand/anim-pro/` non commité |
| Blog, articles, témoignages publics (l'outil de publication viendra plus tard) | 27/10 | ABSENT | Romain a reporté l'outil (« on créera l'outil… après »), le contenu non plus n'existe pas |
| Mettre à jour les présentations commerciales (séquestre, crédit d'impôt, « arrêtez les Pages Jaunes ») | 27/10 | ABSENT | `brand/src/pitch-*.html` inchangés depuis le 16/09 |

## Données fictives

| Demande | Date | État | Où / ce qui manque |
|---|---|---|---|
| Prestataires fictifs variés (ménage, repassage, combiné, mise en blanc, nettoyage), avis, étoiles, tarifs | 26/10 | FAIT | migrations 005 à 008, fictif1..10 |
| Missions fictives de bout en bout (messages, contrat, prix, note, 3 factures, litige), côté client et côté pro | 30/10 | FAIT | `scripts/demo/factice.mjs` |
| Tout marquer « fictif » pour pouvoir le supprimer au lancement | 31/10 | FAIT | colonne `fictif` (020), `supabase/a_coller/nettoyage_donnees_fictives.sql`, à exécuter le jour J |
| « Rien de vide, on doit tout vérifier » | 30/10 | FAIT | `scripts/e2e/audit-scenarios.mjs` |

## Sécurité et contrôles

| Demande | Date | État | Où / ce qui manque |
|---|---|---|---|
| Fermer la lecture publique de `requests` (adresse exacte) | 17/09 | FAIT | policy RLS |
| Demandes vues par les pros : position floutée, sans adresse | 30/10 | FAIT | `requests_nearby` (017, 024) |
| Inscription « Database error saving new user » | 30/10 | FAIT | migration 017 |
| Vérifier comptes, mots de passe, stockage par personne | 26/10 | FAIT | vérifié le 26/10 |
| Montants figés : le client ne peut plus baisser le prix | 29/10 | FAIT (corrigé 31/10) | figés dès qu'un paiement est engagé (014), et dès la validation du tarif (027) |
| « Durcir les fonctions internes exposées par erreur » (`auto_release`, `generate_invoices`…) | 26/10 | FAIT (corrigé 31/10) | 027 appliquée : plus d'accès anonyme ; faux avis, litiges sur la mission d'autrui et pièces auto-validées bloqués aussi. Fichier à commiter dans `supabase/migrations/`. |
| « Agents d'automatisation, pare-feux, points de contrôle » | 26/10, 30/10 | PARTIEL | scripts `scripts/e2e/*.mjs` et `scripts/tests/pare-feu`, lancés à la main. Aucun test automatique : la CI ne fait que déployer (`.github/workflows/deploy.yml`). |

---

## À faire pour aboutir (trié par importance pour le lancement)

### Bloquant pour lancer avec de vrais utilisateurs
1. **Notifications hors de l'application**, au moins par e-mail : nouvelle demande près de soi, nouveau message, réservation, rendez-vous de demain, litige. Sans elles, un pro ne sait pas qu'on l'a contacté s'il n'a pas l'application ouverte.
   - Créer une route serveur (`src/app/api/notify/route.ts`) ou un déclencheur Supabase, branché sur un service d'envoi d'e-mails.
   - Points d'appel : `src/lib/systemMessage.ts`, chat (`src/app/mission/[id]/chat/page.tsx`), `mission/new`, `client/demandes/new`.
   - Compteur de non-lus : colonne `messages.read_at`, `BottomTabBar.tsx`, `messages/page.tsx`.
2. **Sécurité (027 appliquée le 31/10) :**
   - commiter `supabase/migrations/027_durcissement_securite.sql` ;
   - rejouer `scripts/e2e/parcours.mjs`, `factures.mjs` et `separation-espaces.mjs` pour vérifier que les nouveaux verrous ne cassent pas un parcours normal : offre acceptée puis rechargée, avis après mission, litige ouvert par une partie, pièces déposées.
3. **Encaissement réel par virement SEPA** (chantier en cours, 025). Une fois en place, mettre à jour la règle de l'adresse : « payé » ne doit plus vouloir dire « tarif validé » (`src/lib/address.ts` `addressUsable`, `DepartureBar.tsx`).
4. **« Mon annonce » du prestataire** (chantier en cours, 026). La relier depuis Mon entreprise (`src/app/pro/dashboard/page.tsx`, rubrique « Mon entreprise ») et depuis la fin de `/pro/onboarding`.
5. **Juridique et mentions légales :**
   - saisir les coordonnées légales de PING (admin › Coordonnées légales), sinon les factures PING-C et PING-V affichent « à compléter » ;
   - faire valider `src/app/cgu/page.tsx`, `src/app/confidentialite/page.tsx` et `src/lib/cgv.ts` (version) ;
   - confirmer l'orthographe d'info@opconsult.co (`brand/plaquettes/src.html`).
6. **Données fictives :** le jour du lancement, coller `supabase/a_coller/nettoyage_donnees_fictives.sql`, puis relancer `scripts/parcours/capture.mjs`.

### Important : promesses faites à l'écran mais non tenues
7. **Parrainage réel :**
   - créer une RPC `SECURITY DEFINER` qui retrouve le parrain à partir du code (nouvelle migration) et l'appeler dans `src/app/auth/signup/page.tsx` l.116 ;
   - appliquer la réduction de commission dans `src/lib/pricing.ts` et `src/app/mission/new/page.tsx` (`buyer_fee_cents` / `seller_fee_cents`), puis poser `reward_used_at` ;
   - sinon, retirer les pourcentages de `src/app/client/parrainage/page.tsx`.
8. **Photo de preuve et motif structuré pour les litiges**, déjà promis par `PaymentPendingModal.tsx` :
   - migration `disputes` : `category`, `claimed_cents`, `photo_paths`, `deadline_at` ;
   - formulaire dans le chat (l.394), affichage dans `src/app/litiges/[id]/page.tsx`, bucket de stockage.
9. **Décision de Romain sur le prix affiché** (100 € ou 108 €), puis aligner `LiveMap.tsx` `pinPriceLabel`, `src/app/pro/[id]/page.tsx` et `src/app/mission/new/page.tsx` l.284-289.
10. **Comparer les propositions** dans `src/app/client/demandes/page.tsx` l.140-150 : prix proposé, note, distance, pièces fournies, bouton « Accepter ».
11. **Réservations reçues côté pro :** acceptation (ou refus) par le pro, avec un délai de réponse.
   - Décision de Romain d'abord : confirmation automatique ou accord du pro ?
   - Fichiers : `src/app/mission/new/page.tsx` (`price_confirmed` à la création), `src/app/pro/dashboard/page.tsx`.
12. **Tableau de bord pro** dans `src/app/pro/dashboard/page.tsx` : CA du mois, prochains rendez-vous, « N demandes près de vous » (`requests_nearby`), alerte litige, jauge du profil.
13. **Nettoyer `public/admin.html` :**
   - chiffres fictifs (GMV 148 920 €, « Carte en direct GPS ») ;
   - taux 5 %/11 % ;
   - « vérifié(e) » (11 fois) ;
   - « aucun PDF téléchargeable » (périmé) ;
   - emoji 👉 et 🙂 ;
   - export DAC7 factice (simple message affiché, à brancher avant janvier 2027).
14. **Placeholders restants** (14) : `AddressChoice.tsx`, `ShareInvoiceSheet.tsx`, `pro/onboarding/page.tsx` l.350, `pro/revenus/page.tsx` l.159, `client/avance-immediate/page.tsx` l.138/149, `client/demandes/new/page.tsx` l.166/170/193, `litiges/[id]/page.tsx` l.192/207/252, `messages/page.tsx` l.114.
15. **Accueil du particulier après l'inscription :** dans `src/app/auth/signup/page.tsx` l.124, passer une fois par `/comment-ca-marche`, ou par un carrousel court, avant `/map`.
16. **Tests automatiques :** lancer `scripts/e2e/*.mjs` dans un workflow GitHub planifié (`.github/workflows/`), contre la prod, avec les comptes audit.

### Utile, après le lancement
17. Photo horodatée au départ : `src/app/mission/[id]/scan/[phase]/page.tsx`, en réutilisant `ArrivalProof.tsx`.
18. Photos sur la demande : colonne `requests.photo_paths`, `client/demandes/new/page.tsx`, `RequestDetails.tsx`, `requests_nearby`.
19. Réponse du pro aux avis : colonne `reviews.reply`, `/pro/[id]`, Mon entreprise.
20. RLS `invoices` par type de document (commission client ou pro) : nouvelle migration.
21. Prestation récurrente (fréquence qui génère des missions) : décision de Romain, puis table ou cron.
22. Code promo ou réduction sur la première réservation, garantie « premier rendez-vous ».
23. Filtres des demandes sur `/pro/carte` ; boost ou classement des pros actifs.
24. Agenda : refonte plus simple de `/agenda` (demande du 31/10), micro-animation du rendez-vous, export iCal / Google Agenda.
25. Réservation façon animation (bandeau de 4 jours + grille) dans `mission/new`.
26. Litige : avoir à la clôture, fiche assurance transmise, règle des 48 h (décision de Romain).
27. Régie publicitaire : table `sponsors`, placement de `SponsorBanner.tsx`, écran admin.
28. Notification « favori de nouveau disponible » (dépend du point 1).
29. Supports :
   - ré-enregistrer le MP4 de l'animation et décider d'une version de 25-30 s (`brand/anim/build.py`) ;
   - mettre à jour `brand/src/pitch-*.html` ;
   - corriger le viewBox du logo dans `brand/kit.py` `device()` et `Brand.tsx` ;
   - finir le kit TikTok / Facebook / Marketplace / mailing pro, les formats A3 et A2.
30. Comptes entreprise avec plusieurs salariés (B2B nettoyage), blog et témoignages : nouvelles fonctions à cadrer avec Romain.

### Décisions de Romain en attente
- Prix affiché : 100 € ou 108 € (point 9).
- Réservation directe : confirmation automatique ou accord du pro (point 11).
- Règle des 48 h dans les litiges et les demandes.
- Prestataire de séquestre (mis en suspens le 31/10).
- PING organisme habilité auprès de l'Urssaf (après avis juridique).
- Bouton « Revenir en mode particulier » dans Mon entreprise : le garder ou passer uniquement par le menu (décision du 30/10).
