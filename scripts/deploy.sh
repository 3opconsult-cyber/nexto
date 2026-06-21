#!/bin/bash
# Usage: bash scripts/deploy.sh VERCEL_TOKEN
set -e
TOKEN=${1:-$VERCEL_TOKEN}
if [ -z "$TOKEN" ]; then echo "Usage: bash scripts/deploy.sh TOKEN"; exit 1; fi
npm run build
npx vercel deploy --token "$TOKEN" --yes --prod
