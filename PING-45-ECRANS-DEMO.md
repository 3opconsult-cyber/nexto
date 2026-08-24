# PING — les 45 écrans validés dans /demo, statut réel au 24/08/2026

Ce document existe pour une seule raison : ne plus jamais redécouvrir par petits bouts ce qui a déjà
été validé. Chaque écran de `/demo` (public/app.html) est listé ici avec son état réel dans l'app.
À mettre à jour à chaque écran construit — c'est la référence unique, pas app.html qu'il faut
regrepper à chaque fois.

Légende : ✅ réel et connecté · ⚠️ partiel ou approche différente assumée · ❌ pas construit

## Côté particulier

| Écran /demo | Titre validé | Statut réel |
|---|---|---|
| v_search | Recherche | ✅ `/map` |
| v_provider | Profil du pro | ✅ `/pro/[id]` |
| v_chat | Conversation | ✅ `/mission/[id]/chat` |
| v_signaler_conv / v_signaler_conv_ok | Signaler cet échange | ✅ bouton "Signaler un problème" dans le chat |
| v_booking | Choisir un créneau | ⚠️ `/mission/new` — réservation immédiate, pas de créneau daté (PING est à la demande, pas planifié) |
| v_pay | Paiement sécurisé | ⚠️ message honnête "paiement en attente de Stripe", aucun réel encaissement |
| v_track | Rendez-vous confirmé | ❌ pas construit — écran léger (mini-carte 2 points + heure), pas du GPS live |
| v_qr / v_qr_depart | Valider arrivée / départ | ✅ `/mission/[id]/scan/[phase]` |
| v_receipt | Prestation terminée | ❌ pas d'écran récap dédié séparé du scan |
| v_review | Laisser un avis | ❌ jamais construit — aucune écriture possible dans `reviews`, trou connu depuis le tout premier audit |
| v_messages | Messages | ✅ `/messages` |
| v_agenda | Mes réservations | ✅ `/agenda` |
| v_profile | Mon profil | ✅ `/client/profil` |
| v_join_pro | Devenir professionnel | ✅ couvert par le bascule du menu → `/pro/onboarding`, pas d'écran d'intro dédié |
| v_revenus | Mes revenus & déclaration | ❌ lié au Cesu, décision encore ouverte |
| v_paymethods | Moyens de paiement | ❌ lié à Stripe |
| v_privacy | Coordonnées & confidentialité | ⚠️ dans Profil, pas d'écran séparé |
| v_myreviews | Avis publiés | ❌ même trou que v_review |
| v_offres / v_offre_new / v_offre_detail | Système d'enchères | ❌ **volontairement pas construit** — contredit le modèle sans enchères qu'on a validé |
| v_litige / v_litige_suivi | Litiges | ✅ `/litiges` (liste) — pas de fiche détail par litige encore |
| v_docview | Visionneuse de document | ❌ pas construit |
| v_assur | Assurance du prestataire | ⚠️ affiché comme badge sur la fiche, pas d'écran dédié |

## Côté prestataire

| Écran /demo | Titre validé | Statut réel |
|---|---|---|
| p_dash | Tableau de bord | ✅ `/pro/dashboard` |
| p_demandes | Demandes | ✅ onglet Missions du dashboard |
| p_agenda | Mon agenda | ✅ `/agenda` (partagé avec le côté client) |
| p_qr | Sur place | ✅ `/mission/[id]/scan/[phase]` (partagé) |
| p_factures | Factures | ✅ onglet Factures du dashboard |
| p_facture | Facture individuelle | ❌ pas de vue facture détaillée — génération réelle de facture toujours pas branchée |
| p_profile | Mon entreprise | ✅ onglet Profil du dashboard |
| p_kyc | Mes pièces | ✅ `/pro/onboarding/documents` |
| p_map / p_offres / p_offre_detail | Système d'enchères côté pro | ❌ **volontairement pas construit**, même raison que côté client |
| p_messages | Messages | ✅ `/messages` (partagé) |
| p_litige | Litige | ✅ `/litiges` |
| p_tarifs | Mes tarifs | ⚠️ affiché dans Profil, pas d'écran dédié avec ajout/suppression de tarifs multiples |
| p_devis | Devis instantané | ⚠️ approche différente assumée — on a construit la modification de tarif en cours de chat plutôt qu'un compositeur de devis formel séparé |
| p_documents | Documents | ⚠️ chevauche p_kyc et p_factures, pas d'écran unique dédié |

## À trancher, pas à deviner

- **Enchères (v_offres / p_offres)** : contredit le modèle validé, jamais construit par choix, pas par oubli.
- **Avis clients** : trou réel et connu, jamais construit.
- **Paiement réel / revenus & déclaration / moyens de paiement** : tout dépend de Stripe, pas encore branché.
- **Devis instantané vs. modification de tarif dans le chat** : deux approches différentes, à choisir si les deux doivent coexister.
