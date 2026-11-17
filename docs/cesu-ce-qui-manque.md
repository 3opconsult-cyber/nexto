# CESU : où on en est, ce qui manque (17/11/2026)

Lecture seule du code + recherche sur les sources officielles. Rien n'a été modifié dans l'app.
Les points marqués **[à vérifier]** n'ont pas pu être confirmés sur une source officielle (pages Urssaf
et portail API indisponibles pendant la recherche, ou texte non publié).

---

## 1. Ce que veut dire « CESU » : trois choses différentes

**(1) CESU déclaratif** (cesu.urssaf.fr)
- C'est le moyen pour un particulier **employeur** de déclarer et payer un **salarié** à domicile (emploi direct).
- Ça ne marche **pas** pour un auto-entrepreneur ou une entreprise qui facture : on ne paie pas une facture en CESU déclaratif.
- Pour PING, ça ne concerne que le cas du prestataire « particulier » non immatriculé (voir partie 4).

**(2) CESU préfinancé** (titre papier ou dématérialisé, remboursé par le CRCESU, cr-cesu.fr)
- Un titre de paiement offert au client par son employeur, son CE, sa mutuelle ou sa caisse de retraite.
- Le prestataire peut l'accepter s'il est déclaré services à la personne (SAP, sur NOVA) **et** affilié au CRCESU (il reçoit un numéro « NAN »). Il ne peut pas facturer de surcoût pour ça.
- PING n'a rien à brancher techniquement : le client paie le prestataire avec le NAN de celui-ci. PING peut seulement afficher « accepte le CESU préfinancé » et noter le paiement.

**(3) Avance immédiate du crédit d'impôt** (Urssaf, API Tiers de prestation)
- Le client ne paie que 50 % ; l'Urssaf verse 100 % au prestataire environ 4 jours ouvrés après validation du client (48 h), puis prélève la part du client.
- Réservé aux organismes SAP **habilités** à l'API, qui doivent en plus fournir une **garantie financière** (banque ou assureur, au moins 15 000 €) depuis la date limite du **31/10/2026** (sinon accès suspendu).
- C'est ce qui est codé dans PING. Ce n'est pas du « CESU » à proprement parler, même si le grand public mélange les deux.

---

## 2. Ce qui existe déjà dans PING

| Élément | Où | État |
|---|---|---|
| Connecteur API Urssaf (jeton, inscription client, demande de paiement, suivi) | `src/lib/urssaf/avanceImmediate.ts` | Écrit, jamais appelé en vrai. Noms de champs non vérifiés. |
| Routes serveur | `src/app/api/avance-immediate/route.ts` (actif ?), `inscription/route.ts`, `demande/route.ts` | Éteintes sans `URSSAF_CLIENT_ID` / `URSSAF_CLIENT_SECRET` |
| Taux 50 %, services éligibles, drapeau d'affichage | `src/lib/creditImpot.ts` (`CREDIT_RATE`, `isEligible`, `NEXT_PUBLIC_AVANCE_IMMEDIATE`) | En dur dans le code |
| Formulaire d'inscription du client (identité, naissance, IBAN envoyé à l'Urssaf, jamais stocké) | `src/app/client/avance-immediate/page.tsx` | Affiche « bientôt » |
| « Vous ne payez que X € » à la réservation | `src/app/mission/new/page.tsx` (l. 292) | Masqué |
| Carte « Transmettre à l'Urssaf » sur la facture | `src/components/AvanceImmediateCard.tsx`, `src/app/mission/[id]/facture/page.tsx` | Masquée |
| Tables `avance_immediate_clients`, `avance_immediate_demandes`, RPC `avance_immediate_context`, colonne `provider_profiles.sap_number`, pièces `sap` / `rib` | `supabase/migrations/013_avance_immediate.sql` | Appliquée le 29/10 |
| Saisie du numéro SAP par le pro | `src/app/pro/revenus/page.tsx` (bloc `#sap`) | En prod (texte libre, aucun contrôle) |
| Numéro SAP sur la facture | `src/lib/invoice-pdf.ts` (l. 198), écran facture (l. 204) | En prod si renseigné |
| Préférence de paiement « CESU / direct / indifférent » sur la demande | `024_annonce_detaillee.sql` (`requests.payment_pref`), `src/app/client/demandes/new/page.tsx` (l. 273-278), `src/components/RequestDetails.tsx` (l. 28-30) | En prod |
| Point fort « Accepte le CESU » sur l'annonce du pro | `src/lib/listing.ts` (l. 28) | En prod, déclaratif |
| Mention « réglez directement (CESU, espèces) » | `src/components/TransferCard.tsx` (l. 98 et 149) | En prod |
| Relevé annuel PDF (récapitulatif déclaratif) | `src/lib/invoiceShare.ts` (`annualPdf`) | En prod, ce n'est **pas** une attestation fiscale |
| Restes de l'ancien schéma (`legal_form` 'cesu', 'particulier_emploi', `cesu_eligible`) | `supabase/migrations/001_initial_schema.sql` | Tables mortes (`missions`, `pro_profiles`), sans effet |

---

## 3. Ce qui manque, dans l'ordre de travail

| # | Quoi | Qui | Effort | Bloquant ? |
|---|---|---|---|---|
| 1 | **Corriger les textes trompeurs** : « CESU » → « CESU préfinancé » partout ; retirer « espèces » de `TransferCard` (un paiement en espèces ne donne pas droit au crédit d'impôt) ; réserver le choix « CESU préfinancé » de `/client/demandes/new` aux pros qui l'acceptent. | Code | 1 h | Non, mais à faire vite (prod) |
| 2 | **Décider le modèle juridique** (voir partie 5) : PING reste un simple outil de mise en relation, chaque pro gère lui-même son crédit d'impôt ; ou PING devient l'intermédiaire habilité à l'API. Tout le reste en dépend. | Romain (+ juriste) | Décision | **Oui** |
| 3 | **Profil SAP vérifié du prestataire** : numéro SAP + date d'enregistrement, statut (auto-entrepreneur ou société, jamais « particulier »), pièce « récépissé SAP » validée par un admin (`documents.status = valid`), case NAN CRCESU si le pro accepte le CESU préfinancé. Aujourd'hui `sap_number` est un texte libre jamais contrôlé. | Code + prestataire | 1 j | Oui pour 4 à 8 |
| 4 | **Facture conforme SAP** : ajouter logo SAP, date d'enregistrement de la déclaration, mode « prestataire », nature exacte du service, montant réellement payé par le client, mention du crédit d'impôt. Liste exacte à reprendre dans l'arrêté du 17/03/2015 **[à vérifier]**. | Code | 0,5 j | Oui pour le crédit d'impôt « classique » |
| 5 | **Attestation fiscale annuelle** par prestataire et par client (sommes payées dans l'année, hors espèces), à remettre avant le 31 mars. Le relevé annuel actuel ne la remplace pas. | Code | 1 j | Oui pour le crédit d'impôt « classique » |
| 6 | **Éligibilité correcte** : le repassage fait **chez le prestataire** (« linge récupéré et rapporté ») n'est éligible qu'avec une prestation à domicile dans la même offre ; `isEligible()` déclare aujourd'hui tout le repassage éligible. Rendre aussi le taux réglable (`app_settings`) au lieu de `CREDIT_RATE = 0.5` en dur : un amendement PLF 2027 propose 40 % pour le ménage **[en débat, non adopté à ce jour]**. | Code | 0,5 j | Non |
| 7 | **Habilitation API Tiers de prestation** : dossier sur portailapi.urssaf.fr / démarches numériques (numéro SAP, SIRET, attestation de régularité fiscale, conditions d'utilisation) + **garantie financière** (≥ 15 000 €) ; délais de plusieurs mois signalés. Seul un organisme SAP déclaré peut la demander : PING telle quelle (non immatriculée, non SAP) ne le peut pas **[à confirmer avec habilitation-api@urssaf.fr]**. | Romain / prestataire / Urssaf | Semaines à mois | **Oui** pour 8 à 10 |
| 8 | **Revoir le connecteur selon le modèle choisi** : aujourd'hui un seul jeu d'identifiants (celui de PING) pour tous les pros, et la demande de paiement n'envoie ni le SIRET ni le SAP du pro : l'Urssaf verserait donc tout à PING, ce qui contredit « PING n'encaisse jamais pour autrui ». Il faut soit des identifiants par pro, soit un vrai mandat d'encaissement (prestataire de paiement agréé). Utiliser le vrai numéro de facture (`FACT-…`) au lieu de `PING-xxxxxxxx`, vérifier les codes « nature » (`ENT` supposé). | Code | 2-3 j | Oui |
| 9 | **Ne pas faire payer deux fois** : quand une demande d'avance immédiate est transmise, la carte de virement (`TransferCard`, `transfer_payments`) doit passer en « réglé via l'Urssaf » ; sinon le client vire 100 % au pro **et** l'Urssaf prélève 50 %. | Code | 0,5 j | Oui |
| 10 | **Sécurité** : la RLS « aid seller write » laisse le pro écrire lui-même le statut de la demande (il peut afficher « Payée par l'Urssaf »). Le statut ne doit être posé que par le serveur. Ajouter un rappel automatique du statut (aujourd'hui seulement à l'ouverture de la facture). | Code | 0,5 j | Oui avant activation |
| 11 | **Tests en bac à sable Urssaf**, puis activation (`URSSAF_*` puis `NEXT_PUBLIC_AVANCE_IMMEDIATE=1`). | Code + Urssaf | 1-2 j | — |
| 12 | Si le paiement en ligne (séquestre) est un jour allumé : à partir du **01/01/2027**, une plateforme qui encaisse pour des micro-entrepreneurs devra prélever leurs cotisations à la source (art. L. 613-6-1 CSS). Ne concerne pas PING tant que le client vire directement au pro. | Romain + code | Gros chantier | Non aujourd'hui |

---

## 4. Incohérences actuelles dans l'app (en prod)

1. **« CESU » proposé au client sans précision** (`/client/demandes/new`, `RequestDetails`, « Accepte le CESU » dans l'annonce) : un client qui pense au CESU déclaratif (son compte cesu.urssaf.fr) ne pourra jamais payer ainsi un auto-entrepreneur. Seul le CESU préfinancé est possible, et seulement chez un pro SAP affilié au CRCESU.
2. **« Réglez directement (CESU, espèces) »** dans `TransferCard` : les espèces font perdre le crédit d'impôt et vont contre la traçabilité voulue par PING.
3. **Prestataire « particulier » non immatriculé** (récapitulatif au lieu de facture) : faire le ménage chez quelqu'un contre rémunération, sans statut, c'est en droit un **emploi salarié direct**. C'est précisément le cas du CESU déclaratif : le client devient particulier employeur et doit le déclarer. L'app ne le dit nulle part. (L'Urssaf a une « API Tierce Déclaration Cesu » pour les plateformes qui le gèrent.)
4. **Numéro SAP jamais contrôlé** mais il déclenche l'affichage « vous ne payez que 50 % » et figure sur la facture.
5. **Tout le repassage déclaré éligible** au crédit d'impôt, y compris le linge emporté et rapporté hors offre globale.
6. **Modèle d'argent contradictoire** : le connecteur ferait verser 100 % par l'Urssaf au compte habilité (PING), alors que la règle actuelle (31/10) est le virement direct client → prestataire.
7. **Marketing** : `/client/avance-immediate` dit « arrive bientôt » ; ne pas promettre « payez 50 % » ailleurs tant que les points 2 et 7 ne sont pas réglés.

---

## 5. Décisions à prendre par Romain

1. **Qui porte le crédit d'impôt ?**
   a) Chaque prestataire reste seul responsable (sa déclaration SAP, son propre logiciel habilité, son attestation) et PING fournit des factures et attestations conformes. Simple, rapide, pas d'argent qui transite par PING.
   b) PING devient organisme SAP habilité (mandataire / plateforme) : avance immédiate « en un clic » comme les grands acteurs, mais il faut immatriculer PING, se déclarer SAP, obtenir l'habilitation, souscrire la garantie financière (≥ 15 000 €), encaisser via un prestataire de paiement agréé, et surveiller les débats sur les plateformes (amendement Sénat de nov. 2025 non retenu, nouveaux amendements possibles au PLF 2027).
   **Recommandation : a) d'abord**, b) seulement après le lancement et un avis juridique.
2. **Garde-t-on des prestataires « particuliers » ?** Sinon : les obliger à un statut (auto-entrepreneur). Si oui : leur expliquer le CESU déclaratif côté client.
3. **Garde-t-on le choix « CESU » chez le client** ? Proposition : le renommer « CESU préfinancé (titres employeur) » et ne le montrer que si des pros affiliés existent.
4. **Exiger le statut SAP** pour être mis en avant (badge « crédit d'impôt 50 % ») ? Il impose au pro la condition d'activité exclusive (activité annexe tolérée jusqu'à 30 % du CA pour les micro-entrepreneurs depuis le 01/01/2025, comptabilité séparée).
5. **Futurs services** (garde d'enfants, etc., décision du 07/11) : la garde d'enfants de moins de 6 ans est exclue de l'avance immédiate, et plusieurs activités exigent un **agrément** (pas une simple déclaration). Le catalogue de services devra porter « éligible crédit d'impôt / avance immédiate / agrément requis » par service.

---

## 6. Sources

Officielles :
- Urssaf, service avance immédiate (particuliers) : https://www.urssaf.fr/accueil/services/services-particuliers/service-avance-immediate.html
- Urssaf, avance immédiate côté prestataire : https://www.urssaf.fr/portail/home/employeur-du-secteur-des-service/prestataire/avance-immediate--quest-ce-que-c.html (indisponible le 17/11, contenu lu via le moteur de recherche)
- Urssaf, côté mandataire : https://v4www2.urssaf.fr/portail/sites/urssaf/home/employeur-du-secteur-des-service/mandataire/avance-immediate--quest-ce-que-c.html
- Site dédié : https://avanceimmediate.urssaf.fr/
- API Tiers de prestation (data.gouv) : https://www.data.gouv.fr/dataservices/api-tiers-de-prestation
- Souscription / documentation : https://portailapi.urssaf.fr/fr/catalogue-api/prd/tiers-prestations (indisponible le 17/11) ; contact habilitation-api@urssaf.fr
- Dossier d'habilitation : https://demarche.numerique.gouv.fr/commencer/api-tiers-de-prestations
- API Tierce Déclaration Cesu : https://www.data.gouv.fr/dataservices/api-tierce-declaration-cesu
- Organisme SAP, déclaration, activité exclusive, logo : https://entreprendre.service-public.gouv.fr/vosdroits/F23633
- Téléprocédure NOVA : https://entreprendre.service-public.gouv.fr/vosdroits/R19148 et https://nova.entreprises.gouv.fr/
- Mentions obligatoires d'une facture : https://entreprendre.service-public.gouv.fr/vosdroits/F31808
- BOFiP crédit d'impôt SAP (BOI-IR-RICI-150, mise à jour du 12/08/2026) : https://bofip.impots.gouv.fr/bofip/13448-PGP.html
- CRCESU, conditions d'affiliation : https://www.cr-cesu.fr/wp-content/uploads/legal/cga_pm_affiliation_crcesu.pdf
- Sénat, amendement I-1266 PLF 2026 (plateformes) : https://www.senat.fr/amendements/2025-2026/138/Amdt_I-1266.html
- Question écrite AN sur la garantie financière : https://www.assemblee-nationale.fr/dyn/17/questions/QANR5L17QE13689.pdf
- Amendement PLF 2027 taux 40 % (CF376) : https://www.assemblee-nationale.fr/dyn/17/amendements/3210A/CION_FIN/CF376.pdf

Secondaires (à recouper) :
- Garantie financière, date limite 31/10/2026, montants : https://www.aladom.fr/actualites/secteur-service/11232/avance-immediate-du-credit-dimpot-la-date-limite-pour-lattestation-de-garantie-repoussee-au-31-octobre-2026/
- FESP, loi de finances 2026 : https://www.fesp.fr/projet-de-loi-de-finances-pour-2026/
- Fédésap, garantie financière : https://www.fedesap.org/wp-content/uploads/2025/12/CP-Fedesap-%E2%80%93-AiCi-031225.pdf
- Prélèvement des cotisations par les plateformes (2027) : https://www.maxcompta.com/blogs/actualites/micro-entrepreneurs-plateformes-prelevement-cotisations-urssaf
- LCP, crédit d'impôt et PLF 2027 : https://lcp.fr/index%2Ephp/actualites/credit-d-impot-pour-l-emploi-a-domicile-des-deputes-ciblent-le-dispositif-pour-faire-des
- CESU et auto-entrepreneur : https://www.previssima.fr/question-pratique/je-suis-auto-entrepreneur-puis-je-me-faire-payer-en-cesu.html

**Non vérifié** : liste exacte des mentions de facture SAP (arrêté du 17/03/2015) ; si un éditeur ou une plateforme non SAP peut s'habiliter pour le compte de prestataires ; noms de champs et codes « nature » de l'API ; issue de l'amendement 40 % au PLF 2027 ; exclusion stricte des espèces dans le BOFiP en vigueur (seule une ancienne version a été lue).
