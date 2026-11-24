# Mémoire veille-marche (vérifié le 21/11/2026)
## Contexte à garder en tête
- Marché visé : ménage, repassage, nettoyage à la Côte d'Azur. Concurrents déjà comparés dans CLAUDE.md : Wecasa, Airbnb (modèle de commission), TaskRabbit, Uber (annulation), Booking (prix tout compris).
- Commission au 26/10/2026 : 8 % client + 17 % prestataire = 25 %, modèle « partagé » choisi par Romain.
- Aucune marque tierce dans les supports publics : la veille alimente des documents internes seulement.
## Sujets de veille réglementaire
- Avance immédiate du crédit d'impôt (API Tiers de prestation, habilitation, déclaration SAP/NOVA) ; amendements PLF 2026 visant les plateformes de mise en relation avec auto-entrepreneurs (non adoptés à notre connaissance).
- DAC7 (déclaration des revenus de plateforme) ; services à la personne et CESU préfinancé ; RGPD et CNIL ; L34-5 CPCE (prospection par e-mail).
- Statut juridique de PING : SIRET [à compléter] ; PING se présente comme mise en relation, non garante (décision 18/11).
## Méthode
- Chaque proposition : source (adresse, date de consultation), ce que ça change pour PING, impact 1-5, effort 1-5, risque, « à faire valider » si juridique.
- Distinguer fait publié, interprétation, hypothèse. Ne pas reprendre un chiffre sans source.
## Déjà au dossier
- Comparatif des commissions du 26/10 ; plan marketing du 18/11 ; liste CESU du 17/11 (docs/cesu-ce-qui-manque.md).
## Limite
- Aucune veille réalisée dans cette passe : la mémoire ne contient que le contexte.
## Format d'une proposition
- Une ligne : axe, proposition, preuve (fichier ou mesure), impact 1-5, effort 1-5, risque. Maximum 5 par passage.
- Lecture seule : ne rien écrire dans le code ni dans AMELIORATIONS.md ; l'agent principal décide et consigne.

## Rappels communs
- Règles : docs/claude/REGLES-METIER.md et REGLES-TECH.md. Contradictions : A-TRANCHER.md. Erreurs passées : ERREURS.md.
- Aucun secret, aucune suppression sans accord, aucun accès admin créé, aucune donnée inventée ([à compléter]).
- Seul l'agent principal écrit dans les fichiers de docs/claude ; proposer des lignes de mémoire dans le rapport.
## Appris le 22-23/11/2026 (vérifié le 23/11/2026)
- Passe 1 (21/11) : sources secondaires, pages non ouvertes : tout point juridique à faire valider ; à lire en entier : CNIL localisation 2026-06, DPI-DAC7, BOFIP 12/08/2026, DGCCRF mandataire (A-040).

## Historique et règles anti-régression (poussé le 24/11/2026 par l'agent principal, à relire à chaque mission)
- Lire AVANT de commencer : docs/claude/REGRESSIONS.md (registre des régressions et 8 règles d'or), docs/claude/ERREURS.md, docs/claude/BRIEF-AGENT.md.
- APRÈS chaque lot : `scripts/e2e/non-regression.sh` (production, A et B avant 17 h Paris) doit être vert ; regarder les captures une par une ; mettre à jour les scripts de test cités par un libellé modifié ; lister qui utilise chaque composant partagé touché.
- Décisions de Romain à respecter : la maquette est la référence ; carte Waze centrale, feuille à 3 états, une ligne en haut ; « Trouver un prestataire » en 4 appuis ; lecture AÉRÉE (>= 20 px entre blocs, texte >= 15 px, cibles >= 44 px, <= 4 bordures au premier écran) ; aucune question déjà tranchée ; « fait » = vu sur capture de la production ; séquestre éteint (vidéos en version virement) ; BAITA EURL émettrice (SIRET 512 026 907 00018, migration 063).
- Pièges propres à ton rôle : sources citées ; propositions pour Romain uniquement ; ne rien appliquer au code.
