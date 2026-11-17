# Contre-audit v6 — Prestataire (17/11/2026)

Playwright 390×844 et 1280×900, comparé à src/app/pro/**. 0 erreur JS.

## P0
1. Annulation par le pro (mission 5, Je pars, Annuler) : « frais tardifs 15 % versés au prestataire » ; texte à la 3e personne. Attendu : frais seulement si le CLIENT annule ; si le pro annule, pas de frais, texte adapté.
2. Proposer un tarif, « Forfait + heures sup » : re-rendu au blur du prix, le champ heures perd le focus, 2 non pris, envoi avec 3 h. Prix pré-rempli au budget min, saisie à la suite donne 3030 € sans garde-fou. Attendu : focus/valeur conservés, récapitulatif avant envoi, champ prix vide avec budget en indication.
3. « Forfait + heures incluses » absent de Mes tarifs et de l'étape 3 de l'assistant (régression vs /pro/tarifs et onboarding, included_hours).
4. Client absent : photo/accord de la mission 5 réutilisés pour la mission 8. Attendu : remis à zéro par mission.

## P1
1. SIRET : tout numéro à 14 chiffres « trouvé (annuaire) » ; nom d'entreprise inventé ; « le reste se remplit tout seul » sans effet ; statut non modifiable sur l'écran ; plus de retour après « Rechercher dans l'annuaire ». Attendu : recherche par nom puis SIRET, jamais « trouvé » sans recherche.
2. Assistant création d'activité : étape 1 sans retour, menu ni barre ; impossible de revenir en particulier alors que « brouillon enregistré ».
3. Zone autour d'une ville : distances toujours depuis Nice.
4. Mission exécutable avant la date du RDV (Je pars, QR, facture le 17 pour un RDV le 19). Attendu : seulement le jour du RDV.
5. Fin de mission client absent : seul le QR ; prévoir code ou photo.
6. « Il vous reste » incohérent avec Mes pièces (URSSAF demandée à un particulier ; décennale non comptée pour Amélie).
7. Proposition abandonnée crée une conversation vide.
8. Réponse à une demande : par défaut seul « Proposer mon tarif » ; attendu « Contacter le client » d'abord (non-régression).

## P2
- Interrupteur coupé : titre reste « Disponible maintenant » (app : « Hors ligne »).
- Filtres carte pro : « Tous » ajoute des métiers non pratiqués ; vue par défaut pas « Tous ».
- Créneaux : 9 ouverts (Mon entreprise) vs 8 réservables (Agenda).
- Litige sur facture déjà « Reçu » : texte « reste en attente de règlement ».
- Données : Karim facturé 2 × 18 € au panier alors que catalogue 15 €/panier.
- Aide côté pro : uniquement sujets client.
- « Proposer un tarif » ouvrable après accord : envoi sans effet ni message.
- « 1 missions terminées » ; titre « Mon entre… » coupé par la flèche retour sur un onglet racine.
- « Particulier / Professionnel » puis « Entreprise / Particulier » : deux sens de « particulier ».
- Qualifications par domaine sans lien avec les services du pro.
- Chat client 390 px : carte « Fixez le rendez-vous » sous la barre de saisie.
- 1280 px : espace pro sans barre latérale de l'app.

## Ce qui marche
Montants justes (vous percevez, commissions, revenus) ; heure entamée ; règle du tarif ; adresse masquée/validée ; code client absent ; 3 documents ; inscription avec validations ; visibilité Nouveau/non réservable ; Mes tarifs ; vocabulaire ; design.
