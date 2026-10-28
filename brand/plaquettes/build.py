"""Plaquettes interactives (5 cibles) : src.html -> public/plaquettes.html (servi sur /plaquettes).

Une page, une plaquette par ancre : #particulier, #pro, #devenir-pro, #entreprises,
#annonceurs. Les QR pointent vers les liens courts /l/pq, /l/pqp, /l/pqd, /l/ent
(table dans src/app/l/[code]/route.ts) ; celui des annonceurs ouvre un email."""
import pathlib
import re

import segno

HERE = pathlib.Path(__file__).parent
OUT = HERE.parent.parent / "public" / "plaquettes.html"
EMAIL = "info@opconsult.co"

STROKE = 'fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"'
PARTS = {
    "%%DEVICE%%": (
        '<svg class="device" viewBox="10 0 100 160" fill="none" stroke-linecap="round" stroke-linejoin="round">'
        '<path d="M24 56 C24 26, 46 12, 68 18 C92 25, 100 50, 82 68 C70 80, 64 86, 64 98" stroke="#fff" stroke-width="14"/>'
        '<circle cx="64" cy="134" r="22" stroke="#12B39C" stroke-width="3" opacity=".7"/>'
        '<circle cx="64" cy="134" r="8" fill="#2FD06E"/></svg>'
    ),
    "%%PICTO_QR%%": (
        f'<svg viewBox="0 0 24 24" {STROKE}><path d="M3 8V4h4M17 4h4v4M21 16v4h-4M7 20H3v-4"/>'
        '<rect x="7.5" y="7.5" width="3.5" height="3.5"/><rect x="13" y="7.5" width="3.5" height="3.5"/>'
        '<rect x="7.5" y="13" width="3.5" height="3.5"/><path d="M13 13h3.5v3.5"/></svg>'
    ),
    "%%PICTO_PINS%%": (
        f'<svg viewBox="0 0 24 24" {STROKE}><path d="M6 12.5S2.5 9.4 2.5 6.8a3.5 3.5 0 0 1 7 0c0 2.6-3.5 5.7-3.5 5.7z"/>'
        '<path d="M18 12.5s-3.5-3.1-3.5-5.7a3.5 3.5 0 0 1 7 0c0 2.6-3.5 5.7-3.5 5.7z"/>'
        '<path d="M12 21.5s-3.5-3.1-3.5-5.7a3.5 3.5 0 0 1 7 0c0 2.6-3.5 5.7-3.5 5.7z"/>'
        '<circle cx="6" cy="6.8" r="1.1"/><circle cx="18" cy="6.8" r="1.1"/><circle cx="12" cy="15.8" r="1.1"/></svg>'
    ),
    "%%PICTO_DOC%%": (
        f'<svg viewBox="0 0 24 24" {STROKE}><path d="M6 2.5h8.5l4 4V21.5H6z"/><path d="M14.5 2.5v4h4"/>'
        '<path d="M9 11.5h6.5M9 15h4.5"/></svg>'
    ),
    "%%NAV%%": (
        '<div class="deck-nav">'
        '<button type="button" class="arrow prev" aria-label="Écran précédent"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg></button>'
        '<div class="dots"></div>'
        '<button type="button" class="arrow next" aria-label="Écran suivant"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg></button>'
        "</div>"
    ),
}


def qr(data):
    return segno.make(data, error="m").svg_inline(dark="#123644", light="#ffffff", border=2, omitsize=True)


html = (HERE / "src.html").read_text().replace("%%EMAIL%%", EMAIL)
for k, v in PARTS.items():
    html = html.replace(k, v)
html = re.sub(r"%%QR:(.+?)%%", lambda m: qr(m.group(1)), html)
assert "%%" not in html, "jeton non remplacé"
OUT.write_text(html)
print("écrit", OUT)
