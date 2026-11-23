"""Deux vidéos courtes (23/11/2026) : /animation-courte-client et /animation-courte-prestataire (35 à 45 s chacune), plus /animation-courte
(page de choix entre les deux). Source unique : scenarios.py (scènes, textes, durées, voix off, paramètre SEQUESTRE).

À DIFFUSER APRÈS LE BRANCHEMENT DU SÉQUESTRE ; avant : version sans séquestre (scenarios.SEQUESTRE = False, un seul paramètre).

Même squelette que brand/anim-presentation (parts a_head, b_body, c_helpers : polices, logo « ping », QR) et même lecteur brand/anim/player.* ;
les scènes sont dessinées par parts/e_courte.js (rendu déterministe PING_ANIM.seek). Les anciennes pages (animation, animation-client…) ne sont pas touchées.

Générer : `python3 brand/anim-courte/build.py` -> public/animation-courte{,-client,-prestataire}.html et brand/anim-courte/voix/*.srt.
Contrôle de lecture : `node brand/anim-courte/audit.mjs` (Playwright : seuil de lecture de chaque texte, doigt avant le clic, captures).
Voix off : public/brand/files/voix-courte-client.mp3, voix-courte-prestataire.mp3 (absents : la page reste muette, sous-titrable). Brouillons : voix/fabriquer_voix_piper.py.
Sous-titres : bouton « Sous-titres » (ou ?st=1). Lecteur : ?embed=1, ?scene=N, ?autoplay=0, ?speed=0.75|0.85|1 (la vidéo démarre à 1x)."""
import importlib.util
import json
import pathlib

import scenarios as SC

HERE = pathlib.Path(__file__).parent
ROOT = HERE.parent.parent
PUB = ROOT / "public"
PRES = HERE.parent / "anim-presentation"

spec = importlib.util.spec_from_file_location("pres_build", PRES / "build.py")
pres = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pres)   # définit qr_rects, fonts, head, player, cta_one ; n'écrit rien (main() sous __main__)

EXTRA_CSS = """<style>
  /* vidéos courtes : sous-titres activables (HTML, hors du dessin), commandes, grande scène */
  .player{width:min(100%, calc((100vh - 150px) * 9 / 16), 460px);}
  .stage{container-type:inline-size;}
  .sub{position:absolute; left:4%; right:4%; bottom:3.5%; display:none; text-align:center; pointer-events:none;}
  .sub.on{display:block;}
  .sub.up{bottom:calc(3.4% + 62px);}
  .sub span{display:inline-block; background:rgba(11,27,34,.92); color:#fff; font-family:var(--body); font-weight:600; font-size:clamp(12px,4.3cqw,19px); line-height:1.35; padding:3px 10px; border-radius:8px; margin:1px 0;}
  .transport button[aria-pressed=false]{background:transparent; box-shadow:inset 0 0 0 1.5px var(--line);}
  .transport button#snd[aria-pressed=false]{background:transparent; box-shadow:inset 0 0 0 1.5px var(--line);}
  .trans{background:var(--panel); border-radius:14px; padding:2px 6px;}
  .trans summary{cursor:pointer; font-family:var(--display); font-weight:700; font-size:13.5px; padding:11px 8px;}
  .trans summary:focus-visible{outline:2px solid var(--gold); outline-offset:2px;}
  .trans ol{margin:0; padding:0 8px 10px 26px; font-size:13px; line-height:1.5; color:var(--soft);}
  .trans li{padding:4px 0;} .trans b{color:var(--text);}
  html.embed .trans, html.rec .trans, html.rec .sub{display:none !important;}
  @media (prefers-reduced-motion: reduce){ .signup-cta{transition:none;} }
</style>
"""


def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def srt_time(x):
    ms = int(round(x * 1000)); h, ms = divmod(ms, 3600000); m, ms = divmod(ms, 60000); s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def build(key, v):
    scenes, t0, srt = [], 0.0, []
    for n, s in enumerate(v["scenes"], 1):
        s = dict(s)
        s["sl"] = SC.split_sub(s["v"])
        vs = s.get("v0", 0.35)
        last = n == len(v["scenes"])
        ve = s["d"] if last else s["d"] - 0.25
        srt.append(f"{n}\n{srt_time(t0 + vs)} --> {srt_time(t0 + ve)}\n" + "\n".join(s["sl"]) + "\n")
        s["t0"] = t0
        scenes.append(s)
        t0 += s["d"]
    total = t0
    cfg = dict(scenes=scenes, voice="/brand/files/" + v["voice"], who=v["who"], code=v["code"], sequestre=SC.SEQUESTRE)
    transcript = "".join(
        f"<li><b>{esc(' / '.join(' '.join(m['lines']) for m in s['msgs']))}</b> : {esc(s['v'])}</li>" for s in scenes)
    trans_html = ('\n    <details class="trans" id="transcript"><summary>Transcription (texte à l\'écran et voix off)</summary><ol>'
                  + transcript + "</ol></details>")
    pay = "Le paiement est présenté sous séquestre." if SC.SEQUESTRE else "Le paiement est présenté par virement, prix validé."
    aria = (f"Vidéo {v['title']} ({total:.0f} secondes, sous-titres activables). Scènes : " + " ".join(s["desc"] for s in scenes) + " " + pay)
    cta = '<div class="sub" id="sub" aria-hidden="true"></div>\n' + pres.cta_one(v["code"])
    mode = "AVEC séquestre (à diffuser après son branchement)" if SC.SEQUESTRE else "SANS séquestre (paiement par virement)"
    side = f"""  <aside class="side" id="side">
    <div class="eyebrow">{esc(v['title'])} · {total:.0f} s · 9:16 · vitesse 1×</div>
    <h1>{esc(v['title'])}</h1>
    <p class="lead">{esc(v['lead'])} Un clic sur une scène pour y aller directement. Le bouton d'inscription n'apparaît que sur cette page (un futur MP4 montrerait le QR code).</p>
    <ol class="scenes" id="scenes"></ol>
    <p class="foot">Version : {mode}. Paramètre <code>SEQUESTRE</code> dans brand/anim-courte/scenarios.py. Voix : fichier <code>public/brand/files/{v['voice']}</code> (absent : la page reste muette) ; essai avec la voix de l'appareil : ajouter <code>?voix=nav</code>. Sous-titres : bouton « Sous-titres » ou <code>?st=1</code>. Les scènes « Exemple » (suivi en route, profil, heures) sont des illustrations.</p>
  </aside>
"""
    parts = [(PRES / "parts" / p).read_text() for p in ("a_head.html", "b_body.html", "c_helpers.js")]
    tail = (HERE / "parts" / "e_courte.js").read_text().replace("%%CFG%%", json.dumps(cfg, ensure_ascii=False))
    src = "".join(parts) + tail
    src = src.replace('<div class="layout">', EXTRA_CSS + '<div class="layout">', 1)
    src = src.replace("%%PLAYER_CONTROLS%%", "%%PLAYER_CONTROLS%%" + trans_html, 1)
    end, n = pres.qr_rects(pres.BASE + v["code"])
    html = (src.replace("%%FONTS%%", pres.fonts)
            .replace("%%TITLE%%", v["title"]).replace("%%ARIA%%", esc(aria).replace('"', "&quot;"))
            .replace("%%CTA%%", cta).replace("%%SIDE%%", side)
            .replace("%%QR_END%%", end).replace("%%QR_END_SCALE%%", f"{156 / n:.4f}")
            .replace("%%QR_N%%", str(n)))
    note = ("<!-- À DIFFUSER APRÈS LE BRANCHEMENT DU SÉQUESTRE ; avant : version sans séquestre (SEQUESTRE = False dans brand/anim-courte/scenarios.py) -->\n"
            if SC.SEQUESTRE else "<!-- Version SANS séquestre (SEQUESTRE = False) : paiement par virement, prix validé -->\n")
    out = PUB / v["out"]
    out.write_text(pres.head + note + pres.player.apply(html))
    (HERE / "voix").mkdir(exist_ok=True)
    (HERE / "voix" / (v["voice"].replace(".mp3", "") + ".srt")).write_text("\n".join(srt))
    print("écrit", out, f"{total:.1f} s")
    return total


CHOICE = """<title>PING en vidéo : client ou prestataire</title>
<style>
%s
  :root{--night:#0B1F27; --panel:#12303B; --line:#1E4250; --teal:#12B39C; --green:#2FD06E; --gold:#F2A93B; --text:#EEF4F3; --soft:#9DB4BC;
    --display:'Quicksand','Trebuchet MS',sans-serif; --body:'Inter',system-ui,sans-serif; color-scheme:dark;}
  *{box-sizing:border-box;} html,body{background:var(--night); color:var(--text); margin:0;}
  body{font-family:var(--body); padding:32px 16px 40px; min-height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center;}
  main{width:100%%; max-width:640px;}
  h1{font-family:var(--display); font-weight:700; font-size:clamp(26px,6vw,36px); line-height:1.2; margin:0 0 8px; text-wrap:balance;}
  h1 em{font-style:normal; color:var(--green);}
  p.lead{color:var(--soft); font-size:15px; line-height:1.6; margin:0 0 24px;}
  .cards{display:grid; grid-template-columns:1fr 1fr; gap:14px;}
  a.card{display:flex; flex-direction:column; gap:8px; min-height:44px; padding:20px 18px; border-radius:20px; background:var(--panel); color:var(--text); text-decoration:none; box-shadow:inset 0 0 0 1.5px var(--line);}
  a.card:hover{box-shadow:inset 0 0 0 2px var(--teal);} a.card:focus-visible{outline:3px solid var(--gold); outline-offset:3px;}
  a.card b{font-family:var(--display); font-size:22px;} a.card span{color:var(--soft); font-size:14px; line-height:1.5;}
  a.card i{font-style:normal; font-family:var(--display); font-weight:700; background:var(--teal); color:#fff; border-radius:999px; padding:10px 16px; align-self:flex-start; font-size:14px; margin-top:6px;}
  @media (max-width:520px){ .cards{grid-template-columns:1fr;} }
</style>
<main>
  <h1>Et si ce que vous cherchiez se trouvait <em>juste à côté</em> ?</h1>
  <p class="lead">Deux vidéos courtes, de %d à %d secondes, sous-titrables : choisissez celle qui vous concerne.</p>
  <div class="cards">
    <a class="card" href="/animation-courte-client" aria-label="Vidéo pour les clients, %d secondes"><b>Je cherche un prestataire</b><span>Trouver, réserver, suivre, payer et noter, en %d secondes.</span><i>Voir la vidéo client</i></a>
    <a class="card" href="/animation-courte-prestataire" aria-label="Vidéo pour les prestataires, %d secondes"><b>Je suis prestataire</b><span>Trouver des clients autour de vous, être payé et noté, en %d secondes.</span><i>Voir la vidéo prestataire</i></a>
  </div>
</main>
<script>if (window.top !== window) Array.prototype.forEach.call(document.querySelectorAll('a.card'), function(a){ a.target = '_top'; });</script>
"""


def build_choice(tc, tp):
    html = CHOICE % (pres.fonts, round(min(tc, tp)), round(max(tc, tp)), round(tc), round(tc), round(tp), round(tp))
    out = PUB / "animation-courte.html"
    out.write_text(pres.head + html)
    print("écrit", out, "page de choix")


def main():
    rep, errs = SC.check()
    if errs:
        raise SystemExit("règle non tenue :\n" + "\n".join(errs))
    tot = {k: build(k, v) for k, v in SC.VIDEOS.items()}
    build_choice(tot["client"], tot["pro"])


if __name__ == "__main__":
    main()
