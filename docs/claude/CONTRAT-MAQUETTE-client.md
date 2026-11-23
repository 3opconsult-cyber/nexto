# Contrat maquette / application : Particulier (client), partie 1 : carte, menu, demande, réservation, mission (vérifié le 23/11/2026)
Contrat principal : CONTRAT-MAQUETTE.md. Maquette : docs/maquette/maquette-ping-v11.html (18/11/2026) ; lignes sources : docs/maquette/data.js (A = Audit, Q = Contrôle qualité, numérotés dans l'ordre du fichier).
Code lu au commit b4c6437 (dernier déploiement de production vérifié le 22/11 par l'agent principal). Production injoignable depuis cet environnement (403 Vercel) : aucune ligne n'est « OK » sans « (code) ».
Statuts : OK, OK (code), MANQUE, VOULU, NON VÉRIFIÉ. « OK (code) » = texte ou fonction trouvé dans src/ ou public/ (fichier:ligne), pas de rendu vu.

| Écran ou onglet | Élément | Statut | Note |
|---|---|---|---|
| Carte | Fond de carte aux couleurs de l'animation (OpenFreeMap) ; variante type Waze en essai | MANQUE | Décision Romain 17-18/11 (consigne agent principal 23/11 ; DEMANDES D-01 ; pile décrite HISTORIQUE.md l.26) ; variante sur /map?carte=waze (cfef3bb), défaut inchangé ; AUCUNE décision écrite trouvée (HISTORIQUE.md l.26 décrit seulement la pile technique ; JOURNAL l.33 et DEMANDES D-01 : variante Waze, défaut inchangé) : repassé de VOULU à MANQUE le 23/11, Romain doit la consigner ou la trancher. Q075 Q082 |
| Carte | Glisser, zoom (molette, boutons), recentrer | OK (code) | src/components/LiveMap.tsx:194 ; Q016 Q143 |
| Carte | Pastille prestataire : initiale, prix, note, point vert si disponible | OK (code) | src/components/LiveMap.tsx:141-145 ; Q017 Q078 ; gouttes 40 px non mesurées |
| Carte | Puces de service : Tous, Ménage, Repassage, Nettoyage ; sélection multiple | OK (code) | src/components/DemoShell.tsx:415 ; A06 Q053 Q087 |
| Carte | Puce « Vitres » (et fin de chantier, autre service) proposée | VOULU | Mono-produit ménage / repassage / nettoyage (+ vitres en base, non proposé) : HISTORIQUE.md l.47 ; catalogue extensible en données, décision 07/11 (l.622) ; A-TRANCHER n. A06 Q053 |
| Carte | Sélecteur : ceux qui font tout d'abord, puis « Font une partie de vos choix » | OK (code) | src/components/DemoShell.tsx:363 ; Q107 |
| Carte | Hors ligne retiré de la liste, non réservable | NON VÉRIFIÉ | Non réservable : bouton Réserver absent si inactif (src/components/DemoShell.tsx:178) ; épingle grise « Hors ligne » (src/components/LiveMap.tsx:142). Mais le libellé « Hors ligne pour le moment » (DemoShell.tsx:151) montre que ces prestataires restent listés ; la définition de providers_nearby en production n'est pas dans le dépôt (058 l.18). Statut OK (code) retiré le 23/11 ; Q087 Q131 |
| Carte | Filtre « CESU préfinancé » et mention dans la liste, l'aperçu et la fiche | OK (code) | src/components/DemoShell.tsx:146 ; Q192 |
| Carte | Volet à 3 positions, poignée « Afficher la liste », glisser distinct du toucher | OK (code) | src/components/MapSheet.tsx:53 ; A07 Q039 Q051 |
| Carte | Boutons de carte au-dessus du volet, jamais recouverts | NON VÉRIFIÉ | Disposition à mesurer en navigateur : non fait. Q058 |
| Carte | Aperçu fermable, glisser au doigt, précédent / suivant dans la sélection | OK (code) | src/components/DemoShell.tsx:458 ; A10 Q040 Q060 |
| Carte | Nouveau prestataire : visible, réservable, badge « Nouveau · pièces en cours de contrôle » | OK (code) | src/components/DemoShell.tsx:328 ; Q097 Q182 Q184 ; décision 18/11 (HISTORIQUE.md l.626) |
| Carte | Version ordinateur : barre latérale 4 entrées + Support PING | OK (code) | src/components/DesktopShell.tsx:32 ; Q015 Q083 Q143 ; bouton « Vue ordinateur » propre à la maquette, l'app bascule seule à 1000 px (maquette : 1100 px) |
| Carte | Contraste des boutons AA (#0B8374), pas de zoom bloqué | OK (code) | src/app/ping-ui.css:433 ; Q044 Q073 Q196 |
| Menu | 4 entrées identiques (Carte, Messages, Agenda, Mon profil) + Support PING | OK (code) | src/components/DesktopShell.tsx:32 ; Q077 ; HISTORIQUE.md l.36 |
| Menu | Entrée « Mission » visible seulement les jours de mission ; pas de bouton central « Demander » | VOULU | Décision Romain 18/11 « Navigation validée » (HISTORIQUE.md l.629 ; A-TRANCHER r). A08 Q052 Q197 ; « Déposer une demande » reste sur la carte, Mes demandes, Mon profil |
| Menu | Bascule de mode uniquement depuis le menu (pastille, carte de bascule) | OK (code) | src/components/ModeSwitchPill.tsx:23 ; A14 Q048 Q115 ; HISTORIQUE.md l.523 |
| Déposer une demande | Écran unique : critères simples, créneaux, adresse obligatoire, pictogrammes seau / fer | OK (code) | src/app/client/demandes/new/page.tsx:325 ; A08 Q006 Q117 Q121 Q139 |
| Déposer une demande | « Modifier » une annonce déjà publiée | MANQUE | Aucun « Modifier » dans src/app/client/demandes/page.tsx ; seul « Supprimer » (l.332, deux appuis) ; DEMANDES D-17 : Romain a demandé « modifiable », aucune décision d'une annonce non modifiable trouvée. Q139 |
| Déposer une demande | « Payer en CESU préfinancé » seulement si tous les services sont éligibles | OK (code) | src/app/client/demandes/new/page.tsx:88 ; Q191 ; décision 18/11 (HISTORIQUE.md l.628) |
| Mes demandes | Liste des demandes, bouton « Déposer une demande » | OK (code) | src/app/client/demandes/page.tsx:196 ; A08 Q052 |
| Propositions | Propositions de la demande seulement ; accepter ferme celle-ci ; « contre-proposition en attente » | OK (code) | src/app/mission/[id]/chat/page.tsx:996 ; Q110 Q129 |
| Fiche prestataire | Section « Informations déclarées par le pro » : pièce fournie, assurance renseignée | OK (code) | src/components/ProListingPreview.tsx:61 ; A09 Q113 ; langage déclaratif (invariant 6) |
| Fiche prestataire | Libellé « profil vérifié par PING » seulement si pièces validées (identité non expirée) ; maquette : « contrôlée par PING » | VOULU | Exception 03/11 au langage déclaratif (HISTORIQUE.md l.71 ; A-TRANCHER e) : jamais « certifié » ni « garanti ». Q113 ; A09 : section « Vérifications » distincte absente, regroupée dans « Informations déclarées par le pro » |
| Fiche prestataire | Un bouton collant ; « Écrire » unique ; réservation sur la prestation du prix affiché | OK (code) | src/components/DemoShell.tsx:180 ; Q060 Q138 Q021 Q108 ; A10 |
| Fiche prestataire | Prestataire « sur devis » : Contacter, quantité demandée, total calculé | OK (code) | src/app/pro/[id]/page.tsx:202 ; Q089 |
| Réservation | Créneaux issus des disponibilités ; Confirmer bloqué sans créneau | OK (code) | src/app/mission/new/page.tsx:463 ; Q101 |
| Réservation | Réservation à accepter par le prestataire (24 h ou 2 h avant) ; refus / expiration visibles | OK (code) | src/components/BookingCard.tsx:96 ; D-03 ; Q120 |
| Réservation | Devis en attente « Remplacé » à la réservation ; plus de « Proposer un tarif » | OK (code) | src/app/mission/[id]/chat/page.tsx:1152 ; Q120 ; règle suprême du tarif (invariant 3) |
| Commande validée | Écran « Commande validée » : prestation, frais PING, total, virement sur facture | OK (code) | src/app/mission/[id]/commande/page.tsx:86 ; A43 Q198 ; D-14 |
| Commande validée | Séquestre / paiement en ligne actif | VOULU | Écrit mais ÉTEINT : virement SEPA d'abord (A-TRANCHER b et d ; HISTORIQUE.md l.567 ; DEMANDES D-19) |
| Présence | « Je serai sur place » / « Je ne serai pas sur place » juste après la commande | OK (code) | src/components/presence/PresenceChoice.tsx:33 ; A43 Q181 Q199 |
| Agenda | Onglets En cours, Calendrier, Terminées, Factures ; vues | OK (code) | src/app/agenda/page.tsx:30 ; A11 Q004 Q062 Q197 |
| Agenda | Billet « Mission du jour » dans Aujourd'hui avec l'action de l'étape | OK (code) | src/app/agenda/page.tsx:206 ; A37 Q179 |
| Agenda | Factures : chaque ligne ouvre sa facture ; relevé annuel, export, partage | OK (code) | src/app/agenda/page.tsx:399 ; A11 Q022 Q046 |
| Suivi de mission | Frise de suivi ; seul le prestataire fait avancer | OK (code) | src/components/presence/MissionTimeline.tsx:69 ; A12 Q026 ; décision 18/11 |
| Mission du jour | Accès rapide le jour du rendez-vous | OK (code) | src/app/mission/[id]/jour/page.tsx:132 ; A37 Q133 |
| QR | Titres « Mon QR d'arrivée » / « Mon QR de fin » | OK (code) | src/app/mission/[id]/qrcodes/page.tsx:102 ; Q177 ; la carte du jour dit « Votre QR d’arrivée » (ClientProofCard) |
| Client absent (vu du client) | Encart rouge « indique être sur place » avec photo, position, heure | OK (code) | src/components/presence/ClientProofCard.tsx:39 ; A38 Q174 Q202 |
| Client absent (vu du client) | Photo dans la messagerie, « Je confirme » ou « Envoyer un code » | OK (code) | src/components/presence/ClientAbsentAction.tsx:96 ; Q168 Q202 ; D-02 |
| Fin à distance | Code de fin envoyé par le client, saisi par le prestataire | OK (code) | src/components/presence/RemoteConfirmCard.tsx:43 ; A39 Q167 Q204 |
| Fin côté client | Récapitulatif (durée, montant, frais), « Régler par virement », puis avis | OK (code) | src/components/TransferCard.tsx:193 ; Q180 |
| Notification | Push ou e-mail portant l'action ; pastille de message | OK (code) | src/lib/unread.ts:19 ; Q169 ; D-18 : Resend, clé service et CRON_SECRET non posés (non vérifié) ; push absent |
