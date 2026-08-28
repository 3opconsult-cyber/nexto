#!/usr/bin/env python3
"""PING — briques de marque partagées par tous les supports.

Aucune brique ne contient de <text> SVG : weasyprint ne le rend pas.
Formes et chemins uniquement. Le logotype est composé en HTML.
"""
import re
import base64
import segno

INK, TEAL, GREEN, PAPER = "#123644", "#12B39C", "#2FD06E", "#F3F6F5"


def _img(svg: str, cls: str, style: str) -> str:
    """weasyprint ne dimensionne pas le SVG inline de façon fiable (il l'étale
    sur la page entière). Passer par une image data: règle le problème une fois
    pour toutes, et Chromium la rend à l'identique."""
    b = base64.b64encode(svg.encode("utf-8")).decode("ascii")
    return f'<img class="{cls}" style="{style}" src="data:image/svg+xml;base64,{b}">'

# Le domaine réel. Pas ping.app (jamais acheté, cassait les liens de prospection).
BASE = "https://nexto-eta.vercel.app"


def short(code: str) -> str:
    """Lien court de campagne. La table des codes vit dans
    src/app/l/[code]/route.ts — les deux doivent rester synchronisées.
    Un QR court reste scannable à 20 mm ; une URL UTM complète, non."""
    return f"{BASE}/l/{code}"


def utm(path: str, source: str, medium: str, campaign: str, content: str = "") -> str:
    q = f"utm_source={source}&utm_medium={medium}&utm_campaign={campaign}"
    if content:
        q += f"&utm_content={content}"
    return f"{BASE}{path}?{q}"


def pin(color=INK, dot=GREEN, h=".855em") -> str:
    """L'épingle qui remplace le i. Son trou est le signal."""
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="71 35 38 65" width="38" height="65">'
        f'<path d="M90 100 C84 84, 71 70, 71 54 a19 19 0 1 1 38 0 c0 16 -13 30 -19 46z" fill="{color}"/>'
        f'<circle cx="90" cy="53" r="8.6" fill="{dot}"/></svg>'
    )
    return _img(svg, "pin", f"height:{h};vertical-align:-.03em")


def mark(size="34pt", color=INK, dot=GREEN) -> str:
    """Le logotype PIN·G, composé en HTML : lettres réelles + épingle."""
    return (
        f'<span class="mark" style="color:{color};font-size:{size}">'
        f"p{pin(color, dot)}ng</span>"
    )


def sign(size="18mm", ring=TEAL, dot=GREEN) -> str:
    """Le signe seul : anneaux concentriques + point. L'icône de l'app."""
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">'
        f'<circle cx="32" cy="32" r="30" fill="none" stroke="{ring}" stroke-width="2" opacity=".26"/>'
        f'<circle cx="32" cy="32" r="19.8" fill="none" stroke="{ring}" stroke-width="2.9" opacity=".55"/>'
        f'<circle cx="32" cy="32" r="7.7" fill="{dot}"/></svg>'
    )
    return _img(svg, "sign", f"width:{size};height:{size}")


def device(h="62mm", hook=INK, ring=TEAL, dot=GREEN) -> str:
    """Le dispositif : un point d'interrogation dont le point est le signe.
    La question posée au lecteur, dont la réponse est la marque elle-même."""
    # viewBox calé au pixel sur l'encre réelle (crochet + anneaux) : le signe
    # s'aligne donc EXACTEMENT sur la marge, sans blanc parasite à gauche.
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="16.5 4.5 77.5 173.5" '
        'width="77.5" height="173.5">'
        f'<path d="M24 56 C24 26, 46 12, 68 18 C92 25, 100 50, 82 68 C70 80, 64 86, 64 98" '
        f'fill="none" stroke="{hook}" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>'
        f'<circle cx="64" cy="148" r="30" fill="none" stroke="{ring}" stroke-width="2" opacity=".3"/>'
        f'<circle cx="64" cy="148" r="19.8" fill="none" stroke="{ring}" stroke-width="2.9" opacity=".6"/>'
        f'<circle cx="64" cy="148" r="7.7" fill="{dot}"/></svg>'
    )
    w = f"calc({h} * 0.447)"
    return _img(svg, "device", f"height:{h};width:{w}")


def qr(url: str, size="22mm", fg=INK, bg=None) -> str:
    """QR réel, en rectangles SVG — lisible par weasyprint, net à l'impression."""
    q = segno.make(url, error="m")
    matrix = [row[:] for row in q.matrix]
    n = len(matrix)
    border = 2
    total = n + border * 2
    rects = []
    if bg:
        rects.append(f'<rect width="{total}" height="{total}" fill="{bg}"/>')
    for y, row in enumerate(matrix):
        x = 0
        while x < n:
            if row[x]:
                run = 1
                while x + run < n and row[x + run]:
                    run += 1
                rects.append(
                    f'<rect x="{x+border}" y="{y+border}" width="{run}" height="1" fill="{fg}"/>'
                )
                x += run
            else:
                x += 1
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {total} {total}" '
        f'width="{total}" height="{total}" shape-rendering="crispEdges">'
        + "".join(rects)
        + "</svg>"
    )
    return _img(svg, "qr", f"width:{size};height:{size}")


# --- moteur de gabarit minuscule : {{MARK ...}} {{SIGN ...}} {{DEVICE ...}} {{QR url|taille}} ---
def render(html: str, ctx: dict | None = None) -> str:
    ctx = ctx or {}

    def sub(m):
        name, _, arg = m.group(1).partition(" ")
        arg = arg.strip()
        parts = [p.strip() for p in arg.split("|")] if arg else []
        if name == "MARK":
            return mark(*parts) if parts else mark()
        if name == "SIGN":
            return sign(*parts) if parts else sign()
        if name == "DEVICE":
            return device(*parts) if parts else device()
        if name == "QR":
            url = ctx.get(parts[0], parts[0]) if parts else BASE
            return qr(url, *(parts[1:] or ["22mm"]))
        if name == "VAR":
            return str(ctx.get(parts[0], ""))
        return m.group(0)

    return re.sub(r"\{\{([^}]+)\}\}", sub, html)
