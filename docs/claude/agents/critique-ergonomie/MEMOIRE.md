# Mémoire critique-ergonomie (vérifié le 21/11/2026)
## Ce qui est déjà acquis (ne pas reproposer)
- 18 tâches à 10/10 le 19/11 ; 21/11 : fenêtres au-dessus de la barre, cibles 44 px, « Annuler » à 2 appuis, bandeau hors saisie.
- Menu 4 entrées, bascule de mode par le menu, barre du bas sur les pages mission, double confirmation des frais totaux (voulue).
## Déjà au carnet (AMELIORATIONS.md)
- Confirmation avant « Demander PING » (A-004), bandeau report en tête (A-005), doublon « paiement bloqué » (A-006), `presence_state` x7 (A-001), /pro/documents lent (A-002).
## Critères
- Appuis par tâche, cibles >= 44 px, contraste AA, texte clair en français simple, état vide expliqué, pas de `confirm()`, retour possible, adresse jamais exposée trop tôt.
- Public : fondateur non développeur, clients particuliers et prestataires de ménage ; mobile d'abord.
## Limites
- Aucun test en réel du repère « Ici aujourd'hui », de la pièce refusée, de l'absence du prestataire : écrire « non vérifié ».
- Un défaut non reproduit n'est pas une preuve : citer fichier et ligne ou mesure.
## Format d'une proposition
- Une ligne : axe, proposition, preuve (fichier ou mesure), impact 1-5, effort 1-5, risque. Maximum 5 par passage.
- Lecture seule : ne rien écrire dans le code ni dans AMELIORATIONS.md ; l'agent principal décide et consigne.

## Rappels communs
- Règles : docs/claude/REGLES-METIER.md et REGLES-TECH.md. Contradictions : A-TRANCHER.md. Erreurs passées : ERREURS.md.
- Aucun secret, aucune suppression sans accord, aucun accès admin créé, aucune donnée inventée ([à compléter]).
- Seul l'agent principal écrit dans les fichiers de docs/claude ; proposer des lignes de mémoire dans le rapport.
## Appris le 22-23/11/2026 (vérifié le 23/11/2026)
- Passe 1 (21/11) : A-026 à A-029 ; A-027 et A-028 faites. À scruter ensuite : mission/new (appuis), onboarding pro, navigation clavier ; ne pas reproposer sans nouvelle preuve.

## Historique et règles anti-régression (poussé le 24/11/2026 par l'agent principal, à relire à chaque mission)
- Lire AVANT de commencer : docs/claude/REGRESSIONS.md (registre des régressions et 8 règles d'or), docs/claude/ERREURS.md, docs/claude/BRIEF-AGENT.md.
- APRÈS chaque lot : `scripts/e2e/non-regression.sh` (production, A et B avant 17 h Paris) doit être vert ; regarder les captures une par une ; mettre à jour les scripts de test cités par un libellé modifié ; lister qui utilise chaque composant partagé touché.
- Décisions de Romain à respecter : la maquette est la référence ; carte Waze centrale, feuille à 3 états, une ligne en haut ; « Trouver un prestataire » en 4 appuis ; lecture AÉRÉE (>= 20 px entre blocs, texte >= 15 px, cibles >= 44 px, <= 4 bordures au premier écran) ; aucune question déjà tranchée ; « fait » = vu sur capture de la production ; séquestre éteint (vidéos en version virement) ; BAITA EURL émettrice (SIRET 512 026 907 00018, migration 063).
- Pièges propres à ton rôle : tes propositions doivent citer la mesure (espace, taille de texte, cibles, bordures) et non le nombre de mots ; vérifier que la proposition ne retire aucune règle métier visible.
