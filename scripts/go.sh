#!/bin/bash
# NEXTO - Script tout-en-un
# Usage: bash scripts/go.sh VERCEL_TOKEN
set -e
G='\033[0;32m'; Y='\033[1;33m'; N='\033[0m'
VT="${1:-$VERCEL_TOKEN}"
if [ -z "$VT" ]; then echo "Usage: bash scripts/go.sh VERCEL_TOKEN"; exit 1; fi

echo -e "${Y}1/4 git pull${N}"; git pull
echo -e "${Y}2/4 npm install${N}"; npm install
echo -e "${Y}3/4 build${N}"; npm run build
echo -e "${Y}4/4 deploy${N}"; npx vercel deploy --token "$VT" --yes --prod
echo -e "${G}TERMINE - https://nexto-eta.vercel.app${N}"
