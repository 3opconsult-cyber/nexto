# HANDOFF NEXTO

Voir le document complet de reprise fourni separement (HANDOFF_NEXTO.md).

## Etat
- Prod: https://nexto-eta.vercel.app (landing + auth en ligne)
- SQL: schema complet applique en prod Supabase
- Bloc 2 (onboarding pro): code, a redeployer via `bash scripts/go.sh TOKEN`

## Stack
Next.js 14 + Supabase + Vercel + Tailwind

## Prochaines etapes
1. Redeployer: `bash scripts/go.sh <VERCEL_TOKEN>`
2. Creer bucket Storage "documents" sur Supabase
3. Connecter Git a Vercel (push auto): https://vercel.com/nextoping/nexto/settings/git
4. Bloc 3: parcours client (carte + filtres + fiche pro + chat securise)

## Workflow autonome
- Claude push le code sur GitHub (auto)
- User lance `bash scripts/go.sh TOKEN` dans Codespaces (Supabase/Vercel bloques depuis le chat)
- Pour autonomie totale: installer Claude Code dans le Codespace

## Backlog
Bloc 3 client | Bloc 4 Stripe escrow | Bloc 5 facturation | Bloc 6 CRM+QR | Bloc 7 admin | Bloc 8 animations | Bloc 9 prod
