# Contrat maquette / application : Particulier (client), partie 2 : messages, facture, litige, profil, design (vérifié le 23/11/2026)
Contrat principal : CONTRAT-MAQUETTE.md. Maquette : docs/maquette/maquette-ping-v11.html (18/11/2026) ; lignes sources : docs/maquette/data.js (A = Audit, Q = Contrôle qualité, numérotés dans l'ordre du fichier).
Code lu au commit b4c6437 (dernier déploiement de production vérifié le 22/11 par l'agent principal). Production injoignable depuis cet environnement (403 Vercel) : aucune ligne n'est « OK » sans « (code) ».
Statuts : OK, OK (code), MANQUE, VOULU, NON VÉRIFIÉ. « OK (code) » = texte ou fonction trouvé dans src/ ou public/ (fichier:ligne), pas de rendu vu.

| Écran ou onglet | Élément | Statut | Note |
|---|---|---|---|
| Messages | Une conversation par interlocuteur et par mission ; conversations vides absentes | OK (code) | src/app/messages/page.tsx:127 ; Q119 Q154 ; HISTORIQUE invariant 19 (séparation par mode) |
| Conversation | Devis avec accepter / refuser / contre-proposer ; « Vous percevez » côté pro | OK (code) | src/components/MissionRecap.tsx:158 ; Q001 Q132 |
| Conversation | Rendez-vous et adresse dans la conversation après accord | OK (code) | src/components/AddressChoice.tsx:79 ; Q002 ; adresse masquée sans numéro jusqu'à acceptation |
| Conversation | Bon de commande ouvert depuis le chat (« Voir la commande ») | OK (code) | src/components/presence/OrderCardLink.tsx:14 ; D-14 ; écritures non testées |
| Conversation | Retour : l'écran d'arrivée n'est jamais deux fois dans l'historique | OK (code) | src/components/RetourLink.tsx:6 ; Q128 |
| Heure entamée | Seuil réglable ; forfait seul jamais ajusté ; horaire min 1 h ; affichée au scan de fin | OK (code) | src/lib/pricing.ts:39 ; Q010 Q091 ; invariant 4 ; seuil 10 min en base (A-TRANCHER q) |
| Facture | En-tête du prestataire seul ; frais PING séparés | OK (code) | src/components/MissionRecap.tsx:152 ; A13 Q059 Q109 ; 3 factures (invariant 2) |
| Facture | PDF : espace fine des milliers, taux appliqué | OK (code) | src/lib/invoice-pdf.ts:154 ; Q137 ; A-TRANCHER s (taux affiché sur les PDF) |
| Facture | Mentions selon le statut : forme juridique, SIRET, TVA ou « art. 293 B », n° SAP | OK (code) | src/app/cgu/page.tsx:42 ; Q088 Q194 |
| Facture | Mode de validation réel (QR sur place, code, confirmation) et heures | OK (code) | src/app/mission/[id]/facture/page.tsx:12 ; A42 Q176 Q205 |
| Facture | Bloc virement : bénéficiaire, IBAN, BIC, référence, Copier | OK (code) | src/components/TransferCard.tsx:23 ; Q011 Q122 ; IBAN de PING saisi dans l'admin |
| Facture | Partage, export, envoi au comptable | OK (code) | src/components/ShareInvoiceSheet.tsx:97 ; Q022 |
| Virements | Un virement par document (prestation, frais, commission) : annoncé, reçu, non reçu | OK (code) | src/components/TransferCard.tsx:238 ; Q112 ; D-19 séquestre bloqué |
| Paiements | Rubrique « Pourboires annoncés » (intention non prélevée) | MANQUE | Texte « Pourboires annoncés » absent du code ; le pourboire est seulement une ligne du récapitulatif (MissionRecap) liée à l'avis. Q136 |
| Avis | Critères, je recommande, pourboire ; avis à la demande depuis la facture | OK (code) | src/components/ReviewModal.tsx:118 ; Q013 Q061 ; « Je recommande » et note privée : texte absent du code, non confirmé |
| Avis | Étoiles, avis une note suffit après fin | OK (code) | src/components/ReviewModal.tsx:35 ; Q180 Q125 |
| Annulation | 3 paliers tenus par la base (gratuit / motif sérieux / frais totaux) | OK (code) | src/lib/cancellation.ts:121 ; Q008 Q096 Q135 ; décision 20/11 (D-07) |
| Annulation | Maquette : 15 % seulement après « en route » ; app : 3 paliers et frais totaux après l'arrivée | VOULU | Décisions Romain 20/11, annulation en 3 paliers tenus par la base (HISTORIQUE.md l.662-663) et après l'arrivée aux frais totaux avec alerte (l.679 ; A-TRANCHER a). Q008 Q135 |
| Litiges | Liste de tous les dossiers, ouverts d'abord ; pluriels justes | OK (code) | src/app/litiges/page.tsx:14 ; A36 Q130 |
| Litige | Dossier /litiges/[id] : auteur et heure sur chaque message ; statut lu partout | OK (code) | src/app/litiges/[id]/page.tsx:182 ; Q111 Q134 ; D-05 |
| Litige | Arrangement à l'amiable : un montant, Proposer, accepter / refuser (3 appuis) | OK (code) | src/components/AmicableSettlement.tsx:134 ; Q185 Q186 Q188 ; décision 18/11 (HISTORIQUE.md l.627) ; colonnes d'accord 040 : à coller, non vérifié |
| Litige | Décision PING par un admin | OK (code) | src/app/litiges/[id]/page.tsx:297 ; D-05 : non jouée faute de compte admin |
| Signaler un problème | Bouton dans l'agenda, 24 h après la fin | OK (code) | src/app/agenda/page.tsx:241 ; Q134 ; D-06 |
| Avoir | Avoir AVOIR-… visible (écran, facture, PDF), virement ajusté | OK (code) | src/components/TransferCard.tsx:48 ; Q187 ; décision 18/11 |
| Mon profil | Hub : Mon compte, documents, favoris, parrainage (compteurs seuls) | OK (code) | src/app/client/profil/page.tsx:119 ; A14 Q081 ; invariant 17 |
| Pièce d'identité | Photo, envoi, statut « En contrôle » | OK (code) | src/components/DemoShell.tsx:510 ; A15 ; D-09 pièces refusées / expirées |
| Pièce d'identité | Envoi de document client | OK (code) | src/app/client/documents/page.tsx:85 ; A15 |
| Favoris | Liste des favoris | OK (code) | src/app/client/favoris/page.tsx:8 ; maquette « Favoris » |
| Aide | Aide : rubriques | OK (code) | src/app/aide/[slug]/page.tsx:7 ; Q019 ; /aide non joint en production |
| Commentaire (test) | Bulle « Laisser un commentaire » (hors /auth, /mission, /essai) | OK (code) | src/components/FeedbackBubble.tsx:57 ; Q012 Q124 Q019 |
| Support PING | Ouvre « Laisser un commentaire » | OK (code) | src/components/DesktopShell.tsx:32 ; Q124 |
| Avance immédiate / CESU | Avance immédiate Urssaf, crédit d'impôt géré par le client | OK (code) | src/components/AvanceImmediateCard.tsx:15 ; Invariant 17 ; code prêt, ÉTEINT |
| Relevé annuel | Relevé annuel et export CSV du client | OK (code) | src/app/agenda/page.tsx:399 ; maquette « Relevé annuel » |
| Design | Jetons teal #12B39C / navy #123644, Quicksand + Inter | OK (code) | src/app/ping-ui.css:270 ; Q075 Q082 ; commit 4cf6605 titres Quicksand |
| Design | Cibles tactiles >= 44 px | OK (code) | src/app/ping-ui.css:24 ; Q142 ; mesure en navigateur non faite |
| Design | Pictogrammes SVG (mêmes tracés que /demo), jamais d'emoji | OK (code) | src/components/PingIcons.tsx:49 ; Q054 ; invariant 7 |
| Design | En-têtes : barre de carte 56 px, en-tête navy 62 px | OK (code) | src/components/ping/PingTopBar.tsx:24 ; Q076 Q079 ; hauteurs et avatars non mesurés |
| Maquette seule | Cadre téléphone, historique de navigation, bouton « Vue ordinateur », messages temporaires, formulaires et états propres à la maquette | NON VÉRIFIÉ | Sans équivalent dans l'app : rien à comparer. Q023 Q024 Q025 Q041 Q042 Q043 Q045 Q098 Q123 Q147 |
| Mon profil | Rubrique « Mes factures » : l'app l'appelle « Mes opérations » (Factures et reçus) | OK (code) | src/app/client/profil/page.tsx:114 ; Q046 ; libellé différent de la maquette, sans décision écrite : à trancher |
