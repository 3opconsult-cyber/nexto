# NEXTO - Etat livrables

## EN LIGNE (https://nexto-eta.vercel.app)
- / landing + bouton demo
- /demo : parcours complet SANS inscription (8 pros, avis, chat, paiement simule, tracking)
- /auth/login + /auth/signup
- /map : carte temps reel (6 pros live en base)
- /pro/[id] : fiche pro
- /pro/dashboard : KPIs, stripe, premium, kit QR, factures, missions
- /pro/onboarding : 7 etapes tous statuts
- /mission/new + /mission/[id]/chat : demande + chat securise
- /client/profil : historique

## BASE SUPABASE (operationnelle)
- 15 tables, 9 enums, 19 RLS, 4 triggers
- demo_pros (8) + demo_reviews (10) + demo_pros_nearby()
- pro_profiles (6 live) + pros_nearby() corrige
- buckets: documents + avatars

## RESTE A FAIRE
- Bloc 4: Stripe escrow reel (compte a creer)
- Bloc 5: factures PDF
- Bloc 7: admin dashboard
- Bloc 8: animation presentation wow
