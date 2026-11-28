# À faire par entrée (créé le 25/11/2026, tenu par la session Entrée)
Une ligne = un point, une seule entrée. Au début de session : lire seulement les lignes de la sienne. Statuts vérifiés au 25/11/2026 sauf « non vérifié ». Décisions de Romain : `A-TRANCHER.md`. Demandes : `DEMANDES.md`.

## Entrée
| Point | Statut |
|---|---|
| D-21 : délai après validation d'arrivée, pas de trace dans le code | question à Romain |

## Particulier
| Point | Statut |
|---|---|
| Pastille de session dans l'Agenda | à faire |
| Alerte « autre espace » (ModeHint) en petit texte dans la ligne d'état de l'agenda | à faire |
| D-17 : « Modifier » sur l'annonce | à faire |
| Carte client sur iPhone réel (Waze, PING, pastille) | attend capture de Romain, non vérifié |
| Fiche du pro en bas de carte avec critères + geste Accepter / Refuser (maquette v14) | à faire après accord |
| Carte : le point « Adresse de référence » tombe au mauvais endroit (géocodage du profil) ; le client ne se voit pas par GPS. Décider si la règle 6 autorise un relevé GPS unique côté client (Romain, 27/11) | à faire, voir Règles métier |
| Rayon de recherche du client : 50 m, 2, 3, 5, 10 km (aujourd'hui 15 km, puis 30 et 60 km si vide) ; proximité d'abord | à faire |
| Alerte du client au PING : être prévenu des prestataires qui peuvent répondre, liste de prestataires potentiels | à concevoir (maquette d'abord) |

## Prestataire
| Point | Statut |
|---|---|
| Adresse de référence dans Disponibilités | à faire |
| D-10 : absence réelle et clôture sur preuve non rejouées | non vérifié |
| GPS précis iPhone, « Masquer » en écriture réelle, remise en ligne sans tarif ni position | non vérifié |
| Filtre anti-contournement sur accroche et présentation de l'annonce | fait dans le code (téléphone, e-mail, suite de chiffres), non vérifié en production ; pas de contrôle côté base |
| Publication en un seul parcours de 3 étapes (onboarding + `/pro/annonce`) | à faire (bloc 3) |
| Résumé d'épingle allégé, bloc Repères de la fiche, bandeau « Ouvrir la commande » dans le chat | fait dans le code (26/11), non vérifié en production |
| Supprimer son annonce (aujourd'hui : masquer seulement) | non vérifié, à faire |
| Métiers : catalogue en familles (Maison, Jardin, Petits travaux, Transport…), un pro = une fiche avec plusieurs métiers ; « Autre » = demande d'ajout avec proposition des métiers proches ; maquette https://claude.ai/artifact/Jt6pH946bhNcYGsdNhhGzk (Romain, 27/11 : pas de multi-rubriques pour l'instant, ménage d'abord) | en attente |
| Retirer le tarif « Sur devis » partout (catalogue `pricing_modes`, tarifs, fiche, réservation) : une prestation, un prix, un paiement (Romain, 27/11) | à faire, voir Règles métier |
| Multi-métiers et nouveaux services : mis de côté (Romain, 28/11), choix dans la liste existante seulement ; à repenser avec le déroulé de mission des petits travaux (moquette, parquet, BA13) | en attente |

## Admin
| Point | Statut |
|---|---|
| Curseur « Décider » (admin.html) en production | poussé, non testé (pas de compte admin de test) |
| D-05 : Décision PING non jouée | non vérifié |
| D-09 : pastille admin pour pièces refusées | non vue |
| D-13 : alertes admin, SQL 062 après 061 | attend Romain |
| File « Nouveaux métiers à valider » (accepter, rattacher, refuser) + liste de mots interdits (Romain, 27/11) | à faire plus tard |
| Pastille rouge « Litige » sur les lignes du CRM : demande de fusion n°7, non testée | attend Romain |

## Design
| Point | Statut |
|---|---|
| Remesure de fidélité à la maquette avec gardien-fidelite (dernière : 27,4 %) | à faire |
| Pastilles « N RDV » coupées à 390 px, barre du bas | à faire |
| Retirer `ping-legacy.css` | à faire |
| Carte : zoom, bandeau d'icônes, bouton PING (AUDIT-ANNONCE-CARTE n°5) | attend capture, non vérifié |
| Bureau (>= 1000 px) non mesuré sur les derniers lots | non vérifié |
| Palette unique (marque, app, admin), `brand/tokens.css` aligné (audit 27/11) | fait dans le code et vu en production sur pages publiques ; admin non vu (pas de compte) |
| Admin : couleurs et boutons de l'application dans `admin.html` (audit 27/11) | fait dans le code, non vérifié à l'écran |
| Couleurs en dur -> variables ; composant carte commun ; ★ ✓ ✕ en SVG (audit 27/11) | à faire |

## Règles métier
| Point | Statut |
|---|---|
| A-TRANCHER a à t (dont h : RLS `invoices`, b, d, e, n) | attend Romain |
| TVA : calcul HT/TVA pour un prestataire assujetti | attend Romain |
| GPS à « Je pars » (A-TRANCHER u) : codé le 27/11, non vérifié sur iPhone ; flou 50 m : 064 à coller | à tester |
| Litige en offre : offre du client, demande de règlement du pro, 24 h pour refuser sinon accepté ; une seule annonce par pro | à trancher (A-TRANCHER v, maquette v14 écrans 5 et 6) ; ajouter : contre-offre, annuler son litige, bandeau « Ouvrir la commande » dans le chat |
| « Sur devis » supprimé (décision Romain 27/11) ; dire si la proposition de tarif dans le chat (réponse à une demande déposée) reste permise | à trancher |
| Missions de dernière minute de type « serveur, job d'été » : salariat, pas prestation indépendante ; risque de requalification, à vérifier avant toute ouverture | à trancher |
| GPS client : relevé unique pour se voir sur la carte ? (règle 6) | à trancher |
| Statut : PING est une place de marché, pas responsable des prestations ; l'auto-entrepreneur facture, entre particuliers c'est à eux (Romain, 28/11) | tranché |
| Mot « DEVIS » sur les billets de proposition de tarif du chat : à renommer si « Sur devis » disparaît (ex. « Proposition de tarif ») | attend réponse de Romain |

## Facturation et paiement
| Point | Statut |
|---|---|
| Migrations 061, 062, 063 à coller (063 = identité émetteur BAITA EURL) | attend Romain, non vérifié |
| IBAN de PING dans `/admin/paiements` | attend Romain |
| D-19 : séquestre, aucun prestataire de paiement choisi | bloquée |
| Séquestre : finir le câblage complet (Romain, 27/11) pour brancher le compte dès son ouverture ; reste éteint en attendant | à faire |
| Facture : « Reçu » pour non immatriculé, HT/TVA/TTC pour assujetti, masquer l'indemnité 40 € pour un client particulier, médiateur, test de la franchise au 01/01/2027 (AUDIT-ANNONCE-CARTE, section facture) | à faire, relecture expert-comptable |
| Coller `065_numerotation_references.sql` (numéros continus, références, vue CRM) après 063 ; brancher le CRM sur `crm_invoices` | écrit et poussé, attend Romain (collage) |
| Taux de TVA du prestataire assujetti : champ (20, 10, 5,5 %) dans l'inscription, codé 28/11 ; coller `067_taux_tva_prestataire.sql` après 065 ; un pro déjà inscrit devra le renseigner (écran de modification à prévoir) | codé, attend Romain (collage), non vérifié |
| CESU : reprendre le branchement (`docs/cesu-ce-qui-manque.md`) | à faire |
| Envoi des factures par e-mail : Resend non posé | attend Romain |
| Une seule facture visible par partie (Romain, 28/11) : le client voit sa prestation (et ses frais de service), le pro voit sa prestation et sa commission ; jamais la commission de l'autre. Récapitulatif du chat filtré (Design, 28/11) ; vérifier la page Facture et « Mes opérations » avec un compte admin qui est aussi client ou pro | à vérifier |

## Données SQL
| Point | Statut |
|---|---|
| URGENT : coller `064_position_floutee.sql` (flou 50 m) après déploiement ; vérifier la RLS de `provider_profiles` (lat/lng/location lisibles par un client ?) | écrit et poussé, attend Romain (collage) |
| Exposer à la carte : CESU, TVA, crédit d'impôt (n°4) | inutile : la fiche les lit déjà (26/11) |
| Coller `066_prestations_realisees.sql` après 065 (nombre de prestations réalisées dans l'aperçu de carte) | écrit et poussé, attend Romain (collage) |
| Coller 061, 062, 063 dans l'ordre (`supabase/a_coller/README.md`) | attend Romain |
| Nettoyage des données QA (`.invalid`, « QA ») : liste puis accord | attend Romain |
| Resserrer la RLS de `invoices` | décision Romain (A-TRANCHER h) |
| Profils de démonstration : remplacer « Fictif N » par prénom + nom suivis de « (fictif) », métiers variés (ménage, repassage, nettoyage de fin de chantier) (Romain, 27/11) | à faire |

## Prospection et communication
| Point | Statut |
|---|---|
| Confirmer `info@opconsult.co` (A-TRANCHER t) | attend Romain |
| Séquestre sur les supports et pages publiques : Romain (27/11) garde « paiement sous séquestre » et ajoute partout « Version pilote : les paiements ne sont pas encore activés » (A-TRANCHER d) | à faire |
| Nouveaux messages (Romain, 27/11). Prestataire : « Soyez visible à chaque fois que vous intervenez quelque part. Captez les clients et les demandes autour de vos interventions. » Particulier : « Trouvez le prestataire le plus proche de chez vous. Réservez en quelques clics. » À poser sur pages d'accueil, plaquettes, vidéos | à faire |
| Règle d'e-mail aux particuliers (RGPD, L34-5) | à trancher |
| Plan 8 semaines (`docs/plan-marketing-outils.md`) | en attente d'accord, rien envoyé |

## Automatisation
| Point | Statut |
|---|---|
| Variables Vercel : RESEND_API_KEY, NOTIFY_FROM, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET (D-18) | attend Romain |
| Autorisation de modifier `deploy.yml` | attend Romain |
| Outil d'envoi, domaine d'e-mail, comptes réseaux, plafonds, validateurs | en attente |

## À classer
- Moyen de paiement (choix du prestataire de paiement, séquestre) et médiateur : session « PING · Paiement et médiation » ouverte le 26/11 (voir D-19, A-TRANCHER).
- Non-régression du 27/11 : « Mission du jour » corrigé (Design, `todayMission.ts`) ; reste le test agenda « À accepter » qui a besoin d'une réservation en attente dans les comptes de test (session Données SQL ou Prestataire : recréer la donnée de test).
