# Audit — arrivée et départ du prestataire, jusqu'à la facture (18/11/2026)

Méthode : relecture du code (`src/app/mission/[id]/**`, `ArrivalProof`, `DepartureBar`, `MissionRecap`, agenda, barres de navigation, `src/lib/arrival.ts`, migrations 013 / 033 / 035) **et** parcours joué sur la prod (Playwright, mobile 390 px, comptes audit).
Captures : `docs/audit-2026-11-07/captures/arrivee/` (01 à 20). Script : `scratchpad/e2e/arrivee/run.mjs`.

**Écrit en base (comptes audit uniquement)** : une mission créée et menée jusqu'au bout,
`transactions.id = 0670b243-b1cd-4cef-8ebf-5259473286e0` (audit.client → audit.pro, forfait 60 € / 2 h incluses / 25 €/h au-delà,
RDV 18/11 10:00, « 2 rue de l Audit, Grasse »). Arrivée par code « client absent », fin par le jeton QR lu par le pro (test du défaut P0-1).
Effets : 3 factures `FACT-2026-00038`, `PING-C-2026-00038`, `PING-V-2026-00038`, leurs 3 lignes `transfer_payments` (à régler), 6 messages système, 1 ligne `arrival_codes`.
Non marquée `fictif` : à supprimer ou marquer si besoin.

---

## 1. Le process actuel, étape par étape

### Prérequis (commun)
Tarif accepté dans le chat (`price_confirmed`) puis le client « Fixe le rendez-vous » (adresse + date/heure) dans le chat. À partir de là, les deux côtés ont la mission dans le chat ; l'agenda montre un bloc dans la grille, qui renvoie au chat.

### A. Client présent (QR)
| # | Prestataire | Client |
|---|---|---|
| 1 | Chat → « Je pars maintenant » → choisir le délai → « Prévenir le client » (**3 appuis**, capt. 05-06) | voit « Arrive dans 15 min » dans le chat (capt. 07) |
| 2 | — | Chat → « Mes codes QR » (**1 appui**, ou Récapitulatif → déplier → « Codes QR », 2 appuis) → écran « Valider l'arrivée » avec le QR (capt. 08) |
| 3 | **Sort de l'application**, ouvre l'appareil photo du téléphone, scanne le QR du client → le navigateur ouvre `/mission/[id]/scan/arrival` (si ce navigateur n'est pas connecté : écran de connexion puis retour) → « Arrivée validée » → « Retour à la conversation » (**~3-4 gestes + changement d'appli**) | l'écran QR se met à jour seul (sondage toutes les 4 s) et affiche le QR de fin (capt. 14) |
| 4 | Intervention : bandeau « Intervention en cours » + chrono (capt. 15) | idem, plus « Un problème ? Signaler avant de valider » |
| 5 | Re-scanne avec l'appareil photo le **QR de fin** sur le téléphone du client → `/scan/complete` → calcul durée / heure entamée / montant → « Sortie validée » + durée (capt. 16) | l'écran QR passe à « Prestation terminée » (« Laisser un avis », « Voir la facture ») |
| 6 | Trigger base : 3 factures | Retour au chat → fenêtre d'avis s'ouvre seule (capt. 18) → Facturation : « Régler par virement », 2 virements, « J'ai fait le virement » (capt. 19) |

### B. Client absent — 3 voies coexistent
- **Voie A, QR laissé sur place** : le client, *avant* l'intervention, ouvre « Codes QR » → « Je ne serai pas sur place » → QR unique, à afficher ou imprimer (A4). Le pro le scanne avec l'appareil photo (`/scan/onsite`, RPC `arrive_with_onsite_token`).
- **Voie B, position + code** (le process voulu par Romain) : pro → « Le client n'est pas là (code de confirmation) » → encart de consentement → « J'accepte » (**2 appuis**, capt. 09) → relevé GPS unique, comparé à l'adresse (300 m + marge) → `/api/arrival` → RPC `request_arrival_code` (6 chiffres, 15 min, 5 essais). Le client voit le code **uniquement** en ouvrant « Codes QR » (encart orange, capt. 11) ; un message système dans le chat lui dit d'y aller (capt. 12). Il le communique au pro (téléphone ? chat ?), qui le tape et « Valider » (**2 gestes**, capt. 10/13). Testé : fonctionne, 0 erreur réseau.
- **Voie C, photo + GPS** : pro → « Client absent ? Valider mon arrivée (photo + GPS) » → « J'accepte » → photo → arrivée enregistrée **sans aucune action du client** (`ArrivalProof.tsx:38-76`).
- **Départ à distance : rien.** Une fois arrivé, le pro n'a aucun bouton de fin (capt. 15 : seul le chrono). Seul le QR de fin, affiché sur le téléphone du client, clôt la mission.

---

## 2. Complet ? Les 4 points voulus

| Point voulu | État | Preuve |
|---|---|---|
| 1. Client sur place : QR arrivée puis départ | **Fait**, mais non sécurisé (le pro lit les jetons, voir P0-1) et sans scanner dans l'appli | `qrcodes/page.tsx:64-92`, `scan/[phase]/page.tsx:58-145`, capt. 08, 14, 16 |
| 2a. À distance, arrivée : GPS du pro puis code au client, transmis au pro | **Partiel** | Code généré et vérifié en base (033 + 035) ; testé OK. Mais : |
| — le code est-il *envoyé* au client ? | **Non, pas activement.** SMS désactivé (`arrival.ts:75-85`, `sendSms` renvoie `off`). Seul canal : l'écran « Codes QR » + un message système. Ce message **ne déclenche pas la pastille Messages** (`028_non_lus.sql:37` exclut `kind='system'`). L'e-mail `notifyOther(txId,'message')` (`ArrivalProof.tsx:97`) est un « nouveau message » générique, sans le code, limité à 1 / 10 min, et seulement si `RESEND_API_KEY` est posée (non vérifiable ici ; comptes `.invalid` ignorés). Pas de notification push. → un client vraiment absent ne sait pas qu'un code l'attend. | capt. 11, 12 |
| — « ou le valide » (le client valide lui-même) | **Absent** : le client ne peut que lire et dicter le code ; pas de bouton « Oui, il est là » | `qrcodes/page.tsx:130-139` |
| 2b. À distance, départ : même logique | **Absent.** Aucune RPC `complete_with_code`, aucun bouton de fin côté pro. Client absent = mission impossible à clôturer honnêtement → pas de facture | `DepartureBar.tsx:156-173`, capt. 15 |
| 3. Accès rapide dans la barre de navigation | **Absent.** Barre du bas = 4 entrées fixes (Carte/Demandes, Messages, Agenda, Profil/Entreprise), rien pour la mission du jour | `BottomTabBar.tsx:37-42` |
| 3. Accès rapide sur le « billet » de mission | **Partiel, client seulement.** Client : bouton « Mes codes QR » sur la carte RDV du chat + « Codes QR » dans le récapitulatif. Pro : rien (pas de « Scanner »). Agenda : bloc dans une grille calendrier, sans bouton, renvoie au chat (et caché par la pop-up d'installation, capt. 02, 04) | `chat/page.tsx:562-566`, `MissionRecap.tsx:236-242`, `agenda/page.tsx:100,112` |
| 4. Fin : durée, heure entamée, factures, virement, avis | **Fait** (testé : 3 factures, virement, avis automatique) avec défauts de libellés (P1-6, P2) | capt. 16, 18, 19, 20 |

---

## 3. Défauts priorisés

### P0 — bloquants (fiabilité / fraude)
1. **Le prestataire peut valider seul l'arrivée ET la fin** (scan QR). Écran : `/mission/[id]/scan/*`. Constaté : le pro lit `qr_arrival_token` et `qr_complete_token` via `select` sur `transactions` (testé : `{arrivee:true, fin:true}`) ; la page de scan compare le jeton **dans le navigateur** (`scan/[phase]/page.tsx:59-63`), puis fait un `update` que le trigger 013 autorise au vendeur. Test : mission clôturée par le pro sans aucun geste du client (capt. 16, « Sortie validée, 0 min »). Attendu : jetons illisibles par le pro, arrivée/fin uniquement via une RPC SECURITY DEFINER qui vérifie le jeton en base (comme `arrive_with_onsite_token`).
2. **Voie C « photo + GPS » = arrivée sans le client.** `ArrivalProof.tsx:54-56` écrit `arrived_at` directement. Une photo de n'importe où suffit. Attendu (process Romain) : toute arrivée à distance passe par le code validé par le client ; la photo devient une pièce jointe facultative, pas une validation.
3. **Départ à distance inexistant.** Client absent → le pro ne peut pas finir → pas de durée, pas de facture (ou alors il triche avec P0-1). Attendu : même mécanisme que l'arrivée (code de fin, ou validation du client en un appui).
4. **Le code n'atteint pas le client.** Pas de SMS, pas de push, pas de pastille (message système exclu des non-lus), e-mail générique optionnel. Le pro reste devant la porte. Attendu : notification qui *porte l'action* (« Votre prestataire est arrivé — Confirmer ») et, à défaut de SMS, au moins une pastille + un bandeau rouge sur toutes les pages du client.

### P1 — importants
5. **Pas de scanner dans l'application** (aucun `getUserMedia`/`BarcodeDetector` dans `src`). Le pro sort de l'appli, et si son navigateur par défaut n'est pas celui de la session (PWA installée), il doit se reconnecter devant le client.
6. **GPS relevé à chaque scan QR normal**, sans consentement (`scan/[phase]/page.tsx:15-21, 87, 139`) : contraire à l'invariant « pas de GPS sauf client absent avec consentement ».
7. **Écran pro trop chargé et dans le mauvais ordre** (capt. 03b) : avant même « Je pars », il voit 3 boutons « client absent » + un lien « J'ai déjà un code » ; la voie normale (scanner le QR du client) n'est qu'une petite phrase grise. Attendu : un seul bouton principal selon l'étape.
8. **Aucun contrôle d'heure** : arrivée validée à 09:18 pour un RDV à 10:00 (test) ; « Je pars » possible des jours avant. Attendu : fenêtre (ex. −30 min / +3 h autour de `scheduled_at`) au moins signalée.
9. **Côté client, pendant que le pro dit « je suis là »**, le chat montre toujours « Arrive dans 15 min » et aucun encart code (capt. 12) : il faut deviner d'aller dans « Codes QR ».
10. **Géocodage silencieux** : si l'adresse n'est pas géocodée (cas du test, `lat/lng` nuls), la comparaison GPS est « non vérifiable » et le code part quand même ; le client lit « position non comparée » sans savoir quoi en faire.
11. **Facture** : « 09:18 — 09:18, **scannés sur place** » alors que l'arrivée s'est faite par code client absent ; « 25,00 € de l'heure » affiché pour un forfait 60 € / 2 h incluses (capt. 19). Le mode d'arrivée (`arrival_method`) n'est pas repris.

### P2 — finitions
12. Titre de l'écran client « Valider l'arrivée » alors que le client ne valide rien (il montre un QR).
13. Bandeau « l'adresse s'affiche une fois la mission validée et réglée » affiché au client et au pro même quand c'est déjà le cas (capt. 01, 15).
14. Écran de scan hors design system (fond gris, ✓ texte, pas d'en-tête), ne montre pas le montant final ni « Voir la facture » au pro.
15. Agenda : la pop-up « Installer le raccourci » masque la journée (capt. 02, 04) ; le bloc n'a ni heure de début lisible ni bouton d'action.
16. Fin de mission : le client atterrit sur la fenêtre d'avis (3 notes obligatoires) avant de voir la durée et le montant ; le pro, lui, n'a ni avis proposé ni rappel de sa commission à virer sur l'écran de fin.
17. Le QR « je ne serai pas sur place » doit être généré *avant* par le client : rien ne le lui propose au moment de fixer le RDV.

---

## 4. Process cible (cahier des charges de la maquette)

Principe : **un seul objet « Mission du jour »**, accessible partout en 1 appui, avec **un seul bouton principal** qui change selon l'étape. Toute validation = un jeton vérifié **en base** (RPC), jamais par le pro seul.

### Accès rapide (point 3)
- **Barre du bas** : dès qu'une mission confirmée est dans la fenêtre (J, −2 h → fin), un bouton central rond « Mission » (pictogramme QR / pin) apparaît entre Messages et Agenda, avec pastille d'état ; un appui → écran Mission. Même chose dans `DesktopShell` et `NavDrawer`.
- **Billet de mission** (carte en tête du chat, dans Agenda en liste « Aujourd'hui », et dans Messages) : nom, heure, adresse (pro, si autorisée), statut, et le **bouton principal** de l'étape.

### Côté prestataire (écran Mission)
| Étape | Écran | Bouton principal | Appuis |
|---|---|---|---|
| 1. Départ | Billet + adresse + itinéraire | « Je pars » (délai pré-rempli selon la distance, modifiable) | 1 |
| 2. Sur place | Billet « Vous êtes arrivé ? » | **« Scanner le QR du client »** (scanner intégré) | 1 + scan |
| 2bis. Client absent | lien secondaire « Le client n'est pas là » | consentement + GPS → « Code envoyé au client » → champ 6 chiffres (rempli auto si le client valide lui-même) | 2 + saisie (0 si le client confirme) |
| 3. En cours | Chrono + heure d'arrivée + montant prévu | « Terminer la mission » → scan du QR de fin (client présent) **ou** code de fin (client absent, même mécanique) | 1 + scan/code |
| 4. Fin | Récap : arrivée/départ, durée, heures facturées (heure entamée expliquée : « 2 h 12 → 2 h »), montant, commission, « Vous percevez » | « Voir mes factures » ; secondaire : noter le client, « Commission à virer à PING » | 1 |

### Côté client (écran Mission)
| Étape | Écran | Bouton principal | Appuis |
|---|---|---|---|
| 0. RDV fixé | Billet + « Serez-vous présent ? » Oui / Non (Non → génère le QR à laisser, propose impression) | — | 1 |
| 1. Approche | Compte à rebours | « Afficher mon QR d'arrivée » | 1 |
| 1bis. Absent | Notification **actionnable** (push/SMS/e-mail + bandeau rouge partout) : « Votre prestataire indique être arrivé (position conforme) » | **« Oui, je confirme »** (valide directement, le pro n'a rien à taper) ; secondaire : voir le code à dicter ; « Ce n'est pas normal » → signalement | 1 |
| 2. En cours | Chrono | « Afficher mon QR de fin » ; secondaire « Signaler un problème » | 1 |
| 2bis. Absent | Notification « Le prestataire termine : 2 h 12 sur place → 2 h facturées, 110 € » | « Je confirme la fin » ; secondaire « Contester » | 1 |
| 3. Fin | Récap (durée, heures facturées, montant, frais PING) puis avis **en une note** (détails facultatifs) | « Régler par virement » (IBAN + référence, copier) puis « J'ai fait le virement » | 2-3 |

### Règles techniques à imposer
- Jetons QR et codes **non lisibles par le pro** ; arrivée / fin uniquement via RPC SECURITY DEFINER (`arrive_with_token`, `complete_with_token`, `complete_with_code`), calcul durée/montant **en base** (pas dans le navigateur).
- Supprimer la validation « photo + GPS » seule (photo = pièce jointe facultative).
- GPS : uniquement dans la voie « client absent », après consentement (retirer `gpsNote` du scan normal).
- Délai d'expiration de la fin à distance : si le client ne répond pas sous X h, fin posée « non confirmée » → décision PING (admin), jamais auto-validée.
- Facture : reprendre le mode réel (« scannés sur place » / « confirmés à distance par code »).
