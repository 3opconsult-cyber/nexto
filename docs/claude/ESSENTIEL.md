# PING : l'essentiel (chargé à chaque session, moins de 3 Ko)
Romain, fondateur, non développeur : français simple, réponses courtes. « Fait » = vu sur capture ou mesuré en production ; sinon « non vérifié ».
PING = place de marché de services de proximité (ménage, repassage, nettoyage), Côte d'Azur. Prod : nexto-eta.vercel.app. Dépôt : 3opconsult-cyber/nexto. Supabase `wmiawwaxwlvascyflpba` (pas `ahtdevozpbeargnmvzcn`).

## Règles qui ne bougent pas
1. Aucun secret dans un fichier. Aucune suppression sans accord de Romain. Aucun accès admin créé.
2. Données de test reconnaissables (`.invalid`, « QA »), jamais nettoyées sans accord.
3. Prix validé au paramétrage ; seul un litige le rouvre. Commission réglable en base, jamais en dur.
4. Adresse du client visible du prestataire seulement mission confirmée ET payée.
5. Langage déclaratif : jamais « certifié » ni « garanti ». Pas d'emoji (pictogrammes SVG).
6. GPS seulement pour « client absent » et « Je suis en intervention ici ». Séquestre et Urssaf : écrits, ÉTEINTS.
7. Avant de toucher un composant : lister ses utilisateurs ; après : `scripts/e2e/non-regression.sh` (REGRESSIONS.md).
8. Livraison : `npx tsc --noEmit` + `npm run build`, push sur `main`, test en production APRÈS le déploiement (~3 min), de jour (Paris).

## Comment travailler
- Une session = un bloc de travail sur UNE entrée ; plusieurs demandes d'affilée jusqu'à ~60 % de contexte, puis l'état est écrit dans le fichier de l'entrée et on ouvre une nouvelle session. Pas de session pour un détail.
- Début de session : lire `ROUTAGE.md` (ta ligne), le fichier de ton entrée, tes lignes de `A-FAIRE.md`. Rien d'autre sans besoin.
- Détail métier : `REGLES-METIER.md`. Technique : `REGLES-TECH.md`. Qui fait quoi : `ROUTAGE.md`. Un point sans réponse claire : `A-FAIRE.md`, section « À classer ».
- Une information vit dans UN fichier ; les autres y renvoient.
Ancien CLAUDE.md complet (rien n'est supprimé) : `CLAUDE-ancien-2026-11-25.md`, `HISTORIQUE.md`. Contradictions : `A-TRANCHER.md`.
