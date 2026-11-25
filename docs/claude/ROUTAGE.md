# Routage : quel point va dans quelle session (créé le 25/11/2026)
Un point = une seule session. S'il touche plusieurs profils, il va dans la rubrique qui possède le code partagé, avec « voir aussi ». Doute : « À classer » dans `A-FAIRE.md`, avec la question. Les sessions ne se réveillent pas entre elles.

| Le point concerne… | Session | Fichier à lire | Agents rattachés |
|---|---|---|---|
| Dépôt en vrac, remarque, capture, idée | PING · Entrée | ENTREE.md | aucun (classe, ne corrige pas) |
| Carte, réservation, agenda, messages, profil du particulier | PING · Particulier | PROFIL-PARTICULIER.md | produit-ergonomie |
| Demandes autour de soi, Mon entreprise, annonce, tarifs, disponibilités, pièces | PING · Prestataire | PROFIL-PRESTATAIRE.md | produit-ergonomie |
| `/admin`, litiges côté PING, paiements, commission, alertes | PING · Admin | PROFIL-ADMIN.md | recette-tests |
| Style commun, ergonomie, clics, animations, fidélité à la maquette | PING · Design | COMMUN.md (section Design) | gardien-fidelite, critique-ergonomie |
| Règles métier, annulation, litige, heures, adresse, contradictions | PING · Règles métier | REGLES-METIER.md, A-TRANCHER.md | mise-en-relation-paiements |
| Migrations SQL à coller, base, RLS, sondes, données de test à nettoyer | PING · Données SQL | RUBRIQUE-DONNEES-SQL.md | securite-donnees, continuite-reprise |
| Factures : émission, envoi (e-mail, WhatsApp, comptable), virements, commissions, séquestre, CESU, Urssaf | PING · Facturation et paiement | RUBRIQUE-FACTURATION.md | mise-en-relation-paiements, flux-integrations |
| Plaquettes, vidéos, e-mails, prospection, réseaux sociaux | PING · Prospection et communication | RUBRIQUE-PROSPECTION.md | marketing-prospection, creation-materiel, veille-marche |
| Automatisation, crons, registre, plafonds, file d'approbation | PING · Automatisation | AUTOMATISATION.md | flux-integrations, continuite-reprise |
| Sécurité, droits RLS, données personnelles | rubrique Règles métier (voir aussi Admin) | REGLES-TECH.md, DONNEES.md | securite-donnees |
| Architecture, performance, dette de code | rubrique Design (voir aussi toutes) | REGLES-TECH.md | critique-architecture-code, critique-performance-donnees |
| Innovation produit | PING · Entrée puis rubrique concernée | A-FAIRE.md | critique-innovation |

## Si un défaut touche plusieurs profils
- Composant partagé (carte, barre du bas, menu, modale) : session Design, voir aussi les profils qui l'utilisent.
- Calcul d'argent ou règle de mission : Règles métier ou Facturation, voir aussi le profil où il s'affiche.
- Texte ou visuel public : Prospection et communication.

## Agents en parallèle (règles)
Un agent possède une zone de fichiers ; deux agents ne modifient jamais le même fichier. Style commun : Design seulement. Une branche par agent, fusion une par une (`REGRESSIONS.md` règle 7). Journal : ajouter à la fin. État : sa ligne seulement. Test local : un port et un `/tmp/nr-*` propres à chaque agent ; arrêter un serveur par `fuser -k PORT/tcp`, jamais `pkill`.

## Test à blanc (25/11/2026)
- « La pastille de session manque dans l'Agenda » : un seul profil -> PING · Particulier (voir aussi Design).
- « Le bouton Facture ne s'envoie pas par WhatsApp, côté client et côté pro » : plusieurs profils -> PING · Facturation et paiement (code partagé `invoiceShare.ts`), voir aussi Particulier et Prestataire.
- « Le client veut un geste commercial après litige » : pas de réponse claire (règle métier + argent) -> A-FAIRE « À classer » avec la question, puis Règles métier.
