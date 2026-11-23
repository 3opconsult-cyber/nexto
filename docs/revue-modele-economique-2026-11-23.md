# Revue avant les premiers testeurs : modèle économique, prix, facture, process (23/11/2026)
Lecture seule (aucun code modifié). Sources : `src/lib/billing.ts`, `pricing.ts`, `invoice-pdf.ts`, migrations 006/025/038/039/047/056/059/060,
réglages lus en production le 23/11 (`app_settings`), et 3 PDF réels téléchargés le 23/11 avec les comptes audit `.invalid`
(mission `42f75f09…`, FACT / PING-C / PING-V-2026-00062). Aucun chiffre de marché : tout ce qui n'est pas ici est « non vérifié ».

## 1. Modèle économique (règles en base le 23/11 : 8 % client + 17 % prestataire, seuil 10 min, taux figés)
Formules : client paie = prestation + 8 % ; prestataire perçoit = prestation − 17 % ; PING = 25 % de la prestation, avant coûts et avant TVA éventuelle.

| Cas | Prestation | Client paie | Prestataire perçoit | PING (avant coût) |
|---|---|---|---|---|
| 1. Horaire 25 €/h, 2 h 08 réelles (8 min < 10 : 2 h) | 50,00 € | 54,00 € | 41,50 € | 12,50 € |
| 1 bis. Même mission, 2 h 12 réelles (heure entamée : 3 h) | 75,00 € | 81,00 € | 62,25 € | 18,75 € |
| 2. Forfait seul 90 € « 3 h » (jamais ajusté) | 90,00 € | 97,20 € | 74,70 € | 22,50 € |
| 3. Forfait 90 € 3 h incluses puis 25 €/h, 3 h 40 réelles (+1 h) | 115,00 € | 124,20 € | 95,45 € | 28,75 € |
| 4. Annulation à frais totaux, mission 100 € | 100,00 € | 108,00 € | 83,00 € | 25,00 € |
| 5. Arrangement à l'amiable : avoir de 20 € sur 100 € | 80,00 € | 88,00 € | 63,00 € | 25,00 € (inchangé, 047) |
| 6. Mission 100 € | 100,00 € | 108,00 € | 83,00 € | 25,00 € |

Preuves en production : PING-C 7,20 € et PING-V 15,30 € sur FACT 90 € (cas 2) ; PING-C 8,00 € sur une annulation FACT 100 € (cas 4).
À noter : horaire pur = 1 h minimum (40 min → 25 €) ; 3 h 05 sur le forfait = 90 € (5 min < 10). Cas 5 : PING garde 25 € sur 80 €
réellement dus, soit 31,25 % ; le prestataire supporte seul l'avoir (décision 047 en attente). Cas 4 : le prestataire paie 17 € de
commission sur une mission non faite.

Sensibilité (pur calcul, prestation de 100 € ; « taux » = part totale prise par PING) :

| Taux total PING | Par mission de 100 € | 10 missions / mois | 50 missions / mois | 200 missions / mois |
|---|---|---|---|---|
| 5 % | 5 € | 50 € | 250 € | 1 000 € |
| 10 % | 10 € | 100 € | 500 € | 2 000 € |
| 15 % | 15 € | 150 € | 750 € | 3 000 € |
| 25 % (actuel) | 25 € | 250 € | 1 250 € | 5 000 € |
| 25 % sur 90 € (forfait des tests) | 22,50 € | 225 € | 1 125 € | 4 500 € |

Ce sont des montants FACTURÉS, pas encaissés : le 23/11, `ping_iban` est vide en production, donc aucun client ni prestataire ne
peut virer PING (écran : « Les coordonnées bancaires de PING vous seront communiquées très prochainement »). Encaissé réel : 0 €.
Panier moyen, volume, taux des concurrents : non vérifié (aucune source datée dans le dépôt).

### Points juridiques et fiscaux (à faire valider par un juriste / expert-comptable ; rien n'est tranché ici)
1. Identité de PING : SIRET `[à compléter]`. Les PDF disent « PING — société en cours de constitution, immatriculation en cours » ;
   le virement va à « OpConsult (PING) » et les CGU nomment « OpConsult (PING) ». Qui émet, qui encaisse ? Un relevé (et non une
   facture) suffit-il pour réclamer de l'argent avant l'immatriculation ?
2. TVA sur les frais et commissions : aucune mention (ni HT/TTC, ni exonération) sur PING-C / PING-V. Régime de PING à établir.
3. Crédit d'impôt / CESU : les 8 % de frais client entrent-ils dans la dépense ouvrant droit ? Quelle part afficher ? (non vérifié ;
   voir `docs/cesu-ce-qui-manque.md`, avance immédiate éteinte).
4. DAC7 et art. 242 bis CGI : PING collecte déjà un NIF (`provider_private`) ; obligation de déclaration et de récapitulatif annuel
   applicable à une plateforme qui n'encaisse pas ? Seuils ?
5. Statut d'intermédiaire / plateforme : informations obligatoires au consommateur (qualité du prestataire, rémunération de PING,
   classement), médiateur de la consommation (absent des documents), droit de rétractation pour un service réservé en ligne face
   à l'annulation à 100 %.
6. Mandat de facturation : la FACT est fabriquée par PING sous l'en-tête du prestataire, numérotée dans une suite commune à tous
   les pros (trous dans la suite de chaque pro). Faut-il un mandat écrit et la mention « établie par PING au nom et pour le compte de » ?
7. RECAP (intervenant particulier non immatriculé) : risque de requalification en emploi direct (déjà signalé dans le doc CESU).

## 2. Prix et présentation : ce que le client voit
| Étape | Texte exact (code) | Constat |
|---|---|---|
| Carte (`LiveMap.tsx` l. 92-93) | « 90 € » ou « 25 €/h » | Prix du prestataire SANS les 8 % : le client paiera 97,20 € |
| Fiche (`pro/[id]`) | « Forfait 3 h, puis à l'heure », « Par heure », « Sur devis » | Aucun mot sur les frais de service |
| Réservation (`mission/new` l. 485-490) | « Total 97,20 € » / « Frais de service PING inclus » / « … Montant recalculé sur la durée réelle… » | Montant des frais non détaillé ; « recalculé » s'affiche aussi pour un forfait seul, qui n'est jamais ajusté (invariant 4) |
| Devis dans le chat (`chat` l. 664) | « Vous paierez X, frais de service inclus » ; pro : « Le client paie X · Vous percevez Y après commission PING » | Clair pour le pro ; le client ne voit pas le montant des frais |
| Bon de commande (`OrderSummary` l. 52-63) | « Prestation, à … » / « Frais de service PING 8 % — facturés à part par PING » / « Total » | Seul écran avec le détail ; arrive après l'engagement |
| Facture (`mission/[id]/facture`) | Onglets « Prestation » et « Frais de service » ; PDF : « Frais de mise en relation », « Prélevés sur l'intervention » | 3 noms pour la même chose ; « prélevés » est faux (rien n'est prélevé, le client vire) ; aucun document ne montre le total 97,20 € |
Honnêteté : le total tout compris est dit AVANT de réserver (bien), mais le montant des frais seulement APRÈS ; la carte affiche
un prix inférieur à ce que le client paiera. Les 25 % ne sont jamais présentés ensemble (normal : chacun voit sa part).
Autres incohérences : l'écran client de la facture montre une note interne (« PING n'est pas encore immatriculée : le document le
mentionne tel quel. Dès que le SIRET existe, il se saisit dans l'admin… ») ; l'inscription pro fait accepter « commission retenue sur
mes versements, prélèvement SEPA » alors que tout passe par virement ; « Règlement à réception » (PDF) contre 15 jours (application).
Grille des prestataires (`/pro/tarifs`) : le pro fixe son prix sans voir ce qu'il touchera (−17 %) ni ce que paiera le client (+8 %).

## 3. Facture : lecture des 3 PDF réels (23/11, FACT / PING-C / PING-V-2026-00062)
| Mention (facture française) | FACT (prestataire) | PING-C / PING-V |
|---|---|---|
| Vendeur : nom, adresse, SIRET, forme | Présents (« Entrepreneur individuel (EI) ») | Nom « en cours de constitution », ni adresse ni SIRET |
| Client : nom, adresse | Nom + adresse (sans code postal sur le compte test) | Idem |
| Numéro unique, date d'émission | Oui | Oui |
| Date et désignation de la prestation | Oui, mais la ligne « forfait 90,00 € (3 h incluses), puis 25,00 € de l'heure » sort de la page (coupée après « puis ») | « Frais de mise en relation, 8 % / 17 % du montant » |
| Prix HT / TTC, TVA ou exonération | « Total 90,00 € » + « TVA non applicable, art. 293 B du CGI » ; mots HT/TTC absents | Aucune mention de TVA |
| Conditions de paiement, échéance, mode | « Règlement à réception » ; ni date limite, ni IBAN, ni « virement » | Idem |
| Pénalités de retard, indemnité 40 € | Présentes, mais sans accents (« penalites », « interet », « prealable », « Indemnite ») | Absentes |
| Adresse d'intervention | Oui | — |
| Pied de page | « Ce relevé fait foi en cas de contestation » (sur une facture, et aussi sur les relevés PING où il ne veut rien dire) | Idem |
Chaque point légal ci-dessus est « à faire valider par un juriste / expert-comptable ». Constat RLS vérifié le 23/11 : le compte
client lit par l'API la ligne PING-V (commission du pro) ; l'écran la masque, la base non (A-TRANCHER h).
Lisibilité : sobre et propre ; mais le client non spécialiste reçoit deux documents, deux montants, deux références, et doit
reconstituer seul « 97,20 € à payer en deux virements ».

Maquette proposée (texte, à valider) — une page « Ce que vous devez » pour le client, puis les documents officiels :
- En haut : « Mission Ménage du 22/11/2026 — Total à régler : 97,20 € en 2 virements avant le JJ/MM ».
- Bloc 1 : « À Audit Menage Pro : 90,00 € — IBAN … — référence FACT-… » ; bloc 2 : « À PING : 7,20 € (frais de service 8 %) — IBAN … — référence PING-C-… ».
- Facture du prestataire : en-tête pro ; tableau Désignation / Quantité / Prix unitaire / Total ; « Total HT = Total TTC » + mention de
  TVA ; échéance datée et mode « virement » ; mention éventuelle du mandat ; pénalités avec accents ; plus de mot « relevé ».
- Document PING : un seul nom (« Frais de service » côté client, « Commission » côté pro), identité réelle de l'émetteur, TVA, échéance, IBAN.

## 4. Process de bout en bout (qui, délai, sans réponse)
| Étape | Qui | Délai d'attente | Sans réponse |
|---|---|---|---|
| Recherche sur la carte, fiche | Client (compte obligatoire) | — | — |
| Réservation directe | Client puis prestataire accepte | 24 h, ou 2 h avant le RDV | Expire, créneau libéré (cron : A-TRANCHER f) |
| Demande + devis dans le chat | Pro propose, client accepte | Aucun délai | Le devis reste en attente sans fin |
| Adresse « à valider » (autre que le profil) | Pro accepte / refuse | Aucun délai | Reste bloquée |
| Bon de commande, « sur place / absent » | Client | — | — |
| Annulation client | Client | Gratuite tant que le pro n'a pas appuyé « Je pars » ; pro en route : motif grave, ou 100 % à moins de 15 min du RDV ; 100 % après l’arrivée | — |
| Jour J : « Je pars », arrivée (code / QR / photo + GPS) | Prestataire, preuve du client | Pro absent 30 min → client le déclare | Client muet 2 h → clôture sur preuve |
| Fin : QR de fin, montant final, 3 documents | Prestataire | Immédiat | — |
| Incident / litige | Une partie, puis Décision PING | 24 h après la fin | Plus de litige ensuite |
| Paiement par virement (3 virements) | Client → pro, client → PING, pro → PING | 15 jours ; « Non reçu » → 3 jours | Commission pro : dette, suspension au-delà de 50 € ; frais client : rien d'automatique |
| Avis | Client sur le pro, pro sur le client | — | — |
Trous : devis et adresse « à valider » sans délai ; séquestre éteint ; Resend non branché (aucun e-mail : le pro ne sait qu'il a une
réservation que s'il ouvre l'application, alors qu'elle expire en 24 h) ; IBAN PING vide. Le prestataire peut-il ne pas être payé ?
Oui : rien ne retient l'argent du client ; PING ne peut que noter « non reçu », alerter, ouvrir un litige ; et le pro doit quand
même ses 17 % (la dette de commission ne dépend pas du paiement du client). Annulation gratuite possible 1 minute avant le RDV si
le pro n'a pas encore appuyé « Je pars ».

## 5. Avant le lancement des testeurs
| Niveau | Action | Raison |
|---|---|---|
| Bloquant | Saisir l'IBAN et le nom du bénéficiaire de PING (ou dire aux testeurs que les frais ne sont pas dus) | Sinon personne ne peut payer PING |
| Bloquant | Décider qui émet les documents PING (OpConsult ou PING en constitution) et le faire relire | Documents envoyés à de vrais clients |
| Bloquant | Corriger la ligne coupée du PDF et les accents des mentions | Facture tronquée = document faux |
| Bloquant | Prévenir les pros testeurs qu'aucun e-mail ne part (ou brancher Resend) | Réservations expirées sans qu'ils le sachent |
| Important | Afficher le montant des frais avant de réserver ; dire « prix prestataire, + 8 % de frais » sur la carte | Prix compris avant l'engagement |
| Important | Ne plus écrire « recalculé » pour un forfait seul ; un seul nom pour les frais ; retirer « prélevés » | Textes faux ou confus |
| Important | Retirer la note interne de l'écran facture ; aligner l'inscription pro (« retenue », « SEPA ») sur le virement | Texte trompeur |
| Important | Corriger la RLS `invoices` (A-TRANCHER h) | Le client peut lire la commission du pro |
| Important | Délai pour un devis et une adresse « à valider » | Missions bloquées sans fin |
| Confort | Page « Ce que vous devez » (total 97,20 € en 2 virements) ; net affiché dans la grille du pro | Compréhension |
| Confort | Pied de page propre à chaque document ; suite de numéros par prestataire si le juriste le demande | Lisibilité, conformité |

## 6. Les 5 décisions que seul Romain peut prendre
1. Taux : garder 8 % + 17 % pour les testeurs, ou un taux d'essai (le dire par écrit ou non : A-TRANCHER s).
2. Entité qui facture et encaisse les frais (OpConsult ou future société PING) et le calendrier d'immatriculation.
3. Après un avoir : PING garde-t-elle ses 25 € (047) ? Après une annulation : le pro paie-t-il 17 % sur une mission non faite ?
4. Si le client ne paie pas le prestataire : le pro doit-il quand même sa commission ? Faut-il rallumer un séquestre avant l'ouverture large ?
5. Annulation gratuite jusqu'à « Je pars » ou jusqu'à N heures avant le RDV ; et délai de réponse pour devis et adresse.
