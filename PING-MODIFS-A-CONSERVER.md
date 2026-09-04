# PING — Modifications à conserver lors de la reconstruction depuis /demo

Objectif : reconstruire l'app en reprenant l'UI de `/demo` (public/app.html)
à l'identique, avec un design system partagé, tout en réimplémentant les
modifications fonctionnelles réelles listées ci-dessous. Établi depuis
l'historique git complet de la session (commits a7767ba → 20ccf6b).

---

## A. Corrections de fond en base de données (CRITIQUE — déjà en base, à ne pas casser)

1. **Bug de distance à 0 m corrigé** (`providers_nearby`) — paramètres renommés
   `p_lat`/`p_lng` pour éviter la collision avec les colonnes `lat`/`lng`.
   Sans ça, toutes les distances valaient 0 et le rayon ne filtrait rien.
   Migration déjà appliquée. (commit cc0a4b4)

2. **Fonction `provider_trust_stats`** (security definer) — expose
   `has_identity`, `has_rcpro`, `completed_count` pour une fiche individuelle
   sans exposer les tables documents/transactions protégées par RLS. (fbf33e5)

3. **Confirm email** : compte réel `nikojako@gmail.com` débloqué manuellement.
   ⚠️ Le réglage Supabase Auth « Confirm email » est TOUJOURS ACTIF — à décocher
   dans le dashboard (Authentication → Providers → Email), sinon chaque nouvel
   inscrit reste bloqué.

4. **Dix prestataires de test** entre Vence et Nice, carte corrigée
   (était vide pour tout le monde). (8a0f2e8)

5. **Prospection réelle** branchée sur Supabase, attribution UTM par trigger,
   avis clients avec note recalculée, suivi d'arrivée, trois modèles de
   documents générés par trigger. (2ca674f, aa5eb2e, 250285c)

## B. Fonctionnalités réelles à réimplémenter dans la nouvelle UI

6. **Contact = chat direct, PAS de devis.** `openConversation()` dans
   services.ts : crée/réutilise une transaction `pending` avec le pro au prix
   de base, route vers `/mission/[id]/chat`. Les boutons « Contacter »
   (aperçu carte + fiche) ouvrent le chat. (20ccf6b)

7. **Mécanisme d'offre de prix dans le chat** : bulle « Devis », montant +
   motif + photo, Accepter / Refaire une proposition, recalcul des commissions
   (5 % client / 11 % pro) à l'acceptation. Déjà dans `/mission/[id]/chat`. (52140a1)

8. **Fiche prestataire** : badges identité / assurance RC / crédit d'impôt SAP
   (3 lignes à coche avec sous-titre + statut), compteur de missions réalisées,
   mention place de marché. Données via `provider_trust_stats`. (fbf33e5, 3447dbd)

9. **Page « Mes pièces » prestataire** (`/pro/documents`) : statut réel de
   chaque pièce (identité, RC pro, Kbis, diplôme), remplacement direct sans
   repasser par l'onboarding. (0fe594a)

10. **Parrainage : partage WhatsApp + SMS + Copier** (au lieu du bouton unique). (0fe594a)

11. **Flux QR séquentiel en 2 étapes** (page `/mission/[id]/qrcodes`) : étape 1
    code d'arrivée → sondage transaction → bascule auto étape 2 code de sortie →
    écran de fin. Type Uber. (fd64819)

12. **Bascule client/pro** sur le même compte (menu burger) — la liste doit
    défiler pour que le bouton de bascule reste atteignable. (0844f48)

13. **Burger présent sur toutes les pages de navigation** (chat, fiche, docs,
    facturation, litige, réservation), variante claire pour en-têtes blancs. (5494343)

14. **Trois factures par mission** : facture prestataire (son en-tête) +
    relevé PING-C (5 %) + relevé PING-V (11 %). PING émet des « relevés » tant
    que non immatriculée, jamais une facture à la place du pro. (e8b2c87, 250285c)

15. **Tuiles carte OSM** (pas CARTO qui exige une clé API). (5d0d228)

16. **`/map` forcée en rendu dynamique** (`export const dynamic = 'force-dynamic'`)
    pour éviter le cache statique persistant de Next.js. (660ea16)

17. **Carte : fitBounds** pour cadrer sur user + tous les prestataires. (8c8d7b7)

## C. Outils commerciaux (fichiers statiques public/, à conserver tels quels)

18. `/demo` (app.html, 46 écrans) = **référence maîtresse**, listé dans l'admin.
19. `/demo-parcours` (Vence-Nice, 10 Fictifs), `/parcours-navigable` (réplique
    pro+client), `/presentation` (animation 46 s), `/planche-de-marque`,
    `/maquette-inscription-telephone`, `/landing-particulier`, `/landing-pro`,
    `/comment-ca-marche` — tous reliés dans l'admin → Support commercial.
20. **Table Supports imprimés** : Voir + Télécharger sur chaque ligne
    (fichiers réels dans `public/brand/files/`). (76fd9f6)
21. Kit de marque versionné dans `brand/`, logotype PIN-G source unique
    (`Brand.tsx`). (4ae560d, 011e798)

## D. Évolutions fonctionnelles à produire (PAS encore faites)

22. **TROIS MODES DE TARIFICATION** (demandé, prioritaire) :
    - Forfait fixe — prix unique quelle que soit la durée.
    - Horaire pur — prix/heure sur le temps réel mesuré au scan.
    - Forfait + socle d'heures + heures supp — ex. 150 € (3 h incluses) +
      35 €/h ; 5 h réelles → 150 + 2×35 = 220 €.
    Le prestataire prédéfinit ses prestations et prix ; le client choisit, le
    prix s'affiche direct (pas de négociation forcée). QR arrivée/départ =
    déclencheur du calcul final. Chantier : table `prestations`, écran pro de
    gestion, affichage côté client, calcul dans `/mission/[id]/scan`.

23. **Médiateur de la consommation** (CM2C ou Médicys) à souscrire avant
    lancement — non fait.

24. **Coordonnées légales de PING** dans l'admin → Support commercial (SIRET,
    mentions) — vides, factures affichent « à compléter ».

25. **Stripe** : aucun encaissement réel (assumé pour la phase de test).

---

## Divergences /demo assumées (à garder dans la reconstruction)

- Le chat n'existe qu'une fois une conversation ouverte (pas de messagerie
  libre déconnectée d'une mission) — « Contacter » crée la conversation.
- La vraie carte Leaflet/OSM remplace le dessin schématique SVG de la démo.
- Les codes QR sont des jetons longs, pas des codes courts à 4 chiffres.
