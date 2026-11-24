# Mémoire marketing-prospection (vérifié le 21/11/2026)
## Plan et outils (docs/plan-marketing-outils.md, semaine 1 = 23/11/2026, 8 semaines)
- Lien unique à envoyer : `/bienvenue` (`#particulier`, `#pro`) ; lien court `/l/bv`. E-mails : `/l/epr`, `/l/epr2`, `/l/ecl`, `/l/ecl2`, `/l/eap`, `/l/eac`, `/l/eent`.
- Plaquettes : `/plaquettes#particulier|pro|devenir-pro|entreprises|annonceurs` ; QR `/l/pq`, `/l/pqp`, `/l/pqd`, `/l/ent`. Lien par prospect : `/l/epr?c=epr_nom`.
- 7 modèles d'e-mails dans `public/brand/emails/` ; envoi un par un depuis la boîte de Romain, jamais en masse ; la clé Resend sert aux notifications de mission, pas à la prospection.
## Lire les résultats (admin)
- Prospection : leads entrants et performance par canal (`utm_source`) ; `/admin/parcours` (source de chaque inscrit) ; `/admin/visites` ; Conformité (KYC).
- Limite : un clic sur `/l/<code>` n'est pas compté, ni une visite de pages statiques ; tenir à la main le nombre d'envois.
- Les lignes « exemple » de Campagnes & QR et les campagnes d'exemple sont des illustrations (chiffres non réels).
## Règles légales et de ton
- E-mail commercial à un particulier : accord préalable (L34-5 CPCE). Aux professionnels : permis si lié au métier, avec « répondez stop ».
- Pas de taux de commission par écrit tant qu'il peut bouger (à donner au téléphone) ; 17 % prestataire aujourd'hui, réglable.
- Aucune marque tierce ; jamais « certifié » ni « garanti » ; pas de promesse de paiement en ligne (il est éteint).
- Avant-première : écran bêta de /bienvenue prévient que les paiements ne sont pas réels.
## À trancher avant le premier envoi (A-TRANCHER d, t, s)
- Vidéos qui montrent le séquestre actif ; orthographe de l'adresse de contact ; taux de commission dans les supports.
## État
- Aucun prospect ni envoi réalisé par un agent ; liste des prospects : [à compléter] par Romain (admin Prospection).

## Rappels communs
- Règles : docs/claude/REGLES-METIER.md et REGLES-TECH.md. Contradictions : A-TRANCHER.md. Erreurs passées : ERREURS.md.
- Aucun secret, aucune suppression sans accord, aucun accès admin créé, aucune donnée inventée ([à compléter]).
- Seul l'agent principal écrit dans les fichiers de docs/claude ; proposer des lignes de mémoire dans le rapport.

## Historique et règles anti-régression (poussé le 24/11/2026 par l'agent principal, à relire à chaque mission)
- Lire AVANT de commencer : docs/claude/REGRESSIONS.md (registre des régressions et 8 règles d'or), docs/claude/ERREURS.md, docs/claude/BRIEF-AGENT.md.
- APRÈS chaque lot : `scripts/e2e/non-regression.sh` (production, A et B avant 17 h Paris) doit être vert ; regarder les captures une par une ; mettre à jour les scripts de test cités par un libellé modifié ; lister qui utilise chaque composant partagé touché.
- Décisions de Romain à respecter : la maquette est la référence ; carte Waze centrale, feuille à 3 états, une ligne en haut ; « Trouver un prestataire » en 4 appuis ; lecture AÉRÉE (>= 20 px entre blocs, texte >= 15 px, cibles >= 44 px, <= 4 bordures au premier écran) ; aucune question déjà tranchée ; « fait » = vu sur capture de la production ; séquestre éteint (vidéos en version virement) ; BAITA EURL émettrice (SIRET 512 026 907 00018, migration 063).
- Pièges propres à ton rôle : aucun envoi sans accord ; le séquestre est éteint (ne pas le présenter comme actif) ; jamais « certifié » ni « garanti » ; les vidéos courtes existent en deux versions (avec ou sans séquestre).
