# Mémoire critique-innovation (vérifié le 21/11/2026)
## Positionnement
- Place de marché de services de proximité (ménage, repassage, nettoyage) sur la Côte d'Azur ; but : réduire le délai besoin-achat, sécuriser (présélection, QR avant/après, séquestre prévu, chat, documentation des litiges).
- Réactivité plutôt qu'exhaustivité (ton de la marque) ; « Simple. Rapide. Juste à côté. ».
## Décisions qui encadrent les idées
- Mono-produit tant que le catalogue n'ouvre pas d'autres services ; décision 07/11 : services extensibles (catalogue en données, tarification et pièces propres à chaque service).
- GPS seulement pour « client absent » et « Je suis en intervention ici » ; pas de suivi en direct. Prix figé après accord. Commission 8 % + 17 % réglable.
- CESU phase 1 : le client gère son crédit d'impôt ; avance immédiate Urssaf prête mais éteinte (docs/cesu-ce-qui-manque.md).
## Déjà construit (ne pas reproposer)
- Réservation par créneau, réservation à accepter, demandes ouvertes avec propositions, arrangement à l'amiable, position d'intervention floutée, parrainage (compteurs), catalogue de services.
## Pistes ouvertes déjà connues
- Alerte « nouvelle demande près de soi » (A-016) ; récompense de parrainage (A-020) ; règles admin « Prévues » (A-003).
## Garde-fous
- Toute idée touchant l'argent, le juridique ou la confiance est marquée « décision de Romain ». Idée sans preuve d'usage : « hypothèse ».
## Format d'une proposition
- Une ligne : axe, proposition, preuve (fichier ou mesure), impact 1-5, effort 1-5, risque. Maximum 5 par passage.
- Lecture seule : ne rien écrire dans le code ni dans AMELIORATIONS.md ; l'agent principal décide et consigne.

## Rappels communs
- Règles : docs/claude/REGLES-METIER.md et REGLES-TECH.md. Contradictions : A-TRANCHER.md. Erreurs passées : ERREURS.md.
- Aucun secret, aucune suppression sans accord, aucun accès admin créé, aucune donnée inventée ([à compléter]).
- Seul l'agent principal écrit dans les fichiers de docs/claude ; proposer des lignes de mémoire dans le rapport.
## Appris le 22-23/11/2026 (vérifié le 23/11/2026)
- Passe 1 (21/11) : A-021 à A-025 (réserver à nouveau, réactivité, récapitulatif hebdo, fin de séjour, photos après intervention). Pré-mortem séquestre : un seul circuit d'argent par mission, contrôle du prestataire avant réservation payée, bac à sable complet, promesse marketing réalignée.

## Historique et règles anti-régression (poussé le 24/11/2026 par l'agent principal, à relire à chaque mission)
- Lire AVANT de commencer : docs/claude/REGRESSIONS.md (registre des régressions et 8 règles d'or), docs/claude/ERREURS.md, docs/claude/BRIEF-AGENT.md.
- APRÈS chaque lot : `scripts/e2e/non-regression.sh` (production, A et B avant 17 h Paris) doit être vert ; regarder les captures une par une ; mettre à jour les scripts de test cités par un libellé modifié ; lister qui utilise chaque composant partagé touché.
- Décisions de Romain à respecter : la maquette est la référence ; carte Waze centrale, feuille à 3 états, une ligne en haut ; « Trouver un prestataire » en 4 appuis ; lecture AÉRÉE (>= 20 px entre blocs, texte >= 15 px, cibles >= 44 px, <= 4 bordures au premier écran) ; aucune question déjà tranchée ; « fait » = vu sur capture de la production ; séquestre éteint (vidéos en version virement) ; BAITA EURL émettrice (SIRET 512 026 907 00018, migration 063).
- Pièges propres à ton rôle : toute idée qui touche l'argent, le juridique ou l'authentification est une proposition pour Romain, jamais appliquée seule ; ne pas redemander ce qui est tranché (REGRESSIONS.md, ERREURS.md).
