# Contre-audit v6 — Client et site public (17/11/2026)

Playwright 390×844 et 1280×900, comparé à l'app. Scripts : scratchpad/e2e/contre-client/.

## P0
1. Conversation qui passe d'une mission à l'autre : réserver Amélie (jeu. 19, autre adresse) reprend la conversation de la mission 5 et la rattache à la nouvelle ; la mission 5 affiche le RDV et l'adresse « à valider » de l'autre. Attendu : un fil par mission (ou missions séparées dans le fil).
2. Ancien devis encore acceptable après réservation à prix figé (Julien 22 €/h, devis « Forfait 120 € » en attente → crée une 2e mission). Attendu : devis en attente « Remplacé » à la réservation, proposition de tarif fermée.
3. Réservation sans adresse (nouveau client, puce « (votre profil) » vide, mission « adresse confirmée » vide ; Mon compte permet d'effacer l'adresse). Attendu : adresse obligatoire.
4. Virement impossible : IBAN du pro masqué, pas d'IBAN PING pour les frais, mais « J'ai fait le virement » proposé. Attendu : comme TransferCard (IBAN complet, BIC, copier, IBAN PING).
5. « Envoyer la proposition » ne marche qu'au 2e appui (onchange de #of_p redessine l'écran pendant l'appui).

## P1
1. Menu > Support PING : ACT.dgo défini deux fois.
2. Avis : valeurs (étoiles, pourboire, recommande) reprises d'une mission à l'autre ; 2 étoiles publiées pour Amélie.
3. Inscription : basculer Particulier/Professionnel vide les champs ; « Changer d'e-mail » ramène à l'accueil et perd le formulaire.
4. « Choisir une ville » sans effet (carte et profil restent Nice).
5. Retour après envoi d'une proposition : réaffiche la même conversation (2 appuis).
6. Propositions après contre-offre : offre de Karim « Non retenue », contre-proposition invisible.
7. Pas de liste des litiges (Réclamations et bandeau Agenda n'ouvrent que le dernier) ; « 2 litige ouvert ».
8. Bouton PING de la carte sans effet (hors ligne déjà masqués ; app : en gris, PING recharge).
9. Conversation non chronologique (devis toujours après les messages).

## P2
- Dates : mission terminée « Demain · 9 h » ; facture « intervention du mer. 18 nov. » (futur) ; départ possible la veille ; Agenda « Réponse attendue : lun. 16 nov. » vs litige « Échéance dépassée ».
- Litige/facture : litige sur récap « Reçu » dit « reste en attente » ; facture en litige propose « J'ai fait le virement » ; montant réclamé « abc » ignoré sans message.
- Annulation tardive : « 15 % versés au prestataire » sans document ; l'app dit que ces frais ne s'appliquent qu'avec le paiement en ligne.
- Pourboire annoncé absent des Paiements.
- Calculs : frais client sur forfait seul (pas sur les heures au-delà) ; 4,5 et 4,6 affichés 5 étoiles ; Karim 18 €/panier vs fiche 15 € ; numéros de facture d'un compteur commun ; PDF sans adresse.
- Fiche : « Réserver · 22 €/h » ouvre le forfait 66 € ; suivi avec deux boutons d'écriture ; propositions sans distance ni total frais compris.
- Écarts app : dépôt de demande sans heures, types de linge, jour précis, budget min-max libre ; pas de retrait de demande ; hebdomadaire = une seule mission ; deux missions à la même heure possibles.
- Textes : « …, Autre service, près de chez vous » ; en-tête Messages « Novembre » figé ; « Passer en pro » vs « Devenir prestataire » ; indication « bouton Prestataire » trompeuse pour Karim/Julien.
- Liens factices : CGU = message ; mot de passe oublié sans e-mail = « lien envoyé » ; toute connexion ouvre Marie.
- Cibles tactiles < 44 px : « ← Carte », « Modifier » (15 px), « Voir le profil » (21), onglets Agenda (31), « Réserver » (28), étoiles (30 de large).
- Page autour : sur mobile « Aller à un écran » ne remonte pas au téléphone ; sur ordinateur téléphone coupé en bas ; pas de version ordinateur (DesktopShell) ; zoom +/− cache l'étiquette de Nina.

## Ce qui marche
Carte (glisser, pincer, molette, volet 3 positions, multi-services) ; aperçu précédent/suivant ; pièces « Validée » seulement contrôlées ; montants justes (8 %, heure entamée, annulation 15 %) ; récap sans SIRET ; garde-fous téléphone/e-mail ; code client absent ; créneaux ; vocabulaire ; inscription ; favoris ; relevé annuel ; Messages recherche/non lus.
