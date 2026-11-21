# À TRANCHER : contradictions entre documents (relevé le 21/11/2026)
Romain décide. Les agents ne choisissent pas. Format : constat | où | options. Lignes = `CLAUDE.md` (copie : HISTORIQUE.md) sauf mention.

| id | Constat | Où | Options pour Romain |
|---|---|---|---|
| a | « Plus d'annulation après l'arrivée » (garde 014/027) contre décision 20/11 : annulation possible aux frais totaux + alerte antifraude | l.447, l.663 (« une fois l'arrivée validée : plus d'annulation ») contre l.679 | Confirmer l.679 comme règle ; corriger l.447 et l.663 dans le nouveau CLAUDE.md |
| b | « `held`, `released`, `refunded` JAMAIS posés » contre séquestre écrit qui pose `payment_status='held'` | l.94-95, l.172, l.245 contre l.437, l.451 | Règle exacte à écrire : jamais sur `transactions.status` ; `payment_status` oui, quand le PSP sera allumé |
| c | Taux 5 %/11 % (ex. PING-C 5,50 EUR, PING-V 12,10 EUR) contre 8 % + 17 % | l.252, l.274 contre l.53, l.487 | Marquer 5 %/11 % comme historique du test du 17/09 |
| d | « Séquestre jamais montré actif » contre vidéos et plaquettes qui le montrent actif (décision 03/11), alors que le paiement en ligne est éteint | l.336 contre l.347, l.614-615 ; `docs/plan-marketing-outils.md` §0 point 1 | (a) remettre « bientôt » dans les vidéos ; (b) assumer jusqu'au lancement du séquestre |
| e | « certifié / vérifié / garanti » interdits contre « profil vérifié par PING » autorisé ; Romain a redemandé « certifié » (l.618) | l.71 contre l.620 | Garder l'exception limitée aux pièces `valid` ; décider de « certifié » (juridique) |
| f | Cron « toutes les 15 min » (désactivé) ; crons Vercel quotidiens (Hobby) ; pg_cron de 052 « toutes les 10 min si l'extension est là » ; « cron quotidien » | l.242, l.636 ; `vercel.json` ; `supabase/a_coller/README.md` l.25 | Confirmer en base que `ping_reservations_expirees` existe ; passer à Vercel Pro si besoin de 15 min |
| g | Règle « moi+test@ » citée par la demande pour les comptes de test, introuvable dans le dépôt ; le dépôt utilise `.invalid` | l.597-599 | Dire quelle règle prévaut (adresse réelle de Romain en `+test` ou `.invalid`) ; `.invalid` ne reçoit aucun e-mail |
| h | « RLS `invoices` correcte » contre RLS permissive (chaque partie peut lire la commission de l'autre par appel API) | l.62 contre l.266 | Corriger la RLS (risque d'affichage) ou écrire « filtrage applicatif » dans les invariants |
| i | Autres projets Vercel de l'équipe nextoping sans lien établi avec PING : `jeffrey-crm`, `ca-pilotage-app`, `pilotage-comme-avant`, `ping-demo`, `ping-demo-app`, `ping-auth` | Vercel, 21/11/2026 | Dire lesquels sont à PING, lesquels hors périmètre ; aucun n'est touché |
| j | CGU, CGV, confidentialité PROVISOIRES, à valider juridiquement | l.467, l.495 | Faire valider ; clause « mise en relation » (18/11) |
| k | Règle de travail #1 : push direct sur `main` autorisé ; la mission de la phase 1 dit de ne pas pousser | l.11-23 | Confirmer si la règle #1 reste telle quelle ou si la livraison passe par relecture |
| l | Mots de passe de test écrits en clair dans le dépôt (CLAUDE.md et `supabase/a_coller/README.md` pour les comptes QA) alors que la règle est « aucun secret dans un fichier » | l.226, l.597, l.599 ; README `a_coller` ligne comptes_qa | Les retirer du nouveau CLAUDE.md ; changer ces mots de passe si les comptes servent encore |
| m | Zone floutée « ~2 km » contre grille « ~500 m » (058, e2e README, `requests_nearby`) ; décision 20/11 : 2 km, 12 h | l.74 et l.679 contre l.515 ; `supabase/a_coller/README.md` (058), `scripts/e2e/README.md` | Dire si 2 km est la valeur voulue ; vérifier la grille réelle de 058 (0,005 deg) |
| n | « Mono-produit, rien d'autre » contre décision 07/11 « services extensibles » (catalogue, autres métiers) | l.47 contre l.622 | Réécrire l'invariant : mono-produit tant que le catalogue n'ouvre pas d'autres services |
| o | Litige complet « pas construit » contre construit le 31/10 (dossier `/litiges/[id]`, 021, 030) ; `/welcome` « supprimé » contre `WelcomeCarousel` existant | l.374, l.528 contre l.565 et l.314 contre l.527 | Corriger les sections périmées dans le nouveau CLAUDE.md |
| p | Accès Supabase : « refusé » (02/11), « rétabli » (03/11), « écriture absente » (20/11) | l.605, l.609, l.673 | Confirmer l'état courant (ACCES.md : écriture refusée) |
| q | Heure entamée : « 15 min par défaut » contre réglée à 10 min en base | l.67 contre l.609 | Sans conflit réel ; noter la valeur en base comme référence |
| r | Menu latéral « 4 entrées » contre entrée « Mission » du menu gardée les jours de mission (18/11) | l.36 contre l.629 | Précéder le détail dans le nouveau CLAUDE.md |
| s | Commission annoncée « sans chiffre par écrit » (plan marketing) contre les factures PDF qui affichent le taux appliqué (`tauxLabel`, l.537) | `docs/plan-marketing-outils.md` §0 point 4 | Décider si le taux peut apparaître dans les supports |
| t | Orthographe `info@opconsult.co` « à confirmer » partout | l.325, l.650 | Confirmer l'adresse |
