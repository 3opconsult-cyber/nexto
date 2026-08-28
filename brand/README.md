# PING — kit de marque

**Ce dossier existe parce que les supports d'une session précédente ont été perdus.**
Ils avaient été produits dans un conteneur temporaire (`/mnt/user-data/outputs/branding/`),
jamais commités : à la session suivante, plus rien. Les sources vivent ici désormais.
Les PDF/PNG de `out/` sont regénérables à tout moment — ce sont les fichiers de `src/`
et de ce dossier qui comptent.

## Régénérer

```bash
cd brand
pip install weasyprint segno --break-system-packages
python3 build.py            # tous les supports → out/
python3 build.py flyer      # seulement ce qui contient "flyer"
```

`weasyprint` pour les PDF, Chromium (`shoot.py`) pour les PNG écran.
**Ne jamais revenir à `wkhtmltopdf`** : il casse sur les formats carrés et hauts.

## Ce que contient le dossier

| Fichier | Rôle |
|---|---|
| `tokens.css` | Couleurs et typo verrouillées. **Source de vérité unique.** |
| `print.css` | Le système de grille. Trois règles, écrites en tête du fichier. |
| `kit.py` | Les briques : logotype, signe, dispositif, QR, liens courts. |
| `build.py` | Le lot complet des supports. |
| `shoot.py` | Rasterisation Chromium (contrôles visuels, visuels réseaux sociaux). |
| `src/*.html` | Un fichier par support. Courts, parce que le CSS fait le travail. |
| `fonts/` | Quicksand + Inter en woff2, embarquées — aucun appel réseau au rendu. |
| `explorations/` | Les pistes explorées, gardées pour ne pas les réexplorer. |

## L'identité, en deux pièces

**Le signe** — anneaux concentriques + point vert. C'est le geste du bouton PING qui
scanne la carte. Il vit dans le carré : favicon, icône PWA, apple-touch, barre d'onglets.
Il survit à 16 px. Déjà déployé, ne pas y toucher.

**Le logotype PIN·G** — le `i` du mot devient l'épingle plantée sur la carte, et son
trou est le point vert. Le message est caché dans le nom lui-même : *PING contient PIN*.
Il vit partout où le nom s'écrit : print, landings, réseaux sociaux, en-têtes.

Ce n'est pas deux logos concurrents : le signe dit l'**action**, le logotype dit la
**promesse**. Ils ne s'utilisent jamais empilés l'un sur l'autre.

**Le dispositif** — un point d'interrogation dont le point est le signe. Ce n'est pas
un logo : c'est l'image de couverture. La question posée au lecteur (« et si c'était
juste à côté ? ») a pour réponse la marque elle-même. Une seule fois par support,
grande, jamais en décoration.

### Pistes explorées et écartées

Voir `explorations/negative-space.html` (rendu : `out/explo-negative-space.png`).
Quatre tentatives, une seule retenue.

- **A — le P qui émet** : les ondes sortant du contrepoinçon tombent dans le cliché wifi.
- **C — le G ouvert** : la lettre se déforme trop pour rester lisible.
- **D — l'onde derrière le mot** : joli, mais ce n'est pas du negative space, c'est un badge.
- **B — PIN·G** : retenu. Le seul dont le message est déjà dans le nom.

## La grille

Trois règles, rappelées en tête de `print.css` :

1. **Une seule marge** (`--M`), identique sur les quatre côtés du support.
2. **Tout aligne à gauche** sur cette marge. Rien n'est centré.
3. **Tout espacement vertical est un multiple de `--U`** (`--M = 2 × --U`).

Corollaires appliqués partout : une seule idée par page, un seul filet par support,
un seul accent chromatique. Le vide n'est pas un manque, c'est le sujet.

## Liens tracés

Les QR ne portent **pas** l'URL complète avec ses UTM : à 120 caractères, le QR devient
trop dense et ne se scanne plus imprimé à 20 mm — constaté en décodant les PDF rendus.
Ils portent un **lien court** `/l/<code>`, résolu par `src/app/l/[code]/route.ts`, qui
redirige en 307 vers la bonne page avec les UTM complets.

| Code | Destination | Support |
|---|---|---|
| `fp` | landing-particulier | flyer A5 particulier |
| `fpr` | landing-pro | flyer A5 pro |
| `af` | landing-particulier | affiche A4 |
| `ch` | landing-particulier | chevalet A5 |
| `st` / `stp` | landing-particulier / -pro | stickers |
| `pp` / `ppr` | comment-ca-marche | présentations |
| `ig` / `igp` | landing-particulier / -pro | posts Instagram |
| `dm` | landing-pro | vignettes de prospection (`?c=<nom>` → `utm_content`) |

**La table des codes est définitive.** On peut changer la cible d'un code ; on ne
supprime jamais un code tant que des supports imprimés circulent. Toute modification
de `route.ts` doit rester synchronisée avec `kit.py`.

Un code inconnu redirige vers `/map` plutôt que d'afficher une erreur : quelqu'un qui
vient de scanner un flyer dans la rue ne doit pas tomber sur un 404.

## Vérifier avant d'imprimer

```bash
python3 build.py
# les QR se décodent-ils vraiment, et vers la bonne destination ?
python3 -c "
import cv2,subprocess,glob
subprocess.run(['pdftoppm','-r','300','-png','out/stickers-ping.pdf','out/_q'])
d=cv2.QRCodeDetector()
for f in glob.glob('out/_q*.png'):
    print(f, d.detectAndDecodeMulti(cv2.imread(f))[1])"
```

Deux pièges déjà payés, à ne pas repayer :

- **QR encre sur fond encre = invisible.** Sur une face sombre, le QR a besoin de sa
  propre réserve blanche : `{{QR code|taille|#123644|#ffffff}}`.
- **SVG inline dans weasyprint** : il l'étale sur la page entière. Toutes les briques
  de `kit.py` passent donc par une image `data:` — ne pas revenir au SVG inline.
