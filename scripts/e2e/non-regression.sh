#!/bin/bash
# Suite de non-régression rejouable sur la production (obligation systématique, 24/11/2026).
# Usage : BASE=https://nexto-eta.vercel.app scripts/e2e/non-regression.sh
# - À lancer APRÈS la fin du déploiement (vérifier le commit dans Vercel) et, pour A et B, avant 17 h à Paris.
# - Écrit un résumé ; sortie 1 si un test est rouge. Mot de passe des comptes audit : lu dans parcours.mjs, jamais recopié.
cd "$(dirname "$0")" || exit 1
export BASE="${BASE:-https://nexto-eta.vercel.app}"
P=$(sed -n 22p parcours.mjs | grep -o "PWD = '[^']*'" | cut -d"'" -f2)
export PWD_AUDIT="$P" AUDIT_PWD="$P"
HEURE=$(TZ=Europe/Paris date +%H)
rouge=0
run() { # nom commande
  echo "== $1"
  if timeout 1800 bash -c "$2" > "/tmp/nr-$1.out" 2>&1 && ! grep -q "^KO" "/tmp/nr-$1.out" && ! grep -qE "^=== [AB] : [0-9]+ OK, [1-9]" "/tmp/nr-$1.out"; then echo "   VERT"; else echo "   ROUGE (voir /tmp/nr-$1.out)"; rouge=1; fi
}
run inscription-erreurs "node inscription-erreurs.mjs"
run parcours-rapide "node parcours-rapide.mjs"
run reservation-etapes "node reservation-etapes.mjs"
run facture-sections "node facture-sections.mjs"
run prestataire-ecrans "node prestataire-ecrans.mjs"
run carte-identite "node carte-identite.mjs"
if [ "$HEURE" -lt 17 ]; then
  run hors-ligne "node hors-ligne.mjs"
  run parcours-A-B "node parcours.mjs"
else
  echo "== hors-ligne et parcours A/B : NON JOUÉS (il est $HEURE h à Paris : plus de créneau le jour même, relancer avant 17 h)"
fi
[ "$rouge" = 0 ] && echo "NON-RÉGRESSION : VERT" || echo "NON-RÉGRESSION : ROUGE"
exit $rouge
