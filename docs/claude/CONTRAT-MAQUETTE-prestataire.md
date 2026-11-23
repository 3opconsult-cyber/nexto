# Contrat maquette / application : Prestataire (vérifié le 23/11/2026)
Contrat principal : CONTRAT-MAQUETTE.md. Maquette : docs/maquette/maquette-ping-v11.html (18/11/2026) ; lignes sources : docs/maquette/data.js (A = Audit, Q = Contrôle qualité, numérotés dans l'ordre du fichier).
Code lu au commit b4c6437 (dernier déploiement de production vérifié le 22/11 par l'agent principal). Production injoignable depuis cet environnement (403 Vercel) : aucune ligne n'est « OK » sans « (code) ».
Statuts : OK, OK (code), MANQUE, VOULU, NON VÉRIFIÉ. « OK (code) » = texte ou fonction trouvé dans src/ ou public/ (fichier:ligne), pas de rendu vu.

| Écran ou onglet | Élément | Statut | Note |
|---|---|---|---|
| Menu | 4 entrées : Demandes autour de moi, Messages, Agenda, Mon entreprise + Support PING ; interrupteur Disponible | OK (code) | src/components/DesktopShell.tsx:32 ; Q077 ; HISTORIQUE.md l.36 |
| Menu | Entrée « Mission » les jours de mission seulement | VOULU | Décision Romain 18/11 « Navigation validée » (HISTORIQUE.md l.629 ; A-TRANCHER r) |
| Demandes (carte pro) | Zone autour d'une ville : distances recalculées, filtre par service | OK (code) | src/app/pro/carte/page.tsx:83 ; A19 Q033 Q063 Q150 |
| Demandes (carte pro) | Demande publiée visible ; « Propositions envoyées » | OK (code) | src/app/pro/carte/page.tsx:353 ; Q029 Q102 |
| Demande | « Contacter le client » d'abord, puis « Proposer mon tarif » | OK (code) | src/app/pro/carte/page.tsx:292 ; Q007 Q155 |
| Demande | Détails propres à chaque demande : surface, pièces, linge, fréquence, foyer | OK (code) | src/components/RequestDetails.tsx:53 ; Q094 ; migration 024 |
| Demande | Adresse : distance seule tant que non répondu / non payé | OK (code) | src/lib/proNearby.ts:30 ; Invariant 9 ; requests_nearby |
| Proposer un tarif | 3 modes : forfait, horaire, sur devis ; « Vous percevez X € » | OK (code) | src/components/PricingEditor.tsx:19 ; Q001 Q090 Q145 ; règle suprême du tarif |
| Mes tarifs | Mode « Forfait + heures incluses » (heures, tarif au-delà) | OK (code) | src/components/PricingEditor.tsx:65 ; Q146 ; D-16 (ajout 4 appuis, retrait 3) |
| Mes tarifs | Ajouter, modifier, masquer de la fiche, supprimer un service | OK (code) | src/app/pro/tarifs/page.tsx:285 ; A16 Q047 Q084 ; D-16 faite |
| Mes tarifs | Services visibles suivent la fiche ; prix supérieur à 0 € | OK (code) | src/app/pro/tarifs/page.tsx:239 ; Q031 |
| Mes tarifs | Catalogue de services en données (hors ménage, repassage, nettoyage) | VOULU | Décision 07/11 services extensibles (HISTORIQUE.md l.622) ; mono-produit tant que le catalogue n'ouvre rien (l.47 ; A-TRANCHER n) ; fin de chantier, remise en état hors catalogue proposé |
| Qualification | Ajout par domaine (bâtiment, nettoyage, garde d'enfants, autre) avec justificatif | OK (code) | src/lib/catalog.ts:62 ; A18 Q050 ; texte « RGE » / « petite enfance » absent de l'interface, catalogue en base non lu |
| Mon entreprise | Vérifications : statut par ligne (identité, URSSAF, RC Pro, décennale) | OK (code) | src/app/pro/documents/page.tsx:55 ; A17 Q049 Q153 ; seul le bâtiment exige la décennale non confirmé |
| Mon entreprise | Pièce refusée : motif et « Renvoyer une pièce » | OK (code) | src/app/pro/documents/page.tsx:264 ; Q100 Q035 ; D-09 pastille admin non vue |
| Mon entreprise | Pièces expirées : alerte à 45 jours, statut expired | OK (code) | src/app/pro/documents/page.tsx:62 ; A27 Q163 ; HISTORIQUE.md l.648 |
| Mon entreprise | « Il vous reste… » jauge de complétude | OK (code) | src/lib/listing.ts:67 ; Q032 Q153 |
| Mon entreprise | Hub : Mon annonce, Mes pièces, Mes paiements | OK (code) | src/app/pro/dashboard/page.tsx:14 ; Q081 ; invariant 10 ligne Hub |
| Fiche publique | Aperçu seul ; seules les pièces validées par un admin figurent | OK (code) | src/components/ProListingPreview.tsx:61 ; Q027 Q028 Q103 |
| Mon annonce | Photos, accroche, présentation, points forts, zone, galerie | OK (code) | src/app/pro/annonce/page.tsx:296 ; Q032 ; écran « Photo et présentation » de la maquette devenu « Mon annonce » |
| Mon annonce | « Voir comme un client » | OK (code) | src/app/pro/annonce/page.tsx:225 ; A21 |
| Statut, TVA, CESU | Forme juridique, TVA ou art. 293 B, n° SAP, CESU préfinancé | OK (code) | src/app/pro/onboarding/page.tsx:475 ; Q189 Q190 Q195 ; décision 18/11 (HISTORIQUE.md l.628) |
| SIRET | Recherche entreprise, « à vérifier par PING » hors annuaire | OK (code) | src/app/pro/onboarding/page.tsx:6 ; Q065 Q148 |
| Création de l'activité | Assistant : 4 étapes, retour, brouillon, « Plus tard » | OK (code) | src/app/pro/onboarding/page.tsx:43 ; A05 Q030 Q055 Q085 Q149 ; l'app a 5 étapes (particulier) ou 7 (professionnel) |
| Création de l'activité | Compte d'abord, 4 étapes exactement | MANQUE | 5 ou 7 étapes en ligne contre 4 en maquette (src/app/pro/onboarding/page.tsx:43-47) ; aucune décision de Romain trouvée |
| Profil envoyé | « Votre profil est en ligne » / pièce À ajouter ou En contrôle | OK (code) | src/app/pro/attente/page.tsx:54 ; Q086 |
| Disponibilités | Écran Mes disponibilités, répétition ; la réservation propose ses créneaux | OK (code) | src/app/pro/disponibilites/page.tsx:154 ; Q005 |
| Agenda | Même agenda que le client, mode pro ; Agenda ouvre sur la mission du jour | OK (code) | src/app/agenda/page.tsx:235 ; Q004 Q105 |
| Billet de mission | « Client sur place » / « Client absent » sur le billet | OK (code) | src/components/presence/PresenceTag.tsx:8 ; Q200 |
| Réservation reçue | Accepter (1 appui) / Refuser ; expirée disparaît | OK (code) | src/components/BookingCard.tsx:96 ; D-03 faite ; Q003 |
| Adresse à valider | Adresse sans numéro ; le pro accepte ou refuse | OK (code) | src/components/AddressChoice.tsx:79 ; Q003 Q095 ; 023 |
| Je pars | Bouton « Je pars » seulement après acceptation, le jour du rendez-vous | OK (code) | src/components/DepartureBar.tsx:128 ; Q095 Q172 Q151 |
| Je pars | Avertissements « Vous partez tôt », « En avance de… », « Rendez-vous dépassé » | MANQUE | Aucun de ces textes dans le code (recherche exacte) ; A41 Q173 |
| Mission du jour | Une action par étape : Je pars, Scanner le QR du client, Terminer, Voir mes factures | OK (code) | src/components/DepartureBar.tsx:213 ; Q172 A37 |
| QR | Scanner le QR du client ; viseur intégré ; aucune position aux scans | OK (code) | src/components/presence/QrScanner.tsx:31 ; A40 Q034 Q164 Q165 Q170 Q171 ; invariant 8 ; RPC arrive_with_token en base : non lue |
| Client absent | Démarche en étapes : arrivée, position (accord), photo, envoi dans la messagerie | OK (code) | src/components/presence/AbsentProcess.tsx:213 ; A38 Q009 Q106 Q166 Q175 Q201 ; D-02 faite (parcours A 34/34, B 42/42) |
| Client absent | Code de validation envoyé dans la messagerie, saisi par le prestataire | OK (code) | src/components/presence/AbsentProcess.tsx:213 ; Q203 |
| Client absent | Position comparée à l'adresse à 40 m ; photo non envoyée si trop loin | MANQUE | Rayon toléré 300 m dans src/lib/arrival.ts:8 (ARRIVAL_RADIUS_M) contre 40 m en maquette ; aucune décision de Romain trouvée. Q175 Q202 |
| Fin à distance | Le prestataire saisit le code de fin du client ; durée, heure entamée, montant | OK (code) | src/components/presence/RemotePresence.tsx:65 ; A39 Q152 Q204 |
| Fin de mission | Récapitulatif : durée, heures facturées, montant, commission, « Vous percevez » | OK (code) | src/components/MissionRecap.tsx:158 ; Q178 ; Voir mes factures, Noter le client |
| Annulation (pro) | Motif obligatoire, jamais de frais | OK (code) | src/lib/cancellation.ts:121 ; Q144 ; texte « Vous avez annoncé votre départ » absent |
| Prestataire absent / report | Annulation sans frais si absent 30 min, report, clôture sur preuve | OK (code) | src/lib/cancellation.ts:137 ; D-10 ; absence réelle et clôture non rejouées |
| Revenus | Mes revenus : facturé, reçu, commissions | OK (code) | src/app/pro/revenus/page.tsx:84 ; Q014 Q092 |
| Revenus | Relevé annuel et export CSV | OK (code) | src/components/ShareInvoiceSheet.tsx:18 ; Q014 ; export CSV dans l'agenda, pas dans /pro/revenus |
| Paiements (pro) | Commission PING à régler (IBAN de PING), suivi du paiement du client | OK (code) | src/components/TransferCard.tsx:193 ; Q064 Q104 Q112 |
| Paiements (pro) | « J'ai reçu le virement » sur la facture | OK (code) | src/components/TransferCard.tsx:238 ; Q104 ; libellé exact différent, destinataire note reçu |
| Avis sur le client | Note du client avec note privée | OK (code) | src/components/ClientReviewModal.tsx:32 ; Q013 ; « note privée » : texte non retrouvé |
| Litige (pro) | Arrangement : Refuser ou Accepter puis Confirmer, ou proposer son montant | OK (code) | src/components/AmicableSettlement.tsx:134 ; Q186 ; décision 18/11 |
| Zone d'intervention | « Je suis en intervention ici » : secteur flouté 2 km, 12 h, arrêt possible | OK (code) | src/components/LiveZoneCard.tsx:86 ; Invariant 8 ; D-08 ; A-TRANCHER m (2 km contre ~500 m) |
| Aide | Aide du prestataire | OK (code) | src/app/aide/[slug]/page.tsx:7 ; Q156 |
| Conversation | Une conversation par interlocuteur et par demande | OK (code) | src/app/messages/page.tsx:127 ; Q093 Q154 |
| Commande reçue | Écran « Commande reçue » (paiement) côté prestataire | OK (code) | src/app/mission/[id]/commande/page.tsx:86 ; maquette « Commande reçue (paiement) » ; écritures non testées (D-14) |
