#!/usr/bin/env python3
"""PING — construit tous les supports de communication.

    python3 build.py            # tout
    python3 build.py flyer      # ce qui contient "flyer"

PDF : weasyprint. PNG : Chromium (visuels écran uniquement).
Ne jamais réintroduire wkhtmltopdf : il casse sur les formats carrés et hauts.
"""
import sys, pathlib, subprocess
from weasyprint import HTML
import kit

HERE = pathlib.Path(__file__).parent
SRC = HERE / "src"
OUT = HERE / "out"

# Liens tracés — un utm_content par support, pour savoir ce qui ramène vraiment.
LINKS = {c: kit.short(c) for c in [
    "fp", "fpr", "af", "ch", "st", "stp", "pp", "ppr", "ig", "igp", "dm",
]}

# fichier source -> (sortie, format)
TARGETS = [
    ("flyer-particulier.html",  "flyer-ping-particulier.pdf",  "pdf"),
    ("flyer-pro.html",          "flyer-ping-pro.pdf",          "pdf"),
    ("affiche-a4.html",         "affiche-ping-a4.pdf",         "pdf"),
    ("chevalet-a5.html",        "chevalet-ping-a5.pdf",        "pdf"),
    ("stickers.html",           "stickers-ping.pdf",           "pdf"),
    ("pitch-particulier.html",  "pitch-ping-particulier.pdf",  "pdf"),
    ("pitch-pro.html",          "pitch-ping-pro.pdf",          "pdf"),
    ("vignettes-campagne.html", "vignettes-campagne-pro.pdf",  "pdf"),
    ("ig-particulier.html",     "ig_post_particulier.png",     "png1080"),
    ("ig-pro.html",             "ig_post_pro.png",             "png1080"),
]


def build(src_name, out_name, fmt):
    src = SRC / src_name
    html = kit.render(src.read_text(encoding="utf-8"), LINKS)
    tmp = OUT / ("." + src_name)
    OUT.mkdir(exist_ok=True)
    tmp.write_text(html, encoding="utf-8")
    dest = OUT / out_name
    if fmt == "pdf":
        # Pas de base_url ici : le fichier temporaire vit dans out/, donc
        # ../print.css et ../tokens.css se résolvent seuls. Forcer base_url
        # sur brand/ cassait silencieusement toute la feuille de style.
        HTML(filename=str(tmp)).write_pdf(str(dest))
    else:
        w = 1080
        subprocess.run(
            [sys.executable, str(HERE / "shoot.py"), str(tmp), str(dest), str(w)],
            check=True, capture_output=True,
        )
    tmp.unlink()
    print(f"  {out_name}  ({dest.stat().st_size // 1024} Ko)")


if __name__ == "__main__":
    filt = sys.argv[1] if len(sys.argv) > 1 else ""
    todo = [t for t in TARGETS if filt in t[0]]
    if not todo:
        print(f"aucun support ne correspond à « {filt} »")
        sys.exit(1)
    print(f"PING — {len(todo)} support(s)")
    for t in todo:
        if (SRC / t[0]).exists():
            build(*t)
        else:
            print(f"  · {t[0]} absent, ignoré")
