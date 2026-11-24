# Dossier docs/claude : mémoire de travail de PING (créé le 21/11/2026)

Ce dossier remplace la lecture de CLAUDE.md (679 lignes) par des fichiers courts : une ligne par élément, un renvoi
vers le détail. `HISTORIQUE.md` garde CLAUDE.md mot pour mot (rien n'est supprimé). `CLAUDE.index.md` est la future version courte.

## Index
| Fichier | Contenu |
|---|---|
| REGLES-METIER.md | Invariants métier de PING (prix, commission, adresse, GPS, langage) + fichier de code qui les applique |
| REGLES-TECH.md | Règles techniques, règles non négociables (secrets, suppression, autonomie, alertes) |
| ERREURS.md | Incidents réels : symptôme, cause, correction, garde-fou |
| ETAT.md | Parcours : vérifié en production / non vérifié / bloqué, avec date et preuve ; ce que seul Romain peut faire |
| ACCES.md | Ce que Claude peut ou non faire (Vercel, GitHub, Supabase) ; où sont les secrets (jamais leur valeur) |
| JOURNAL.md | Une ligne par jour de livraison depuis le 16/09/2026 |
| CONTROLES.md | Ce qui tourne déjà (crons, tests rejouables) et ce qui est prévu |
| DONNEES.md | Inventaire des données personnelles |
| PLAN-DE-REPRISE.md | Retour arrière code, déploiement, base, secrets ; procédure d'incident |
| A-TRANCHER.md | Contradictions entre documents : Romain décide |
| AMELIORATIONS.md | Carnet d'améliorations (seul l'agent principal y écrit) |
| CIBLES.md | Prospection : renvois |
| DEMANDES.md | Carnet des demandes de Romain (statut et preuve) |
| CONTRAT-MAQUETTE.md (+ -public, -client, -prestataire, -admin) | Contrat de fidélité maquette / application (statuts OK, MANQUE, VOULU, NON VÉRIFIÉ) |
| BRIEF-AGENT.md | Brief donné à tout agent au démarrage (économie de jetons) |
| agents/<nom>/MEMOIRE.md, SOURCES.md | Mémoire et sources de chaque agent (13 agents) |
| HISTORIQUE.md | Copie intégrale de l'ancien CLAUDE.md |
| CLAUDE.index.md | Version courte prévue de CLAUDE.md (Romain la relit avant remplacement) |

Les fiches d'agents sont dans `.claude/agents/<nom>.md`.

## Protocole de mise à jour
1. Une ligne d'état porte toujours « vérifié le JJ/MM/AAAA » et une preuve (commande, test, capture, identifiant de déploiement).
2. Une ligne d'état non vérifiée depuis plus de 60 jours devient « à revérifier ». Au 21/11/2026 : aucune ligne n'a plus de 60 jours.
3. Une information incertaine s'écrit « non vérifié » ou « [à compléter] ». Jamais de valeur inventée.
4. Un agent propose des lignes de mémoire dans son rapport ; seul l'agent principal écrit dans les fichiers de ce dossier.
5. Contradiction trouvée : l'écrire dans A-TRANCHER.md avec fichier et ligne, ne pas choisir à la place de Romain.
6. Après chaque mise en production : une ligne dans JOURNAL.md et mise à jour de ETAT.md si un parcours change.
7. Aucun secret, aucun mot de passe, aucun emoji, jamais « certifié » ni « garanti » dans ces fichiers.
8. Limite : 150 lignes par fichier (120 pour une MEMOIRE d'agent, 40 pour une fiche). Au-delà, scinder et mettre un renvoi.

## Lecture minimale avant toute intervention
README.md (ce fichier), REGLES-METIER.md, REGLES-TECH.md, puis la MEMOIRE de l'agent concerné.
