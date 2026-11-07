# Audit transversal PING (navigation, technique, textes, accessibilité, droits), 07/11/2026

## 1. Verdict
Navigation et structure solides, aucune page en erreur ni vide, mais la finition technique (URL inconnues servies en 200, titres et partage absents, CLS, noms accessibles, contraste du bouton teal) est loin du 10/10.

## 2. Notes /10
| Axe | Note | Justification |
|---|---|---|
| Design | 8 | Cohérent, aucun emoji coloré (seuls ★ ✓ ✕ tolérés), pas de vieux style trouvé sur les 47 routes ouvertes. |
| Ergonomie | 6 | Cibles tactiles < 44 px partout (burger 34, zoom carte 30, « Passer en pro » 38, agenda 31 à 38) ; fenêtre « Installer le raccourci » plein écran sur la carte au premier chargement. |
| Fluidité | 5 | CLS mesurés : /admin 0,36, /aide 0,30 (mode pro), /agenda 0,22, /admin/paiements 0,19, /messages 0,17 ; norme « bon » = 0,1. |
| Compréhension | 7 | « Passer en pro » / « Passer en mode pro » / « Revenir en mode particulier » : trois formulations pour une même action. |
| Fonctionnel | 8 | Bascule, rechargement et retour gardent le mode ; ids invalides gérés proprement (« Mission introuvable »). 404 anglaise sur /menage/paris. |
| Données | 7 | Titres d'onglet identiques partout ; « Vos 0 avis » ; compteur « 9+ » constant (non vérifié en base). |
| Homogénéité des textes | 6 | Mélange ’ / ' / &apos; (≈ 158 courbes, ≈ 160 &apos;, ≈ 30 droites), guillemets droits « "Litiges" » dans le chat, « Bientôt » encore affiché sur 6 écrans. |
| Accessibilité | 4 | Burger sans nom accessible, aucun anneau de focus mesuré sur les champs, blanc sur teal = 2,64:1, texte secondaire #6E8592 = 3,87:1, pas de prefers-reduced-motion global, zoom bloqué (maximum-scale=1). |
| Technique | 5 | URL inconnues = 200 (prototype), robots.txt / sitemap.xml / sw.js = 200 HTML, aucune balise og:, aucun en-tête de sécurité, 404 de chunks Next pendant un déploiement. |

## 3. Écrans parcourus (connecté, mode particulier ET pro, mobile 390x844 ; 360x800 pour le défilement horizontal ; ordinateur 1440 pour la barre latérale)
Plan des routes : 56 pages dans src/app (dont dynamiques). Ouvertes : 1 /map · 2 /messages · 3 /agenda · 4 /client/profil · 5 /client/demandes · 6 /client/demandes/new · 7 /client/avance-immediate · 8 /client/avis · 9 /client/confidentialite · 10 /client/documents · 11 /client/favoris · 12 /client/parrainage · 13 /documents · 14 /litiges · 15 /aide · 16 /support · 17 /comment-ca-marche · 18 /cgu · 19 /confidentialite · 20 /essai · 21 /essai/avis · 22 /hub · 23 /mission/new · 24 /pro/annonce · 25 /pro/attente · 26 /pro/carte · 27 /pro/dashboard · 28 /pro/disponibilites · 29 /pro/documents · 30 /pro/onboarding · 31 /pro/onboarding/documents · 32 /pro/paiements · 33 /pro/revenus · 34 /pro/tarifs · 35 /menage/nice · 36 /auth/login · 37 /auth/signup · 38 /auth/reset · 39 /admin/commission · 40 /admin/paiements · 41 /admin/parcours · 42 /admin/retours · 43 /admin/visites · 44 /bienvenue · 45 /plaquettes · 46 /admin · 47 /zzz-inconnue. Ids invalides : /mission/<id>/chat, /mission/abc/facture, /litiges/xyz, /pro/zzz, /menage/paris. Non ouvertes (id réel nécessaire, lecture seule) : /mission/[id]/qrcodes(/imprimer), /scan/[phase], /aide/[slug], /pro/[id] valide, /litiges/[id] valide.
Résultat : 0 page blanche, 0 erreur console hors cas ci-dessous, 0 requête 4xx/5xx hors cas ci-dessous, aucun défilement horizontal à 360 px (seules des tuiles Leaflet dépassent, normal).

## 4. Bugs
**P1**
1. **URL inconnues servies en 200 avec le prototype « PING — démo »** : /zzz-inconnue, /robots.txt, /sitemap.xml, /sw.js renvoient 200 text/html (curl). Cause : `fallback: /:path* -> /client.html` dans /home/user/nexto/next.config.js. Un vrai visiteur qui se trompe d'URL voit une fausse app à données fictives ; robots/sitemap invalides pour les moteurs. Correctif : supprimer le fallback (ou le limiter à /demo) et ajouter robots.txt, sitemap et une page 404 française.
2. **Aucun nom accessible sur le bouton burger** (`app-burger`, présent sur /map, /messages, /agenda), cause : bouton icône sans aria-label (DemoShell / en-tête). Correctif : aria-label="Ouvrir le menu".
3. **Contraste insuffisant** : texte blanc sur teal #12B39C = 2,64:1 (`.btn` ping-ui.css l.82, « Passer en pro » orange non mesuré) ; teal en texte (`.tab.on`, liens) 2,64:1 ; gris #6E8592 (≈ 25 usages inline) = 3,87:1 ; seuil 4,5:1. Correctif : utiliser --tealD #0C8F7E (≈ 4,1) ou un teal plus sombre pour texte/boutons, et #4E6470 (6,21) à la place de #6E8592.
4. **Pas d'anneau de focus clavier** : sur /auth/login le champ focalisé a outline none et aucune ombre (mesure Playwright), et ping-ui.css ne contient aucun :focus-visible. Correctif : règle globale :focus-visible.
5. **Mise en page qui saute** (CLS) : /admin 0,363 ; /aide 0,295 ; /agenda 0,221 (0,146 en pro) ; /admin/paiements 0,185 ; /messages 0,173 en pro ; /pro/dashboard 0,097 ; /mission/new 0,087 (captures non faites, mesure PerformanceObserver). Cause probable : contenu chargé de façon asynchrone sans réserve de hauteur (squelettes absents). Correctif : hauteurs réservées / squelettes.
6. **Aucune métadonnée de partage et titre unique** : pas de balise og:/twitter (0 trouvée sur /auth/login), le même `<title>` « PING — Et si ce que vous cherchez… » sur les 40 pages de l'app (hors /menage/[ville]). Description du layout dit « paiement sous séquestre » alors que le paiement en ligne est éteint (src/app/layout.tsx l.26). Correctif : metadata par page + og:image.
7. **Zoom désactivé** : viewport maximum-scale=1 (layout.tsx l.45). Mauvais pour la malvoyance. Correctif : retirer maximumScale.
8. **Cibles tactiles < 44 px** (mesure getBoundingClientRect) : burger 34x34, bouton messages 34x34, « Passer en pro » 114x38, zoom +/− 30x30, agenda Précédent/Suivant/Jour/Semaine/Mois 31-38 px de haut, « Retour » 58x20 sur /client/demandes/new et /mission/new, case à cocher 18x18 sur /mission/new, /documents (CSV, Envoyer au comptable : 29 px), « Plus tard » ok. Jusqu'à 33 éléments sous 44 px sur /client/demandes/new. Correctif : min-height 44 px.
9. **Droits : `dispute_messages` sans RLS dans les migrations versionnées** (/home/user/nexto/supabase/migrations/021_fil_de_litige.sql n'est qu'un résumé : pas de `enable row level security` ni de policy, contrairement à son en-tête). Non vérifiable en base (get_advisors refusé : « pas la permission »). Si la prod est identique au fichier, tout utilisateur connecté lirait tous les fils de litige. Correctif : vérifier en base et rendre la migration reproductible. Même remarque pour les tables cœur (transactions, requests, disputes, documents, invoices…), absentes des migrations : l'historique ne permet pas de relire leurs policies.
10. **Droits : lectures publiques larges** : `profiles` policy `profile_public_read USING (true)` (001, ligne 302) ; aucune migration ne la supprime alors que CLAUDE.md dit « RLS self-read strict » (à contrôler en base : si elle existe encore, noms, téléphones chiffrés et colonnes du profil sont lisibles par tout le monde, même anonyme). `provider_slots`, `reviews`, `app_settings` : lecture publique volontaire (app_settings contient ping_iban : voulu). Les anciennes tables 001 (missions, pro_profiles, pro_documents, pro_contacts) ont des policies FOR ALL sans WITH CHECK explicite : fonctionnel mais à revoir.

**P2**
11. **Erreur de chargement pendant un déploiement** (run 1, pas run 2) : /menage/nice : ChunkLoadError 404 sur `app/menage/[ville]/page-ec048cf9400da5d3.js` + React #423, et /auth/login : 404 sur css/29295bd869c202a6.css. Cause probable : déploiement Vercel pendant le parcours (le projet a été mis à jour à ce moment). Un utilisateur connecté pendant un déploiement peut voir une page cassée ; pas de rechargement automatique. Non reproduit au second passage.
12. **Garde de connexion incohérente** : visiteur anonyme sur /pro/dashboard et /litiges va vers /auth/login (sans ?next), alors que /map, /aide, /mission/* vont vers /auth/signup?next=… (AuthGate). Après connexion on perd la destination. Correctif : même cible et ?next partout.
13. **404 par défaut en anglais** (« This page could not be found. ») sur /menage/paris, sans identité PING. Correctif : app/not-found.tsx français.
14. **Fenêtre « Installer le raccourci PING » plein écran dès le premier chargement de /map** (capture transversal-02) : masque la carte, texte « Ouvrez PING dans Safari… » affiché à tous les navigateurs, étapes sans numéros. Correctif : bandeau discret, adapté au navigateur.
15. **Vocabulaire de bascule** : bouton carte « Passer en pro », barre latérale « Passer en mode pro » / « Revenir en mode particulier », libellé de l'onglet « Profil » vs menu « Mon profil », « Entreprise » vs « Mon entreprise », « Demandes » vs « Demandes autour de moi ». Voir tableau.
16. **Typographie** : trois formes d'apostrophe dans le code (’ 158, &apos; 160, ' ≈ 30, ex. DepartureBar.tsx l.185, ProListingPreview.tsx l.63, FeedbackBubble.tsx l.89), guillemets droits dans le chat « "Litiges" » (src/app/mission/[id]/chat/page.tsx l.620). « Vos 0 avis » (/client/avis, mauvais pluriel). Correctif : une seule convention (’), pluriel conditionnel.
17. **« Bientôt » encore visible** (hors séquestre, donc pas interdit) : ClientReviewModal.tsx l.80 (« La notation des clients s'active bientôt (mise à jour de la base en cours) » : message technique visible), pro/disponibilites l.166 (« La réservation par créneau arrive très bientôt » alors que la migration est appliquée depuis le 29/10 : texte obsolète probable), pro/paiements, pro/dashboard, client/profil « Moyens de paiement : Bientôt disponible », client/avance-immediate. Casse la cohérence avec les vidéos qui montrent le séquestre actif.
18. **« Garantie décennale »** (pro/documents l.27) : nom de pièce légitime, pas une promesse ; « garantit » dans comment-ca-marche l.30 est une négation. Aucun « certifié » dans l'UI (src/app/pro/documents « certificat » = attestation de formation). « sans garantie » dans les mentions de la fiche pro : OK. Aucune marque tierce visible dans l'UI (seulement dans des commentaires de code et dans public/admin.html, app.html, client.html, plan-marketing.html, qui sont internes ou prototypes ; app.html est servi sur /demo, accessible publiquement).
19. **Ancienne marque « Nexto »** visible sur /hub (src/app/hub/page.tsx l.68, police Fredoka) : page de dev orpheline volontaire, mais publique ; public/demo-parcours.html, parcours-navigable*.html, animations et planche de marque contiennent aussi « nexto » (non vérifié si texte visible ou seulement l'URL nexto-eta).
20. **Textes de démonstration** : /messages et /agenda affichent « Audit C. », « Audit Pro » (compte du fondateur, données fictives par décision connue), /map affiche une annonce « Audit Pro ». Normal pour ce compte ; à nettoyer avant un lancement (supabase/a_coller/nettoyage_donnees_fictives.sql).
21. **PWA** : manifest.json correct (icônes 192/512, start_url /map, thème), manifest admin séparé OK ; icônes déclarées « any » ET « maskable » sur le même fichier (risque de recadrage de l'icône) ; aucun service worker (pas de mode hors ligne, l'installation « raccourci » n'est qu'un favori) ; en-têtes : cache no-cache sur icônes (rechargées à chaque visite), aucun X-Frame-Options / CSP / nosniff / Referrer-Policy (0 sur 4 en-têtes testés sur /map).
22. **Respect de prefers-reduced-motion** : seulement Modal et LiveMap ; glissements d'onboarding (ob-slide), pulsations (lp, lgpulse, pbhalo), tiroir et carte non couverts. Correctif : @media global dans ping-ui.css.
23. **Retour navigateur** : depuis /pro/carte après la bascule, « précédent » ramène à /map avec le mode resté « pro » (l'écran dépend alors du mode, pas de l'URL), comportement cohérent avec CLAUDE.md mais déroutant. Le rechargement garde bien le mode (localStorage).
24. **Poids** : /map charge ≈ 12 fichiers JS/CSS, plus gros chunks 186 Ko (669) et 173 Ko (fd9d…) bruts (≈ 52 et 54 Ko gzip), polyfills 113 Ko (40 Ko gzip) : acceptable ; le CSS global fait 66 Ko brut. Pas de problème majeur.
25. **Chargement lent simulé** (3G lente 400 ms / 400 kbit/s, CPU x4, mobile) : /auth/login premier affichage 2,4 s, chargement complet 8,1 s ; /bienvenue 1,0 s ; /auth/signup 0,7 s (mesures uniques, variance forte). Écran de connexion de loin le plus lent : portail d'entrée.

## Tableau de vocabulaire (même notion, mots différents)
| Notion | Variantes constatées |
|---|---|
| Passer d'un espace à l'autre | « Passer en pro » (carte), « Passer en mode pro », « Revenir en mode particulier » (sidebar), « Passer en particulier » |
| Prestataire | « prestataire », « professionnel » (comment-ca-marche « Côté professionnel »), « pro », « Entreprise » (onglet) |
| Libellés d'onglet vs titre de page | Profil / Mon profil · Entreprise / Mon entreprise · Demandes / Demandes autour de moi |
| Réclamation | « Litiges » (menu), « réclamations » (sous-titre /litiges, « 2 réclamations ») |
| Fiche de l'offre | « annonce » (pro) / « demande » (client) / « mission » (chat, agenda) / « prestation » (factures) / « réservation » |
| Retour | « ← Retour », « ‹ », « Retour à la carte » |

## Droits (relecture des migrations, lecture seule)
- Tables sans `enable row level security` dans les fichiers : `dispute_messages` (021). Les autres (prospects, partners, commercial_actions) ont leur RLS dans 004 (mon premier balayage l'avait manquée).
- Lectures `USING (true)` : profiles (001), reviews, app_settings, provider_slots (voulu), events insertion anonyme limitée à `user_id is null` (015, correct).
- Accès `anon` : `providers_nearby`, `provider_public_name`, `provider_slots` select, `events` insert : cohérents avec la carte publique.
- Limite : les tables cœur (transactions, requests, disputes, documents, invoices, messages…) n'ont pas leur création dans le dépôt, donc leurs policies actuelles ne sont pas relisibles ; get_advisors Supabase refusé.

## 5. Non vérifié
- RLS réelles en base (get_advisors et lecture SQL refusés/non tentés en écriture ; aucune requête SQL lancée).
- Logs serveur Vercel : get_runtime_errors OK = **0 erreur sur 7 jours** ; get_runtime_logs refusé au-delà de 1 h (plan Hobby).
- Retour arrière sur chaque écran principal avec l'état conservé : testé seulement sur /map, /pro/carte et la barre du bas (sélecteur de barre non trouvé sur 1re tentative).
- Contenu du tiroir burger sur mobile (sélecteur `.drawer` non trouvé à la 1re tentative ; la sidebar ordinateur a bien 4 entrées + Support, identique en mode particulier et pro).
- CLS et cibles tactiles mesurés une seule fois par écran, après 2,5 s ; pas de test avec réseau lent sur les écrans connectés.
- Écrans à identifiant réel (QR, scan, facture, fiche pro valide, litige détaillé) : non ouverts pour ne rien créer.
- Tutoiement : aucune occurrence repérée par recherche dans le code (« tu/ton/tes »), seul le « Salut ! » de /essai est familier.
- Espaces insécables avant ? ! : ; : non audité écran par écran.

Captures : transversal-01-apres-bascule-pro.png, transversal-02-map-particulier-mobile.png (fenêtre d'installation plein écran), transversal-03-desktop-agenda-pro.png.
