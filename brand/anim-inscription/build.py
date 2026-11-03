"""Animation « Je m'inscris » 40 s : src.html -> public/animation-inscription.html
(servi sur /animation-inscription, ?part=pro démarre à la partie prestataire).

Même principe que brand/anim-pro : vecteur pur, rendu déterministe `PING_ANIM.seek(t)`,
polices reprises de brand/anim/fonts. src.html est l'assemblage de parts/ (en-tête+CSS,
corps SVG, aides, scènes) : modifier parts/ puis `python3 brand/anim-inscription/build.py`
(le script réassemble src.html avant de générer la page).

Vidéo : dans brand/anim-inscription,
`node ../anim/record.js $PWD/../../public/animation-inscription.html` (écrit frames/)
et `ffmpeg -framerate 30 -i frames/%04d.png -c:v libx264 -pix_fmt yuv420p -crf 18
../../public/brand/files/ping-animation-inscription.mp4`. Supprimer frames/ ensuite.
Le QR de fin et celui du scan pointent vers /l/ins (code « inscription » de
src/app/l/[code]/route.ts, redirige vers /auth/signup avec les UTM)."""
import base64
import pathlib

import segno
import sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / "anim"))
import player  # noqa: E402  (lecteur partagé)

HERE = pathlib.Path(__file__).parent
FONTS = HERE.parent / "anim" / "fonts"
OUT = HERE.parent.parent / "public" / "animation-inscription.html"
PARTS = ["a_head.html", "b_body.html", "c_helpers.js", "d_scenes.js"]
QR_URL = "https://nexto-eta.vercel.app/l/ins"  # = kit.short("ins")


def qr_rects(data, fg="#123644"):
    m = segno.make(data, error="m").matrix
    out = []
    for y, row in enumerate(m):
        x = 0
        while x < len(row):
            if row[x]:
                r = 1
                while x + r < len(row) and row[x + r]:
                    r += 1
                out.append(f'<rect x="{x}" y="{y}" width="{r}" height="1" fill="{fg}"/>')
                x += r
            else:
                x += 1
    return "".join(out), len(m)


def b64(name):
    return base64.b64encode((FONTS / name).read_bytes()).decode()


# src.html = assemblage des parties (garde un seul fichier source lisible)
src = "".join((HERE / "parts" / p).read_text() for p in PARTS)
(HERE / "src.html").write_text(src)

end, n = qr_rects(QR_URL)
fonts = (
    "@font-face{font-family:'Quicksand';font-weight:700;font-display:block;"
    f"src:url(data:font/woff2;base64,{b64('quicksand.woff2')}) format('woff2');}}\n"
    "@font-face{font-family:'Inter';font-weight:100 900;font-display:block;"
    f"src:url(data:font/woff2;base64,{b64('inter.woff2')}) format('woff2');}}"
)
html = (
    src.replace("%%FONTS%%", fonts)
    .replace("%%QR_END%%", end).replace("%%QR_END_SCALE%%", f"{172 / n:.4f}")
    .replace("%%QR_N%%", str(n))
)
head = ('<!doctype html><html lang="fr"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
        '<meta name="robots" content="noindex">')
OUT.write_text(head + player.apply(html))
print("écrit", OUT)
