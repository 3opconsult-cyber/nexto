"""Trois animations à partir des MÊMES scènes (parts/) : « PING en 1 minute » 69 s (public/animation-ping.html, /animation-ping,
conservée mais retirée de l'Admin et de la plaquette), « PING pour les particuliers » (public/animation-client.html,
/animation-client) et « PING pour les prestataires » (public/animation-prestataire.html, /animation-prestataire).
Les deux dernières jouent des tronçons du temps source (VAR.segs dans parts/c2_var_*.js, assemblés par e_split.js).
Pour /animation-ping : Deux boutons HTML sur la dernière scène : /l/ins et /l/insp.

Même principe que brand/anim-pro : vecteur pur, rendu déterministe `PING_ANIM.seek(t)`,
polices reprises de brand/anim/fonts. src.html est l'assemblage de parts/ (en-tête+CSS,
corps SVG, aides, scènes) : modifier parts/ puis `python3 brand/anim-presentation/build.py`
(le script réassemble src.html avant de générer la page).

Vidéo (animation-ping seulement ; les MP4 client / prestataire restent À ENREGISTRER, même procédure) : dans brand/anim-presentation,
`node ../anim/record.js $PWD/../../public/animation-ping.html` (écrit frames/)
et `ffmpeg -framerate 30 -i frames/%04d.png -c:v libx264 -pix_fmt yuv420p -crf 18
../../public/brand/files/ping-animation-ping.mp4`. Supprimer frames/ ensuite.
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
PUB = HERE.parent.parent / "public"
BASE = "https://nexto-eta.vercel.app/l/"


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


ARIA_PING = ("Animation PING en 1 minute : Et si ce que vous cherchez se trouvait juste à côté ? Présentation de l'application (carte, demandes proches, chat avec prix proposé et validé, agenda, facture automatique), tutoriel pour chercher un prestataire ou le devenir, puis les arguments de PING. Le paiement sécurisé sous séquestre est annoncé comme bientôt, en attendant le règlement se fait par virement sur facture.")
CTA_PING = """      <div class="cta-wrap" id="cta">
        <a class="signup-cta" href="/l/ins" target="_blank" rel="noopener">Je cherche un prestataire</a>
        <a class="signup-cta alt" href="/l/insp" target="_blank" rel="noopener">Je suis prestataire</a>
      </div>
      <script>
      (function(){
        var m = /[?&]role=(client|pro)\\b/.exec(location.search), box = document.getElementById('cta');
        var as = box.querySelectorAll('a'), inFrame = window.top !== window;
        if (m){
          as[0].textContent = "Je m'inscris";
          as[0].href = '/bienvenue?role=' + m[1] + '&go=inscription';
          box.removeChild(as[1]);
        }
        if (inFrame) Array.prototype.forEach.call(box.querySelectorAll('a'), function(a){ a.target = '_top'; a.removeAttribute('rel'); });
      })();
      </script>
"""
SIDE_PING = """  <aside class="side" id="side">
    <div class="eyebrow">PING en 1 minute · 69 s · 9:16</div>
    <h1>PING en 1 minute</h1>
    <p class="lead">La vidéo de présentation à envoyer en premier : l'accroche, l'application en cinq écrans, le tutoriel pour chercher un prestataire ou le devenir, puis les arguments. Format vertical, lisible sans le son. Un clic sur une scène pour y aller directement. Deux boutons d'inscription apparaissent sur la dernière scène de cette page (ils ne sont pas dans le fichier MP4, qui montre le QR code).</p>
    <ol class="scenes" id="scenes"></ol>
    <p class="foot">Tout est dessiné en vecteur aux couleurs PING, d'après les vrais écrans de l'app (carte, demandes autour de moi, chat et devis, agenda, facture, inscription, Mon profil, tarifs, disponibilités). Le paiement en ligne sous séquestre est présenté comme « bientôt », jamais comme actif : le règlement se fait aujourd'hui par virement sur facture. Les boutons pointent vers /l/ins (particulier) et /l/insp (prestataire), qui mesurent le trafic venu de cette vidéo.</p>
    <p class="foot"><a href="/brand/files/ping-animation-ping.mp4" target="_blank" rel="noopener">Fichier vidéo MP4 · 1080 × 1920 · 69 s</a> — à publier tel quel.</p>
  </aside>
"""


def cta_one(code):
    # un seul bouton « Je m'inscris » : /l/<code> (suivi), ou l'écran bêta de la plaquette quand ?role= est présent
    role = "client" if code == "ins" else "pro"
    return f"""      <div class="cta-wrap" id="cta">
        <a class="signup-cta" href="/l/{code}" target="_blank" rel="noopener">Je m'inscris</a>
      </div>
      <script>
      (function(){{
        var m = /[?&]role=(client|pro)\\b/.exec(location.search), a = document.querySelector('#cta a');
        if (m) a.href = '/bienvenue?role=' + m[1] + '&go=inscription';
        if (window.top !== window) {{ a.target = '_top'; a.removeAttribute('rel'); }}
      }})();
      </script>
"""


def side_one(eyebrow, h1, lead, foot, code):
    return f"""  <aside class="side" id="side">
    <div class="eyebrow">{eyebrow}</div>
    <h1>{h1}</h1>
    <p class="lead">{lead}</p>
    <ol class="scenes" id="scenes"></ol>
    <p class="foot">{foot} Le paiement en ligne sous séquestre est présenté comme « bientôt », jamais comme actif : le règlement se fait aujourd'hui par virement sur facture. Le bouton « Je m'inscris » (page web seulement, absent d'un futur MP4 qui montrera le QR) pointe vers /l/{code}, qui mesure le trafic venu de cette vidéo.</p>
    <p class="foot">Pas encore de fichier MP4 pour cette animation : à enregistrer (procédure en tête de brand/anim-presentation/build.py).</p>
  </aside>
"""


COMMON = ["a_head.html", "b_body.html", "c_helpers.js"]
VARIANTS = [
    dict(out="animation-ping.html", var="c2_var_ping.js", tail="e_ping.js", code="ins", title="PING en 1 minute",
         aria=ARIA_PING, cta=CTA_PING, side=SIDE_PING),
    dict(out="animation-client.html", var="c2_var_client.js", tail="e_split.js", code="ins", title="PING pour les particuliers",
         aria="Animation PING pour les particuliers : Et si ce que vous cherchez se trouvait juste à côté ? La carte des prestataires disponibles, le chat avec prix proposé et validé, l'agenda, la facture automatique, le tutoriel pour chercher un prestataire, puis le QR de sécurité, les avis croisés, le service litige et le paiement sécurisé annoncé comme bientôt (règlement par virement sur facture en attendant). Inscription par QR code.",
         cta=cta_one("ins"),
         side=side_one("PING pour les particuliers · 9:16", "PING pour les particuliers",
                       "La vidéo à envoyer à un particulier : l'accroche, la carte, le chat et le prix, l'agenda et la facture, le tutoriel « Je cherche un prestataire », puis les arguments utiles au client. Rien du côté prestataire. Format vertical, lisible sans le son.",
                       "Mêmes scènes que « PING en 1 minute », sans la partie prestataire.", "ins")),
    dict(out="animation-prestataire.html", var="c2_var_pro.js", tail="e_split.js", code="insp", title="PING pour les prestataires",
         aria="Animation PING pour les prestataires : Et si vos prochains clients se trouvaient juste à côté ? Les demandes autour de moi, le tutoriel pour devenir prestataire avec tarifs et disponibilités, puis moins de factures, moins de paperasse, moins d'administratif, le QR de sécurité, les avis croisés, le service litige et le paiement sécurisé annoncé comme bientôt (règlement par virement sur facture en attendant). Inscription par QR code.",
         cta=cta_one("insp"),
         side=side_one("PING pour les prestataires · 9:16", "PING pour les prestataires",
                       "La vidéo à envoyer à un prestataire : l'accroche, les demandes autour de moi, le tutoriel « Je suis prestataire » (profil, tarifs, disponibilités), puis les arguments utiles au prestataire. Rien du côté client. Format vertical, lisible sans le son.",
                       "Mêmes scènes que « PING en 1 minute », sans la partie client.", "insp")),
]

head = ('<!doctype html><html lang="fr"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
        '<meta name="robots" content="noindex">')
fonts = (
    "@font-face{font-family:'Quicksand';font-weight:700;font-display:block;"
    f"src:url(data:font/woff2;base64,{b64('quicksand.woff2')}) format('woff2');}}\n"
    "@font-face{font-family:'Inter';font-weight:100 900;font-display:block;"
    f"src:url(data:font/woff2;base64,{b64('inter.woff2')}) format('woff2');}}"
)


def read(p):
    return (HERE / "parts" / p).read_text()


def main():
    for v in VARIANTS:
        # src.html = assemblage lisible de la présentation d'origine (animation-ping)
        src = "".join(read(p) for p in COMMON[:3] + [v["var"], "d_scenes.js", v["tail"]])
        if v["out"] == "animation-ping.html":
            (HERE / "src.html").write_text(src)
        end, n = qr_rects(BASE + v["code"])
        html = (
            src.replace("%%FONTS%%", fonts)
            .replace("%%TITLE%%", v["title"]).replace("%%ARIA%%", v["aria"])
            .replace("%%CTA%%", v["cta"]).replace("%%SIDE%%", v["side"])
            .replace("%%QR_END%%", end).replace("%%QR_END_SCALE%%", f"{156 / n:.4f}")
            .replace("%%QR_N%%", str(n))
        )
        out = PUB / v["out"]
        out.write_text(head + player.apply(html))
        print("écrit", out)


if __name__ == "__main__":
    main()
