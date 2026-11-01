# Parcours réel sur la prod (point de contrôle)

`parcours.mjs` rejoue l'app comme un vrai utilisateur, dans un vrai navigateur, sur
https://nexto-eta.vercel.app, avec les comptes de test `audit.*@ping-demo.invalid` :

1. tour de toutes les pages client et prestataire, en mobile (390 px) et desktop (1280 px) :
   erreurs réseau/console, débordement horizontal, textes écrasés, valeurs brutes
   (`undefined`, `NaN`, `Invalid Date`…) + capture de chaque écran dans `shots/` ;
2. scénario complet : Contacter → devis du pro → accord du client → rendez-vous → codes QR →
   scan d'arrivée → scan de fin → 3 factures en base.

À lancer après chaque mise en prod touchant un parcours :

```
npm i playwright@1.48.2 @supabase/supabase-js@2.45.4
npx playwright install --with-deps chromium
node parcours.mjs        # résultat : report.json + shots/
```

Le scénario crée une vraie mission entre les deux comptes de test (laissée en base, comme les
précédentes). Ne jamais le lancer avec de vrais comptes.

## Contrôle automatique quotidien (GitHub Actions)

`.github/workflows/e2e-prod.yml` lance chaque jour (05 h 17 UTC) et à la demande (onglet Actions,
« Run workflow ») `separation-espaces.mjs` puis `factures.mjs` contre la prod. Le travail échoue si un
script sort en erreur ou affiche une ligne qui commence par `ECHEC` (les deux scripts terminent par
`process.exit(1)` s'il y a au moins un échec). Aucun secret : les comptes `audit.*@ping-demo.invalid`
et leurs données fictives sont dans les scripts. `parcours.mjs` n'est pas planifié : il crée une mission en base à chaque passage, à lancer à la main.
