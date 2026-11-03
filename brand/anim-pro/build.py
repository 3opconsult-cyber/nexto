"""Animation prestataires 55 s : src.html -> public/animation-pro.html (servi sur /animation-pro).

Même principe que brand/anim (animation explicative) : vecteur pur, rendu déterministe
`PING_ANIM.seek(t)`, polices embarquées (reprises de brand/anim/fonts).

Vidéo : `python3 brand/anim-pro/build.py` puis, dans brand/anim-pro,
`node ../anim/record.js $PWD/../../public/animation-pro.html` (écrit frames/)
et `ffmpeg -framerate 30 -i frames/%04d.png -c:v libx264 -pix_fmt yuv420p -crf 18
../../public/brand/files/ping-animation-pro.mp4`. Le QR de fin pointe vers /l/pqd
(code « devenir prestataire », redirige vers /landing-pro)."""
import base64
import pathlib

import segno
import sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / "anim"))
import player  # noqa: E402  (lecteur partagé)

HERE = pathlib.Path(__file__).parent
FONTS = HERE.parent / "anim" / "fonts"
OUT = HERE.parent.parent / "public" / "animation-pro.html"


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


scan, n1 = qr_rects("PING-MISSION-ARRIVEE-9Q2L")
end, n2 = qr_rects("https://nexto-eta.vercel.app/l/pqd")
fonts = (
    "@font-face{font-family:'Quicksand';font-weight:700;font-display:block;"
    f"src:url(data:font/woff2;base64,{b64('quicksand.woff2')}) format('woff2');}}\n"
    "@font-face{font-family:'Inter';font-weight:100 900;font-display:block;"
    f"src:url(data:font/woff2;base64,{b64('inter.woff2')}) format('woff2');}}"
)
src = (HERE / "src.html").read_text()
html = (
    src.replace("%%FONTS%%", fonts)
    .replace("%%QR_SCAN%%", scan).replace("%%QR_SCAN_SCALE%%", f"{140 / n1:.4f}")
    .replace("%%QR_END%%", end).replace("%%QR_END_SCALE%%", f"{92 / n2:.4f}")
)
head = ('<!doctype html><html lang="fr"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
        '<meta name="robots" content="noindex">')
OUT.write_text(head + player.apply(html))
print("écrit", OUT)
