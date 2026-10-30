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
