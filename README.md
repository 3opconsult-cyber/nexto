# Nexto

> *Et si ce que vous cherchez se trouvait juste à côté ?*

Marketplace géolocalisée de services de proximité — plombier, ménage, baby-sitter, jardinage, manutention.

## Stack
- **Next.js 14** App Router
- **Supabase** — Auth + PostgreSQL + PostGIS + Storage
- **Vercel** — Déploiement automatique
- **Tailwind CSS**

## URLs
- Production : https://nexto-eta.vercel.app
- Supabase : https://wmiawwaxwlvascyflpba.supabase.co

## Dev local
```bash
cp .env.example .env.local
# Remplir .env.local avec les clés Supabase
npm install
npm run dev
```

## Déploiement
Push sur `main` → GitHub Actions → Vercel auto-deploy.
