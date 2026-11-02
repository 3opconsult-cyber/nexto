"""Tutos « après la commande » : réutilisent le décor, Marc et les écrans de brand/anim/src.html.

    python3 brand/anim-tuto/build.py

écrit public/animation-tuto.html (/animation-tuto, 37 s) et public/animation-tuto-absent.html
(/animation-tuto-absent, 30 s). Le SVG (défs, décor, personnage, téléphone avec viseur, coche, chrono,
avis, légende, écran de fin) est extrait de brand/anim/src.html au moment du build : une modification
de l'animation de référence se répercute ici. Seuls la chronologie (parts/tuto.js, parts/absent.js) et
les écrans propres aux tutos (parts/*.svg) sont écrits ici. Polices reprises de brand/anim/fonts.
Même lecteur déterministe PING_ANIM.seek(t) ; boutons masqués avec #record.
Le QR de fin pointe vers /l/ins. MP4 : non produit (voir brand/anim/record.js si besoin)."""
import base64
import pathlib

import segno

HERE = pathlib.Path(__file__).parent
REF = HERE.parent / "anim"
PUB = HERE.parent.parent / "public"
PARTS = HERE / "parts"


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
    return base64.b64encode((REF / "fonts" / name).read_bytes()).decode()


def between(s, a, b):
    i = s.index(a)
    return s[i:s.index(b, i)]


ref = (REF / "src.html").read_text()
fonts = (
    "@font-face{font-family:'Quicksand';font-weight:700;font-display:block;"
    f"src:url(data:font/woff2;base64,{b64('quicksand.woff2')}) format('woff2');}}\n"
    "@font-face{font-family:'Inter';font-weight:100 900;font-display:block;"
    f"src:url(data:font/woff2;base64,{b64('inter.woff2')}) format('woff2');}}"
)
css = between(ref, "<style>", "</style>").replace("<style>", "").replace("%%FONTS%%", fonts)

defs = between(ref, "<defs>", "</defs>") + "</defs>"
world = between(ref, "<!-- MONDE -->", "<!-- notifications")
phone = between(ref, '<rect id="dim" ', '<g id="trust"').rstrip()
assert phone.endswith("</g>")
phone = phone[:-4]  # on rouvre le téléphone pour y ajouter les écrans propres aux tutos
phone = phone.replace('<g transform="translate(68,140) scale(%%QR_SCAN_SCALE%%)">', '<g id="qrg" transform="translate(68,140) scale(%%QR_SCAN_SCALE%%)">', 1)
# textes adaptés au tuto (la mise en page de l'écran « avis » reste celle de la référence)
for old, new in [("Sophie a noté la prestation", "Sophie note Marc"),
                 ("Facture générée automatiquement", "Facture automatique · 3 h × 25 €"),
                 ('>60,00 €<', '>75,00 €<')]:
    assert old in phone, old
    phone = phone.replace(old, new)
tail = ref[ref.index('<g id="who"'):ref.index("</svg>")]

scan, n1 = qr_rects("PING-MISSION-ARRIVEE-7F3K")
end, n2 = qr_rects("https://nexto-eta.vercel.app/l/ins")
head = ('<!doctype html><html lang="fr"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
        '<meta name="robots" content="noindex">')


def part(name):
    return (PARTS / name).read_text()


def make(out, scene, extra_svg, title, aria, eyebrow, h1, lead):
    svg = "\n".join([defs, world, phone, extra_svg, "        </g>", tail])
    layout = (part("layout.html").replace("%%SVG%%", svg).replace("%%ARIA%%", aria)
              .replace("%%EYEBROW%%", eyebrow).replace("%%H1%%", h1).replace("%%LEAD%%", lead))
    script = ("<script>\n(function(){\n" + part("core.js") + part("helpers.js") + part(scene)
              + part("boot.js") + "})();\n</script>")
    html = (f'<meta name="claude:viewport-fit-sides" content="cover">\n<title>{title}</title>\n'
            f"<style>\n{css}\n</style>\n{layout}\n{script}\n")
    html = (html.replace("%%QR_SCAN%%", scan).replace("%%QR_SCAN_SCALE%%", f"{114 / n1:.4f}")
            .replace("%%QR_END%%", end).replace("%%QR_END_SCALE%%", f"{88 / n2:.4f}"))
    (PUB / out).write_text(head + html)
    print("écrit", PUB / out)


make("animation-tuto.html", "tuto.js", part("tuto.svg"), "Tuto PING après la commande",
     "Tutoriel PING : après la commande, le client présente son code QR, le prestataire le scanne à l'arrivée et au départ, "
     "l'heure entamée est due à partir de 10 minutes, puis facture, avis et pourboire.",
     "Tutoriel · 37 s · 9:16", "Après la commande : comment ça se passe",
     "De l'arrivée du prestataire à la facture : un scan à l'arrivée, un scan au départ, tout est enregistré. Un clic sur une scène pour y aller directement.")
make("animation-tuto-absent.html", "absent.js", part("absent.svg"), "Tuto PING client absent",
     "Tutoriel PING : vous ne serez pas là. Le client génère un QR unique laissé sur place que le prestataire scanne ; "
     "sans QR, le prestataire envoie sa position avec accord, l'adresse est comparée et il saisit un code unique envoyé au client.",
     "Tutoriel · 30 s · 9:16", "Vous ne serez pas là ?",
     "Deux façons de valider l'arrivée en votre absence : un QR unique laissé sur place, ou la position du prestataire avec un code unique. Un clic sur une scène pour y aller directement.")
