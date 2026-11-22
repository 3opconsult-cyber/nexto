"""Trois animations courtes (22/11/2026) : /animation-courte (20 s), /animation-courte-client et /animation-courte-prestataire (34 s).

Même principe que brand/anim-presentation : mêmes scènes dessinées (parts/ de anim-presentation : a_head, b_body, c_helpers, d_scenes),
mêmes polices et mêmes logos, lecteur partagé brand/anim/player.* ; seule la mise en scène change (parts/e_courte.js) :
plans de 3,6 à 4,8 s, titre de 4 mots au plus, sous-titres = texte de la voix, vitesse 1x par défaut.
Les anciennes pages ne sont pas touchées (leurs build.py sont inchangés et ne sont pas relancés ici).

Générer : `python3 brand/anim-courte/build.py` -> public/animation-courte*.html et brand/anim-courte/voix/*.srt.
Voix off : public/brand/files/voix-courte.mp3, voix-courte-client.mp3, voix-courte-prestataire.mp3 (absents aujourd'hui : la page reste
muette et sous-titrée, sans erreur). Procédure : docs/animations-nouvelles-2026-11-22.md. Essai de la voix de l'appareil : ajouter ?voix=nav à l'adresse.
Vidéo MP4 : non produite (même procédure que brand/anim-presentation/build.py, avec brand/anim/record.js : la page se lit en #record, vitesse 1)."""
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
  /* animations courtes : voix, transcription, deux boutons côte à côte (teaser) */
  .cta-wrap.row{flex-direction:row; gap:8px;}
  .cta-wrap.row .signup-cta{flex:1 1 0; min-width:0; max-width:none; font-size:clamp(12px,3.5vw,15px); padding:13px 8px;}
  .trans{background:var(--panel); border-radius:14px; padding:2px 6px;}
  .trans summary{cursor:pointer; font-family:var(--display); font-weight:700; font-size:13.5px; padding:11px 8px;}
  .trans summary:focus-visible{outline:2px solid var(--gold); outline-offset:2px;}
  .trans ol{margin:0; padding:0 8px 10px 26px; font-size:13px; line-height:1.5; color:var(--soft);}
  .trans li{padding:4px 0;} .trans b{color:var(--text);}
  .transport button#snd[aria-pressed=false]{background:transparent; box-shadow:inset 0 0 0 1.5px var(--line);}
  html.embed .trans, html.rec .trans{display:none !important;}
</style>
"""

VAR_JS = """  var VAR = {
    label: function(t){ return ''; },
    caps: function(C){ C.length = 0; },
    args: [],
    end: { e1: 'PING, l’application de rencontre', e2: 'client-prestataire, en proximité · Côte d’Azur', e5: 'nexto-eta.vercel.app/l/%(code)s' },
    end0: 64.2
  };
"""


def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def cta_teaser():
    return """      <div class="cta-wrap row" id="cta">
        <a class="signup-cta" href="/l/ins" target="_blank" rel="noopener">Je suis client</a>
        <a class="signup-cta alt" href="/l/insp" target="_blank" rel="noopener">Je suis prestataire</a>
      </div>
      <script>
      (function(){
        if (window.top !== window) Array.prototype.forEach.call(document.querySelectorAll('#cta a'), function(a){ a.target = '_top'; a.removeAttribute('rel'); });
      })();
      </script>
"""


def srt_time(x):
    ms = int(round(x * 1000)); h, ms = divmod(ms, 3600000); m, ms = divmod(ms, 60000); s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def build(key, v):
    shots, t0 = [], 0.0
    srt, cues = [], []
    for n, s in enumerate(v["shots"], 1):
        s = dict(s)
        s["sl"] = SC.split_sub(s["v"])
        vs = s.get("v0", 0.35)
        last = n == len(v["shots"])
        ve = s["d"] if last else s["d"] - 0.25
        srt.append(f"{n}\n{srt_time(t0 + vs)} --> {srt_time(t0 + ve)}\n" + "\n".join(s["sl"]) + "\n")
        cues.append((t0, s))
        shots.append(s)
        t0 += s["d"]
    total = t0
    cfg = dict(shots=shots, voice="/brand/files/" + v["voice"])
    transcript = "".join(
        f"<li><b>{esc(' '.join(x for x in s.get('t', []) if x) or 'Écran final')}</b> : {esc(s['v'])}</li>" for s in shots)
    trans_html = ('\n    <details class="trans" id="transcript"><summary>Transcription (voix off et titres)</summary><ol>'
                  + transcript + "</ol></details>")
    aria = (f"Animation {v['title']} ({total:.0f} secondes, sous-titrée). " + " ".join(s["v"] for s in shots)
            + " Le paiement est présenté sous séquestre.")
    if key == "teaser":
        cta = cta_teaser()
    else:
        cta = pres.cta_one(v["code"])
    side = f"""  <aside class="side" id="side">
    <div class="eyebrow">{esc(v['title'])} · {total:.0f} s · 9:16 · vitesse 1×</div>
    <h1>{esc(v['title'])}</h1>
    <p class="lead">{esc(v['lead'])} Un clic sur une scène pour y aller directement. Les boutons d'inscription n'apparaissent que sur cette page (le futur MP4 montrera le QR code).</p>
    <ol class="scenes" id="scenes"></ol>
    <p class="foot">Mêmes scènes dessinées, mêmes polices et même logo que les animations d'origine. Un titre de 4 mots au plus par écran ; les sous-titres reprennent le texte de la voix off. Voix : fichier <code>public/brand/files/{v['voice']}</code> (absent aujourd'hui : la page reste muette et sous-titrée) ; essai avec la voix de l'appareil : ajouter <code>?voix=nav</code> à l'adresse. Le paiement sous séquestre est présenté comme dans les autres animations (décision du 03/11) alors qu'il n'est pas encore actif dans l'application : à réaligner avant tout lancement public.</p>
    <p class="foot">Pas de fichier MP4 pour cette animation : à enregistrer (procédure en tête de brand/anim-courte/build.py).</p>
  </aside>
"""
    parts = [(PRES / "parts" / p).read_text() for p in ("a_head.html", "b_body.html", "c_helpers.js")]
    var = VAR_JS % dict(code=v["code"])
    tail = (HERE / "parts" / "e_courte.js").read_text().replace("%%CFG%%", json.dumps(cfg, ensure_ascii=False))
    src = "".join(parts) + var + (PRES / "parts" / "d_scenes.js").read_text() + tail
    src = src.replace('<div class="layout">', EXTRA_CSS + '<div class="layout">', 1)
    src = src.replace("%%PLAYER_CONTROLS%%", "%%PLAYER_CONTROLS%%" + trans_html, 1)
    end, n = pres.qr_rects(pres.BASE + v["code"])
    html = (src.replace("%%FONTS%%", pres.fonts)
            .replace("%%TITLE%%", v["title"]).replace("%%ARIA%%", aria)
            .replace("%%CTA%%", cta).replace("%%SIDE%%", side)
            .replace("%%QR_END%%", end).replace("%%QR_END_SCALE%%", f"{156 / n:.4f}")
            .replace("%%QR_N%%", str(n)))
    out = PUB / v["out"]
    out.write_text(pres.head + pres.player.apply(html))
    (HERE / "voix").mkdir(exist_ok=True)
    (HERE / "voix" / (v["voice"].replace(".mp3", "") + ".srt")).write_text("\n".join(srt))
    print("écrit", out, f"{total:.1f} s")


def main():
    for r in SC.check():
        if r[0] == "ERREUR":
            raise SystemExit("règle non tenue : " + str(r))
    for key, v in SC.VIDEOS.items():
        build(key, v)


if __name__ == "__main__":
    main()
