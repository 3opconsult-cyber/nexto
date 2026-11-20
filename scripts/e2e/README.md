# Parcours réel sur la prod (point de contrôle)

`parcours.mjs` rejoue l'app comme un vrai utilisateur, dans un vrai navigateur, sur
https://nexto-eta.vercel.app, avec les comptes de test `audit.*@ping-demo.invalid` :

Deux scénarios de bout en bout (19/11/2026, process de commande, migrations 038 et 048) :
- **A, client sur place** : Contacter → devis du pro (forfait 90 € / 3 h / 25 €/h) → accord → rendez-vous
  (adresse du profil confirmée d'office) → « Commande validée » → « Je serai sur place » → Mission du jour →
  Je pars → QR d'arrivée (code lu chez le client, saisi dans le scanner du pro) → QR de fin (`get_mission_proof`,
  écran `/scan/complete`) → 3 factures et montants → mention du mode sur la facture → virement annoncé → avis.
- **B, client absent** : « Je ne serai pas sur place » sur `/mission/[id]/commande` → Je pars → position simulée
  près de l'adresse → photo (`setInputFiles`) envoyée dans la messagerie → « Je confirme » du client → code de fin
  demandé par le pro, envoyé par le client, saisi par le pro → mêmes contrôles.
Chaque étape s'affiche `OK` / `KO`, avec les erreurs console et réseau ; `TOUR=1` ajoute le tour des pages,
`SCEN=A` ou `SCEN=B` n'en joue qu'un. Les missions créées ont une demande titrée « QA parcours … ».

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

## Pièces et position d'intervention (20/11/2026, migrations 057 et 058)

`pieces-position.mjs` : à jouer APRÈS collage de 057 et 058 (sans elles les étapes concernées sont « IGNORE »).
Dépôt d'une pièce par le client et par le prestataire (« Reçu, en cours de traitement »), puis, avec `ADMIN_EMAIL` et
`ADMIN_PASSWORD` : pastille « pièces à valider » sur Conformité, refus de l'assurance avec motif, motif et bouton
« Renvoyer une pièce » côté prestataire, message Support PING reçu. Puis « Je suis en intervention ici » : fenêtre de
consentement (secteur ~500 m, 12 h, jamais l'adresse du client), second repère « Ici aujourd'hui » sur la carte client,
arrêt volontaire, retrait du consentement. Les comptes `.invalid` ne déclenchent aucun e-mail : l'envoi à PING se vérifie
à la main avec un vrai compte (RESEND_API_KEY, ADMIN_NOTIFY_EMAIL).
