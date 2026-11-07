# Vision UX et refonte ergonomique (proposition, à valider avant toute maquette)

Complète les 5 rapports de la phase 1. Objectif de Romain (07/11) : une app très intuitive, simple, fluide. Le design graphique (logo, slogan, couleurs, typographies) est conservé.

## 1. Critique d'ensemble
- **L'app est organisée par fonctions** (carte, messages, agenda, profil, litiges, documents, opérations, revenus…), pas par ce que l'utilisateur veut faire. Une mission est dispersée entre le chat, l'agenda, les QR, la facture et le litige.
- **Trop d'appuis** : 13 pour un particulier depuis la plaquette, au moins 30 pour un prestataire (dont 12 refaits).
- **Trop de formulaires d'un coup** : l'inscription prestataire demande tout avant de donner un compte.
- **Volets et fiches** qui ne se ferment pas : le composant du bas de carte est refait à la main sur chaque écran.
- **Vocabulaire non homogène** : la règle « adresse visible » est dite de trois façons.
- Le design graphique est cohérent. Le problème est la structure, pas les couleurs.

## 2. Ce qui doit différencier PING
Wecasa attribue un prestataire, sans choix. Nextdoor est un réseau de voisinage sans paiement ni preuves. Leboncoin est une petite annonce sans suivi de mission. À vérifier par une veille concurrentielle chiffrée avant de les citer dans un support.
PING peut être le seul à réunir, dans une même app :
1. **le choix** du prestataire sur une carte, en direct (« disponible maintenant », écho radar) ;
2. **des preuves visibles** : pièces contrôlées par PING, assurance renseignée, étoiles et commentaires ;
3. **une mission suivie de bout en bout** : QR avant/après, facture automatique à l'en-tête du prestataire, litige documenté ;
4. **le local** : Côte d'Azur.

## 3. Navigation proposée
- **Barre du bas à 3 entrées** : Carte · Missions · Profil. « Messages » et « Agenda » deviennent des vues dans « Missions », où une mission est une seule carte : statut, chat, QR, facture, avis, litige.
- **Bandeau « Mission en cours »** (comme une course en cours dans une app de transport) sur tous les écrans quand une mission est en route ou sur place : un bouton unique (« Je pars », « Scanner à l'arrivée », « Scanner à la fin »).
- **Suivi de mission en une frise** : Confirmée → En route → Arrivé (QR) → Terminée (QR) → Facture et avis. Une seule action principale par étape.
- Bascule particulier/pro : un sélecteur unique dans le profil et un bouton sur la carte (déjà fait), jamais deux systèmes.

## 4. Inscription et pièces d'identité
- **Un seul écran de compte** : e-mail et mot de passe (ou lien magique). Le rôle est choisi avant, sur la plaquette ou la page d'accueil.
- **Profil progressif** : téléphone et adresse demandés au moment où ils servent (première réservation ou première réponse).
- **Pièce d'identité en un geste** : « Prenez votre pièce en photo », l'appareil photo s'ouvre directement, aperçu, envoi. Statut « en cours de contrôle (sous 24 h) », puis badge. Même écran pour client et prestataire. Gratuit : champ photo natif, contrôle par un administrateur PING.
- **Prestataire** : l'activité se construit par étapes enregistrées (brouillon conservé), le compte est créé avant et non après, une jauge « profil complet 3/5 » remplace les pages séparées de pièces.
- **Entreprise** : le SIRET remplit tout (l'annuaire public des entreprises, gratuit, est déjà branché dans `src/lib/legalLookup.ts`).

## 5. Fiche prestataire (vue client) et recherche
- Photo, nom, **étoiles et nombre d'avis**, badges (identité contrôlée par PING, assurance renseignée, SIRET, nombre de missions), trois derniers commentaires, « à partir de … € ».
- **Passer d'un prestataire à l'autre en glissant** (gauche/droite) sans retourner à la carte, avec bascule carte/liste et filtres rapides (disponible maintenant, prix, note).
- Un bouton collant « Réserver » et « Écrire ».

## 6. Carte « plus friendly » (gratuite)
- **Piste recommandée** : MapLibre GL JS (libre) avec les tuiles vectorielles gratuites d'OpenFreeMap (sans clé, usage commercial permis avec mention de la source ; à vérifier sur leur site avant de brancher). Style personnalisé aux couleurs PING, pastilles à photo et prix, regroupement des points.
- **Raison de changer** : l'app utilise aujourd'hui les tuiles du serveur public d'OpenStreetMap, dont la politique d'usage n'est pas faite pour une app commerciale en production. Risque de blocage.
- Le look « Waze » vient surtout du style (couleurs, arrondis, pastilles, animations) et d'un volet à 3 positions (replié, mi-hauteur, plein) : il règle d'un coup les volets qui ne se ferment pas.

## 7. Prestataire : profil, tarifs, catalogue
- **Un écran « Mon profil »** avec liste de contrôle : identité, assurance, qualification (facultatif), photo, zone. Chaque ligne s'ouvre en une demi-page.
- **Catalogue de prix** : modèles par métier préremplis (ex. ménage 3 h, repassage au panier), activer/désactiver, modifier le prix sur place, choisir forfait/horaire/devis par sélecteur.
- **Qualités et avantages** : pastilles à cocher (ex. produits fournis, expérience…) plutôt que du texte libre.

## 8. Nouveaux services sans programmer
Un **catalogue de services en base** (nom, icône, champs de l'annonce, unités de prix, pièces requises). Ajouter un service devient une ligne de données, pas du code. Aujourd'hui les métiers sont codés dans `src/lib/trades.ts`.

## 9. Faut-il refaire le design des profils ?
**Oui, la structure, pas la charte** : fiche prestataire publique, onboarding prestataire, « Mon entreprise », écran de mission, inscription. Le profil client reste proche de l'existant, avec la rubrique Missions et la jauge de complétude.

## 10. Ajouts de Romain (07/11) à l'audit
Inscription et navigation simples et fluides · chargement de la carte d'identité simple (client et prestataire) · souscription entreprise simple · cartes de prestataires avec éléments validés, étoiles, commentaires · passage simple d'un prestataire à un autre · carte gratuite plus conviviale · fluidité de la réception, de la facture, de la visibilité des prestations en route et du QR · barre de navigation à revoir · simplifier la programmation des prestataires (contrôle d'identité, qualités, assurance, qualification, tarifs, catalogue) pour préparer de nouveaux services.
