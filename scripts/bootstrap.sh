#!/bin/bash
# NEXTO Bootstrap - lance depuis Codespaces
# Les secrets sont dans .env.local (non commité)
set -e
GREEN='\033[0;32m'; NC='\033[0m'

echo "NEXTO Bootstrap"
echo "==============="

# Verif .env.local
if [ ! -f .env.local ]; then
  echo "Copie .env.local..."
  cp .env.example .env.local
  echo "ATTENTION: remplis .env.local avec tes vraies cles"
fi

npm install
echo -e "${GREEN}OK deps${NC}"

npm run typecheck
echo -e "${GREEN}OK typecheck${NC}"

npm run build
echo -e "${GREEN}OK build${NC}"

npm install -g vercel 2>/dev/null

if [ -z "$VERCEL_TOKEN" ]; then
  echo "Lance: VERCEL_TOKEN=xxx bash scripts/deploy.sh"
else
  vercel deploy --token "$VERCEL_TOKEN" --yes --prod
  echo -e "${GREEN}Deploye!${NC}"
fi
