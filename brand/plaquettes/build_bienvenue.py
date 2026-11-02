"""Plaquette PING unique : src.html (slides des plaquettes) -> public/bienvenue.html (servi sur /bienvenue).

Couverture -> choix du rôle -> écran bêta -> slides du public choisi (reprises telles quelles de src.html,
donc toujours synchronisées avec /plaquettes) -> dernier écran (inscription / découverte / QR / contact).
Le rôle est gardé dans le hash (#particulier ou #pro). Voir l'animation = overlay iframe /animation-ping."""
import pathlib
import re

from build import EMAIL, PARTS, qr

HERE = pathlib.Path(__file__).parent
OUT = HERE.parent.parent / "public" / "bienvenue.html"
SRC = (HERE / "src.html").read_text()

ROLES = {
    # clé : (QR, lien d'inscription, titre final, mention)
    "particulier": ("/l/pq", "/l/ins", "Trouvez votre prestataire.", "Inscription gratuite · ménage, repassage, nettoyage"),
    "pro": ("/l/pqp", "/l/insp", "Inscription gratuite.", "Visible dès votre profil complété"),
}
DISCOVER = "/map"  # /demo = prototype statique à données fictives : on renvoie vers la vraie carte
PLAY = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>'
ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>'


def fill(s):
    for k, v in PARTS.items():
        s = s.replace(k, v)
    return s


def slides_of(key):
    """Slides du public, sans la dernière (join, remplacée) ni l'intro « Et si ce que vous cherchiez »."""
    pat = r'<section class="deck" data-deck="%s".*?<div class="deck-track">\n(.*?)\n  </div>\n  %%%%NAV%%%%' % key
    sec = re.search(pat, SRC, re.S).group(1)
    parts = re.split(r'\n(?=    <div class="slide)', sec)
    out = [p for p in parts if 'class="slide join"' not in p and "Et si ce que vous cherchiez" not in p]
    assert len(out) >= 4, key
    return "\n".join(fill(p) for p in out)


def last_slide(key):
    qrpath, signup, title, note = ROLES[key]
    return f'''    <div class="slide join">
      <h2>{title}</h2>
      <div class="join-row">
        <div class="join-qr" aria-label="QR code vers PING">{qr("https://nexto-eta.vercel.app" + qrpath)}</div>
        <div class="join-acts">
          <a class="go signup" href="{signup}">Je m'inscris</a>
          <a class="go alt" href="{DISCOVER}">Découvrir l'application</a>
          <span class="lbl">ou scannez le code</span>
        </div>
      </div>
      <div class="mail"><span>{EMAIL}</span><button type="button">Copier</button></div>
      <small>{note}</small>
    </div>'''


templates = "\n".join(f'<template id="t-{k}">\n{slides_of(k)}\n{last_slide(k)}\n</template>' for k in ROLES)

css = re.search(r"<style>(.*?)</style>", SRC, re.S).group(1)
css = re.sub(r"\n  /\* Maquette.*?(?=\n  @media)", "", css, flags=re.S)  # maquette annonceurs : inutile ici

HTML = r'''<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex">
<title>Bienvenue sur PING</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Quicksand:wght@600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>%%CSS%%
  /* --- Plaquette unique (généré par brand/plaquettes/build_bienvenue.py) --- */
  body{padding-block:16px;}
  .deck{display:flex; flex-direction:column; min-height:calc(100vh - 32px); min-height:calc(100svh - 32px);}
  .deck-track{flex:1;}
  .slide{min-height:0; justify-content:center;}
  .deck.on-cover .deck-head .anim-btn, .deck.on-cover .deck-head .count{visibility:hidden;}
  .deck.no-role .deck-nav{visibility:hidden;}
  .anim-btn{border:none; cursor:pointer;}
  .anim-btn.big{border:none; box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.35);}
  .cover{gap:14px;}
  .radar{position:relative; width:150px; height:150px; display:flex; align-items:center; justify-content:center; flex-shrink:0;}
  .radar i{position:absolute; inset:0; border-radius:50%; border:2px solid var(--teal); opacity:0; animation:echo 3.2s ease-out infinite;}
  .radar i:nth-child(2){animation-delay:1.06s;} .radar i:nth-child(3){animation-delay:2.12s;}
  .radar svg.device{position:relative; width:64px; height:102px;}
  @keyframes echo{0%{transform:scale(.4); opacity:.7;} 100%{transform:scale(1); opacity:0;}}
  .cover .word{font-family:var(--display); font-weight:700; font-size:54px; letter-spacing:.06em; line-height:1; margin:0; color:#fff;}
  .cover .ask{font-size:17px; line-height:1.45; color:rgba(255,255,255,.82); max-width:26ch; text-wrap:balance; margin:0;}
  .cover .rule{width:44px; height:3px; border-radius:2px; background:var(--gold);}
  .choices{display:flex; flex-direction:column; gap:11px; width:100%; max-width:340px; margin-top:6px;}
  .cta{display:flex; align-items:center; justify-content:space-between; gap:12px; min-height:60px; padding:12px 20px; border-radius:18px; border:none; cursor:pointer; text-align:left; font-family:var(--display); font-weight:700; font-size:18px; width:100%;}
  .cta svg{width:20px; height:20px; flex-shrink:0;}
  .cta.a{background:var(--teal); color:#fff;}
  .cta.b{background:#fff; color:var(--navy);}
  .deck .cta:focus-visible{outline:3px solid var(--gold); outline-offset:3px;}
  .betaw h2{font-size:25px; max-width:20ch;}
  .betaw p{max-width:34ch; font-size:15px; line-height:1.55; color:rgba(255,255,255,.85);}
  .betaw .cta{max-width:260px; justify-content:center; margin-top:4px;}
  .join .mail{max-width:100%;}
  .join-acts .go{text-align:center;}
  .ov{position:fixed; inset:0; z-index:50; background:rgba(8,22,29,.88); display:flex; align-items:center; justify-content:center; padding:56px 16px 16px;}
  .ov[hidden]{display:none;}
  .ov iframe{border:0; border-radius:20px; background:#000; aspect-ratio:9/16; height:min(calc(100vh - 80px), calc((100vw - 32px) * 16 / 9)); height:min(calc(100svh - 80px), calc((100vw - 32px) * 16 / 9)); max-width:100%;}
  .ov .x{position:absolute; top:max(10px, env(safe-area-inset-top,0px)); right:14px; display:flex; align-items:center; gap:8px; border:none; background:#fff; color:var(--navy); font-family:var(--display); font-weight:700; font-size:14px; padding:9px 15px 9px 13px; border-radius:999px; cursor:pointer;}
  .ov .x svg{width:16px; height:16px;}
  .ov .x:focus-visible{outline:3px solid var(--gold); outline-offset:2px;}
  @media (prefers-reduced-motion: reduce){ .radar i{animation:none; opacity:.25; transform:scale(.8);} .radar i:nth-child(n+2){display:none;} }
</style>
</head>
<body>
<main>
<section class="deck on-cover no-role" aria-label="Plaquette PING">
  <div class="deck-head"><span class="kicker">Avant-première</span><button type="button" class="anim-btn" data-anim>%%PLAY%%Voir l'animation</button><span class="count"></span></div>
  <div class="deck-track" id="track">
    <div class="slide cover" id="cover">
      <div class="radar" aria-hidden="true"><i></i><i></i><i></i>%%DEVICE%%</div>
      <h1 class="word">PING</h1>
      <p class="ask">Et si ce que vous cherchez se trouvait juste à côté ?</p>
      <div class="rule"></div>
      <div class="choices">
        <button type="button" class="cta a" data-role="particulier"><span>Je cherche un prestataire</span>%%ARROW%%</button>
        <button type="button" class="cta b" data-role="pro"><span>Je suis prestataire</span>%%ARROW%%</button>
      </div>
      <button type="button" class="anim-btn big" data-anim>%%PLAY%%Voir l'animation</button>
    </div>
  </div>
  <div class="deck-nav">
    <button type="button" class="arrow prev" aria-label="Écran précédent"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg></button>
    <div class="dots"></div>
    <button type="button" class="arrow next" aria-label="Écran suivant"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg></button>
  </div>
</section>
</main>

<template id="t-beta">
    <div class="slide betaw">
      <h2>Bienvenue sur PING — version bêta</h2>
      <p>Vous pouvez parcourir, vous inscrire : tout fonctionne, à l'exception des paiements et de la transaction réelle entre prestataires et clients. Nous vous sollicitons pour un test : votre avis sur l'ergonomie, les options qui vous manquent, vos observations et commentaires. Vous pouvez les laisser dans la petite bulle verte, sur la droite. Merci encore pour votre participation.</p>
      <button type="button" class="cta a" data-continue><span>Continuer</span>%%ARROW%%</button>
    </div>
</template>
%%TEMPLATES%%

<div class="ov" id="ov" hidden role="dialog" aria-modal="true" aria-label="Animation PING">
  <button type="button" class="x" id="ovx"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>Fermer</button>
  <iframe id="ovf" title="Animation PING" allow="autoplay" src="about:blank"></iframe>
</div>

<script>
(function(){
  var deck = document.querySelector('.deck'), track = document.getElementById('track');
  var dots = deck.querySelector('.dots'), prev = deck.querySelector('.prev'), next = deck.querySelector('.next'), count = deck.querySelector('.count');
  var kicker = deck.querySelector('.kicker');
  var KICK = { particulier: 'Particuliers', pro: 'Prestataires' };
  var role = null;
  var ov = document.getElementById('ov'), ovf = document.getElementById('ovf'), lastFocus = null;
  function n(){ return track.children.length; }
  function cur(){ return track.clientWidth ? Math.round(track.scrollLeft / track.clientWidth) : 0; }
  function go(i, instant){ track.scrollTo({ left: i * track.clientWidth, behavior: instant ? 'auto' : 'smooth' }); }
  function update(){
    var k = cur(), t = n();
    Array.prototype.forEach.call(dots.children, function(d, i){ d.classList.toggle('on', i === k); });
    prev.disabled = k === 0; next.disabled = k >= t - 1; count.textContent = (k + 1) + ' / ' + t;
    deck.classList.toggle('on-cover', k === 0);
    deck.classList.toggle('no-role', !role);
    kicker.textContent = (k > 0 && role) ? KICK[role] : 'Avant-première';
  }
  function setRole(r){
    role = (r === 'particulier' || r === 'pro') ? r : null;
    while (track.children.length > 1) track.removeChild(track.lastChild);
    if (role){
      track.appendChild(document.getElementById('t-beta').content.cloneNode(true));
      track.appendChild(document.getElementById('t-' + role).content.cloneNode(true));
    }
    dots.innerHTML = '';
    for (var i = 0; i < n(); i++) (function(i){
      var b = document.createElement('button'); b.type = 'button'; b.setAttribute('aria-label', 'Écran ' + (i + 1));
      b.addEventListener('click', function(){ go(i); }); dots.appendChild(b);
    })(i);
    bindMail();
    update();
  }
  function bindMail(){
    track.querySelectorAll('.mail button').forEach(function(b){
      if (b.dataset.b) return; b.dataset.b = 1;
      b.addEventListener('click', function(){
        var s = b.parentNode.querySelector('span');
        function select(){ var r = document.createRange(); r.selectNodeContents(s); var w = getSelection(); w.removeAllRanges(); w.addRange(r); }
        function done(){ b.textContent = 'Copié'; setTimeout(function(){ b.textContent = 'Copier'; }, 1600); }
        if (navigator.clipboard) navigator.clipboard.writeText(s.textContent).then(done, select); else select();
      });
    });
  }
  function openAnim(){ lastFocus = document.activeElement; ovf.src = '/animation-ping'; ov.hidden = false; document.body.style.overflow = 'hidden'; document.getElementById('ovx').focus(); }
  function closeAnim(){ ov.hidden = true; ovf.src = 'about:blank'; document.body.style.overflow = ''; if (lastFocus && lastFocus.focus) lastFocus.focus(); }
  var tick = false;
  track.addEventListener('scroll', function(){ if (tick) return; tick = true; requestAnimationFrame(function(){ update(); tick = false; }); });
  prev.addEventListener('click', function(){ go(Math.max(0, cur() - 1)); });
  next.addEventListener('click', function(){ go(Math.min(n() - 1, cur() + 1)); });
  document.addEventListener('keydown', function(e){
    if (!ov.hidden){ if (e.key === 'Escape') closeAnim(); return; }
    if (e.key === 'ArrowRight') go(Math.min(n() - 1, cur() + 1)); else if (e.key === 'ArrowLeft') go(Math.max(0, cur() - 1));
  });
  deck.addEventListener('click', function(e){
    var r = e.target.closest('[data-role]');
    if (r){
      var k = r.getAttribute('data-role');
      try { history.replaceState(null, '', location.pathname + location.search + '#' + k); } catch (x) {}
      setRole(k); go(1, true); update(); return;
    }
    if (e.target.closest('[data-continue]')) { go(2); return; }
    if (e.target.closest('[data-anim]')) openAnim();
  });
  document.getElementById('ovx').addEventListener('click', closeAnim);
  ov.addEventListener('click', function(e){ if (e.target === ov) closeAnim(); });
  window.addEventListener('hashchange', function(){
    var k = (location.hash || '').slice(1);
    if (k !== role){ setRole(k); go(0, true); }
  });
  setRole((location.hash || '').slice(1));
})();
</script>
</body>
</html>
'''

html = (
    HTML.replace("%%CSS%%", css)
    .replace("%%TEMPLATES%%", templates)
    .replace("%%PLAY%%", PLAY)
    .replace("%%ARROW%%", ARROW)
    .replace("%%DEVICE%%", PARTS["%%DEVICE%%"])
)
assert "%%" not in html, "jeton non remplacé"
OUT.write_text(html)
print("écrit", OUT)
