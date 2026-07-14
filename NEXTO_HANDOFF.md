# 🗂️ NEXTO — HANDOFF DE CONTINUITÉ
**Dernière mise à jour : 15 juillet 2026**
Document de passation. À fournir en début de toute nouvelle conversation pour reprendre sans régression ni perte.

---

## 0. COMMENT REPRENDRE (à lire en premier)

Coller ce document en début de conversation, puis dire :
> « Reprends le projet Nexto à partir du handoff. Vérifie l'état, puis on continue. »

L'assistant doit alors :
1. Vérifier les derniers commits GitHub (API)
2. Récupérer `public/app.html` (le prototype vivant)
3. Vérifier le connecteur Supabase MCP (souvent à reconnecter)
4. Attendre l'instruction avant de coder

**⚠️ RÈGLE ABSOLUE : on ne repart JAMAIS de zéro.** Le prototype `public/app.html` (46 écrans, testé au navigateur) est la source de vérité. Toute évolution se fait PAR-DESSUS, jamais en réécrivant tout.

---

## 1. LE PROJET EN UNE PAGE

**Nexto** = un « Google Maps des services de proximité ». Mise en relation directe client ↔ prestataire local (plombier, ménage, baby-sitter, jardinage, manutention…). Zéro intermédiaire filtrant. Modèle Uber/Airbnb/Booking.

**Parcours canonique (identique pour tous les services) :**
Carte → fiche pro (docs vérifiés) → chat + photos → devis → **paiement séquestre (escrow)** → QR arrivée → intervention → QR fin → **délai 24-48h sans réclamation → libération auto** → facture → (litige si besoin).

**Symétrie Airbnb :** un compte = deux casquettes. Client aujourd'hui, prestataire demain. Switch intégré.

**Commission des deux côtés**, répartie et visible sur la facture.

**Tagline :** « Et si ce que vous cherchez se trouvait juste à côté ? »

---

## 2. ACCÈS & TOKENS (CRITIQUE — réutiliser tels quels)

### GitHub (rail principal de push — FONCTIONNE)
- Repo : `3opconsult-cyber/nexto` · branche `main`
- Token : `github_pat_••••(voir handoff privé)`
- **Expiration : 19/09/2026** · push autorisé ✓
- Méthode : API REST `PUT /repos/.../contents/{path}` (récupérer le `sha` avant update)

### Vercel (déploiement auto — FONCTIONNE)
- Org `nextoping` · projet `nexto`
- **Production : https://nexto-eta.vercel.app**
- Auto-deploy à chaque push GitHub. Rien à faire manuellement.
- Token : `vcp_••••(voir handoff privé)`

### Supabase (base — via connecteur MCP, À RECONNECTER)
- Projet `nexto` · Project ID : `wmiawwaxwlvascyflpba` · région eu-west-3 (Paris)
- URL : `https://wmiawwaxwlvascyflpba.supabase.co`
- Publishable key : `sb_publishable_••••`
- Secret key : `sb_secret_••••`
- DB password : `••••(voir handoff privé)`
- **⚠️ Le connecteur MCP renvoie "permission denied" au 15/07 — à réautoriser dans les réglages (org 3opconsult, read-write) avant tout travail base.**

### Stripe (à créer)
- Pas encore de compte. Lien de souscription placé dans le dashboard pro en attendant.
- Dès que dispo : fournir `pk_test_` + `sk_test_` → branchement escrow réel.

### Comptes de test
- Admin : `admin@nexto.app` / `••••`

---

## 3. ARCHITECTURE TECHNIQUE

### Comment c'est déployé (IMPORTANT à comprendre)
Le projet est un dépôt Next.js, MAIS l'app réelle est un **prototype HTML autonome unique** : `public/app.html` (~134 Ko, 46 écrans, tout le CSS/JS inline).

`next.config.js` contient un **rewrite catch-all** qui sert `app.html` sur TOUTES les URLs :
```js
async rewrites() {
  return { beforeFiles: [{ source: '/:path((?!_next/|app\\.html).*)', destination: '/app.html' }] }
}
```
→ Peu importe l'URL tapée (`/`, `/demo`, `/map`…), l'utilisateur voit le prototype. Les anciennes pages Next dans `src/app/` existent encore mais ne sont PLUS servies (le rewrite les court-circuite). Ne pas s'en préoccuper.

### Le fichier vivant : `public/app.html`
- **C'est LUI qu'on modifie.** Tout le reste est secondaire.
- 46 écrans (27 client + 19 pro), design system CSS en haut, moteur JS en bas.
- Structure interne des écrans : `<div id="s-xxx" class="screen">` avec `.tb` (topbar) + `.bd` (corps scrollable, `flex:1; overflow-y:auto`) + `.ft` ou `.nav`.
- Router JS : `go(id)` / `back()` / `show(id)`. Mode preview : `?preview=1`.

### Mode preview (`?preview=1`)
- Barre d'onglets en haut, un onglet par écran, groupés par parcours.
- Switch **👤 Client / 🔧 Pro** filtre les onglets par `MODE`.
- Flèches ← → clavier. Compteur position.
- Neutralise : écritures, redirections auto, popups, timers, service worker.
- **La barre est masquée en production** (sans `?preview=1`).

---

## 4. WORKFLOW DE PRODUCTION (méthode éprouvée)

1. Récupérer `public/app.html` depuis GitHub (API raw)
2. Le modifier localement (Python str_replace ciblés ou reconstruction par blocs concaténés)
3. **TESTER AU NAVIGATEUR** avec Playwright (voir §7) — non négociable
4. Auditer (boutons, cibles, écrans orphelins)
5. Pousser via API GitHub (PUT contents avec sha)
6. Vercel déploie seul (~1-2 min)
7. Demander à l'utilisateur de recharger en `Cmd+Shift+R`

**Pièges connus :**
- Ne jamais utiliser `inset:auto` sur `.screen` en preview → écrase top/bottom/left/right, tue le scroll. (Bug déjà corrigé, ne pas réintroduire.)
- Apostrophes françaises dans les chaînes JS via heredoc bash → utiliser apostrophes typographiques (’).
- GitHub rejette les secrets commités → tokens jamais dans un fichier poussé.
- Le sandbox de l'assistant ET le connecteur MCP peuvent tomber temporairement — réessayer, ce n'est pas lié au projet.

---

## 5. RÉCAP DES TÂCHES — FAIT vs À FAIRE

### ✅ FAIT (ne pas refaire)
- [x] Prototype HTML 46 écrans, design v2 « Airbnb-like », typo lisible (base 16px)
- [x] **Parcours CLIENT complet** : onboarding → arguments → inscription → accueil recherche-first → résultats → carte (en toggle) → ping → fiche pro → annonce inversée (publier + vue pro) → chat + photos → devis → séquestre → 3DS → suivi → QR arrivée → QR fin → délai 24-48h → avis → fonds libérés → facture 2026 → litige + suivi (avec accès assurances du pro)
- [x] **Parcours PRO complet** : accueil pro → statut juridique (SARL/EURL/SAS/SASU/SA/EI/auto-entrepreneur/artisan/CESU/**Particulier P2P**/**Association 3 cas fiscaux**) → identité → entreprise → **documents (CNI, RC Pro, RIB, SIRET, Kbis, décennale, URSSAF, diplômes)** → bibliothèque de prestations (champs libres + devis pré-enregistrés) → vitrine → validation → dashboard (graphiques CA + factures + export PDF comptable) → créer devis depuis catalogue → en route → scan QR → intervention (photos horodatées) → devis supplémentaire → QR fin → paiement → facture auto + facture commission Nexto → litige
- [x] **Mode preview** `?preview=1` responsive (mobile plein écran / desktop colonne 440px), switch Client/Pro, navigation onglets + flèches
- [x] **Bug critique `inset:auto` corrigé** (scroll + clics rétablis) — **testé au navigateur Playwright** : scroll OK, clics OK, switch OK, hauteurs correctes
- [x] Facturation : distinction 2 flux (Nexto→Pro B2B e-invoicing / Pro→Client B2C e-reporting), mentions 2026 (SIREN client, catégorie opération, TVA débits, adresse livraison), numérotation séquentielle, art. 293 B, crédit impôt CESU, P2P hors TVA
- [x] Anti-fuite : nom « Jean M. » avant contrat, docs révélés après, avis 100% mission payée, photos nettoyées (logo/plaque/tel refusés, EXIF supprimés)
- [x] Arguments commerciaux client + pro
- [x] Rewrite catch-all Vercel (toute URL sert le prototype)

### ⬜ À FAIRE (backlog priorisé)
1. **Reconnecter le connecteur Supabase MCP** (permission denied actuellement)
2. **Brancher la base réelle** : le prototype est en données statiques. Câbler Supabase (pros géolocalisés, missions, devis, factures) une fois le design validé définitivement.
3. **Stripe escrow réel** : dès compte créé + clés `pk_test_`/`sk_test_`
4. **Multi-services simultané** dans la recherche (jardinier + maçon + électricien en une requête) — amorcé visuellement, à rendre fonctionnel
5. **Recherche fonctionnelle** (filtres réels sur données)
6. **Notifications** (Web Push / WhatsApp Business pour artisans)
7. Mise en prod finale : domaine custom, tests E2E, monitoring

### 🎨 DÉCISIONS DESIGN ACTÉES
- Carte **en toggle**, PAS en écran permanent. Accueil = recherche-first (Airbnb/Booking).
- Violet en accent, pas en fond permanent. Aéré, cartes avec photo, ombres légères.
- « Pro » partout, jamais « artisan ».
- Typo généreuse (16px base).

---

## 6. RÈGLES MÉTIER VALIDÉES

- Zéro pénalité (Ping : 15 min pour répondre sinon passe au suivant)
- Chips carte = services uniquement (pas Urgent/Programmé)
- Carte : pins visibles au filtrage, ne PAS ouvrir la fiche directement depuis le pin sans intention
- Avis/galeries dynamiques par service
- Facture émise APRÈS paiement + purge litige
- Commission des deux côtés, visible sur facture
- Multi-statuts pro + changement de statut possible + affichage dans la fiche
- Statut P2P (particulier) = transaction hors TVA, « de la main à la main », pas de facture pro
- Association : 3 cas (non lucrative / lucrative accessoire <80 011 € / fiscalisée)
- Documents révélés au client uniquement en cas de litige
- Libération auto des fonds 24-48h après QR fin, sans réclamation
- Pas de Netlify (Vercel uniquement)
- Workflow autonome : assistant pousse GitHub + écrit Supabase ; utilisateur zéro copier-coller (machine trop ancienne pour Claude Code local)

---

## 7. OUTIL DE TEST NAVIGATEUR (à réutiliser — c'est ce qui manquait avant)

Avant tout push, tester réellement le rendu (pas juste la syntaxe) :
```bash
pip install playwright --break-system-packages -q
python3 -m playwright install chromium
# servir le fichier
python3 -m http.server 8099 &
# script Playwright : mesurer hauteur .screen.active, tester scroll (.bd scrollTop),
# cliquer onglets (.pvt), cliquer fiches (.pro), switch (#mb-p/#mb-c)
```
Vérifications minimales : hauteur écran > 400px, `.bd` scrollable, clic onglet change `.screen.active`, switch Pro affiche les onglets pro.

---

## 8. LIENS DE REPRISE

| Ressource | URL |
|---|---|
| **App preview (navigable)** | https://nexto-eta.vercel.app/?preview=1 |
| App production | https://nexto-eta.vercel.app |
| GitHub repo | https://github.com/3opconsult-cyber/nexto |
| Fichier vivant | https://github.com/3opconsult-cyber/nexto/blob/main/public/app.html |
| Vercel déploiements | https://vercel.com/nextoping/nexto/deployments |
| Supabase dashboard | https://supabase.com/dashboard/project/wmiawwaxwlvascyflpba |

---

## 9. ÉTAT DES CONNECTEURS AU 15/07/2026
- GitHub API : ✅ opérationnel (token valide jusqu'au 19/09/2026)
- Vercel auto-deploy : ✅ opérationnel
- Supabase MCP : ⚠️ à reconnecter (permission denied)
- Notion : non configuré à ce jour (demandé — à ajouter si besoin de synchro documentaire)

FIN DU HANDOFF.
