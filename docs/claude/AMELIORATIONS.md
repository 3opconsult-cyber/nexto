# Carnet d'améliorations (créé le 21/11/2026)
Seul l'agent principal écrit ici. Les agents critique-* et veille-marche proposent (5 max par passage) dans leur rapport.
Impact et effort : 1 (faible) à 5 (fort). Risque : faible / moyen / élevé. Statut : proposé, accepté, en cours, fait, refusé.
Une ligne « fait » exige une preuve en production ; sinon « fait, non vérifié ».

| id | axe | proposition | preuve | impact | effort | risque | statut | date | agent |
|---|---|---|---|---|---|---|---|---|---|
| A-001 | performance | RPC groupée pour `presence_state` : encore appelé ~7 fois par chargement du chat (3 missions du jour candidates x 2 lectures) | `docs/audit-ergonomie-2026-11-21.md` (défauts restants) | 3 | 3 | moyen (changement en base, SQL collé par Romain) | proposé | 21/11/2026 | principal |
| A-002 | performance | `/pro/documents` lent : 1,3 à 2,0 s avant le contenu, mesurer puis alléger les lectures | même audit, ligne « Documents » | 3 | 2 | faible | proposé | 21/11/2026 | principal |
| A-003 | admin | Deux règles « Prévues » non automatisées : durée sur place < 50 % (remboursement proratisé proposé) et silence du prestataire à 48 h (remboursement intégral) ; à décider puis coder ou retirer | `public/admin.html` lignes 1002-1003 | 3 | 4 | élevé (argent, règle métier : décision de Romain) | proposé | 21/11/2026 | principal |
| A-004 | ergonomie | Confirmation avant « Demander l'intervention de PING » (aujourd'hui 1 appui sans retour) | audit ergonomie 21/11 | 2 | 1 | faible (décision produit 20/11 : 1 appui voulu) | proposé, à trancher | 21/11/2026 | principal |
| A-005 | ergonomie | Bandeau « Report proposé » en tête de page alors que le fil est calé en bas : l'afficher près de la saisie | audit ergonomie 21/11 | 2 | 3 | moyen (mise en page du chat) | proposé | 21/11/2026 | principal |
| A-006 | ergonomie | Litige : le fil répète le texte « paiement bloqué » ; supprimer le doublon | audit ergonomie 21/11 | 1 | 1 | faible | proposé | 21/11/2026 | principal |
| A-007 | recette | Rejouer en réel prestataire absent, clôture sur preuve, expiration (aujourd'hui relus seulement) ; exige clé service ou RDV passé | `ETAT.md` | 4 | 3 | moyen (données de test) | proposé | 21/11/2026 | principal |
| A-008 | recette | Remesurer en production les délais de l'audit du 21/11 (mesurés en local) | audit ergonomie 21/11 | 2 | 1 | faible | proposé | 21/11/2026 | principal |
| A-009 | continuité | Écrire le retour arrière migration par migration pour 052 à 060 (sans exécuter) | `PLAN-DE-REPRISE.md` | 4 | 2 | faible | proposé | 21/11/2026 | principal |
| A-010 | continuité | Créer l'étiquette `prod-2026-11-21` sur 9b4ffc5 | `JOURNAL.md` | 3 | 1 | faible | proposé, accord Romain | 21/11/2026 | principal |
| A-011 | sécurité | Sortir les mots de passe de test de CLAUDE.md et du README `a_coller` (valeurs documentées en clair dans le dépôt) | A-TRANCHER.md (l) | 3 | 1 | faible | proposé, accord Romain | 21/11/2026 | principal |
| A-012 | sécurité | RLS `invoices` : chaque partie peut lire la commission de l'autre par appel API direct ; filtrage seulement applicatif | CLAUDE.md ligne 266 | 2 | 3 | moyen (risque d'affichage cassé) | proposé | 21/11/2026 | principal |
| A-013 | données | Compléter DONNEES.md : durées de conservation et suppression [à compléter] ; registre RGPD | `DONNEES.md` | 4 | 2 | faible (juridique : Romain) | proposé | 21/11/2026 | principal |
| A-014 | contrôles | Contrôle SQL de nuit (prévu phase 2) et contrôles à chaque mise en ligne | `CONTROLES.md` | 4 | 3 | faible | proposé | 21/11/2026 | principal |
| A-015 | flux | Poser les variables Vercel (Resend, clé service, `CRON_SECRET`) puis tester un envoi réel | `ETAT.md` | 4 | 1 | moyen (premier e-mail réel) | proposé, Romain | 21/11/2026 | principal |
| A-016 | produit | Alerte « nouvelle demande près de soi » pour les pros (absente : pas d'infra de cron) | CLAUDE.md, section Notifications | 3 | 3 | moyen | proposé | 21/11/2026 | principal |
| A-017 | produit | Cron des réservations expirées : quotidien sous Vercel Hobby ; passer à `*/15` sur Vercel Pro (pg_cron 10 min existe déjà si l'extension est active) | `vercel.json`, A-TRANCHER.md (f) | 2 | 1 | faible | proposé | 21/11/2026 | principal |
| A-018 | données | Les 4 demandes d'un vrai utilisateur et les données fictives : plan de nettoyage avec accord | `supabase/a_coller/README.md` | 2 | 2 | élevé (suppression : accord requis) | proposé | 21/11/2026 | principal |
| A-019 | recette | Rendre `parcours.mjs` planifiable (il crée une mission à chaque passage : décider d'un motif et d'un nettoyage) | `scripts/e2e/README.md` | 3 | 3 | moyen | proposé | 21/11/2026 | principal |
| A-020 | produit | Parrainage : aucune récompense appliquée, seulement des compteurs | CLAUDE.md, section Parrainage réel | 2 | 3 | moyen (argent) | proposé | 21/11/2026 | principal |
