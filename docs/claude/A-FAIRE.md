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

## Admin
| Point | Statut |
|---|---|
| Curseur « Décider » (admin.html) en production | poussé, non testé (pas de compte admin de test) |
| D-05 : Décision PING non jouée | non vérifié |
| D-09 : pastille admin pour pièces refusées | non vue |
| D-13 : alertes admin, SQL 062 après 061 | attend Romain |

## Design
| Point | Statut |
|---|---|
| Remesure de fidélité à la maquette avec gardien-fidelite (dernière : 27,4 %) | à faire |
| Pastilles « N RDV » coupées à 390 px, barre du bas | à faire |
| Retirer `ping-legacy.css` | à faire |
| Carte : zoom, bandeau d'icônes, bouton PING (AUDIT-ANNONCE-CARTE n°5) | attend capture, non vérifié |
| Bureau (>= 1000 px) non mesuré sur les derniers lots | non vérifié |

## Règles métier
| Point | Statut |
|---|---|
| A-TRANCHER a à t (dont h : RLS `invoices`, b, d, e, n) | attend Romain |
| TVA : calcul HT/TVA pour un prestataire assujetti | attend Romain |
| GPS du pro pour « arrivée dans X min » (A-TRANCHER u) ; flou 50 m (w) | attend Romain |
| Litige en offre : offre du client, demande de règlement du pro, 24 h pour refuser sinon accepté ; une seule annonce par pro | à trancher (A-TRANCHER v, maquette v14 écrans 5 et 6) ; ajouter : contre-offre, annuler son litige, bandeau « Ouvrir la commande » dans le chat |

## Facturation et paiement
| Point | Statut |
|---|---|
| Migrations 061, 062, 063 à coller (063 = identité émetteur BAITA EURL) | attend Romain, non vérifié |
| IBAN de PING dans `/admin/paiements` | attend Romain |
| D-19 : séquestre, aucun prestataire de paiement choisi | bloquée |
| Facture : « Reçu » pour non immatriculé, HT/TVA/TTC pour assujetti, masquer l'indemnité 40 € pour un client particulier, médiateur, test de la franchise au 01/01/2027 (AUDIT-ANNONCE-CARTE, section facture) | à faire, relecture expert-comptable |
| Coller `065_numerotation_references.sql` (numéros continus, références, vue CRM) après 063 ; brancher le CRM sur `crm_invoices` | écrit et poussé, attend Romain (collage) |
| Facture assujetti : saisie du taux de TVA du prestataire (colonne et champ) pour alimenter `legal.tva_taux` ; l'affichage HT/TVA est prêt | à faire |
| CESU : reprendre le branchement (`docs/cesu-ce-qui-manque.md`) | à faire |
| Envoi des factures par e-mail : Resend non posé | attend Romain |

## Données SQL
| Point | Statut |
|---|---|
| URGENT : coller `064_position_floutee.sql` (flou 50 m) après déploiement ; vérifier la RLS de `provider_profiles` (lat/lng/location lisibles par un client ?) | écrit et poussé, attend Romain (collage) |
| Exposer à la carte : CESU, TVA, crédit d'impôt (n°4) | à faire après le flou |
| Coller 061, 062, 063 dans l'ordre (`supabase/a_coller/README.md`) | attend Romain |
| Nettoyage des données QA (`.invalid`, « QA ») : liste puis accord | attend Romain |
| Resserrer la RLS de `invoices` | décision Romain (A-TRANCHER h) |

## Prospection et communication
| Point | Statut |
|---|---|
| Confirmer `info@opconsult.co` (A-TRANCHER t) | attend Romain |
| Vidéos et plaquettes : séquestre montré actif (A-TRANCHER d) | à réaligner avant lancement |
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
