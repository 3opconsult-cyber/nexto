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
| Fiche du pro en bas de carte avec critères + geste Accepter / Refuser (maquette v12) | à faire après accord |

## Prestataire
| Point | Statut |
|---|---|
| Adresse de référence dans Disponibilités | à faire |
| D-10 : absence réelle et clôture sur preuve non rejouées | non vérifié |
| GPS précis iPhone, « Masquer » en écriture réelle, remise en ligne sans tarif ni position | non vérifié |
| Filtre anti-contournement sur accroche et présentation de l'annonce (`chatFilter.ts`) | à faire (AUDIT-ANNONCE-CARTE n°2) |
| Publication en un seul parcours de 3 étapes (onboarding + `/pro/annonce`) | à faire après accord sur la maquette v12 |
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
| Litige en offre : offre du client, demande de règlement du pro, 24 h pour refuser sinon accepté ; une seule annonce par pro | à trancher (AUDIT-ANNONCE-CARTE n°6) |

## Facturation et paiement
| Point | Statut |
|---|---|
| Migrations 061, 062, 063 à coller (063 = identité émetteur BAITA EURL) | attend Romain, non vérifié |
| IBAN de PING dans `/admin/paiements` | attend Romain |
| D-19 : séquestre, aucun prestataire de paiement choisi | bloquée |
| CESU : reprendre le branchement (`docs/cesu-ce-qui-manque.md`) | à faire |
| Envoi des factures par e-mail : Resend non posé | attend Romain |

## Données SQL
| Point | Statut |
|---|---|
| URGENT : `providers_nearby` renvoie la position exacte du domicile ; flou 50 m par pro, réglable en base (AUDIT-ANNONCE-CARTE n°1) | à faire, accord Romain sur la valeur (50 m) |
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
Rien pour l'instant.
