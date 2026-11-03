"""Plaquette PING unique : src.html (slides des plaquettes) -> public/bienvenue.html (servi sur /bienvenue).

Couverture (2 boutons : rôle) -> choix « Suivre le parcours » / « Voir l'animation » -> slides du public choisi
(reprises telles quelles de src.html, donc synchronisées avec /plaquettes) -> dernier écran (QR, « Je m'inscris »,
« Je m'inscris » (plus de visite de l'application depuis la plaquette)) -> écran bêta -> /l/ins ou /l/insp. Le rôle est gardé dans le hash (#particulier ou #pro).
Voir l'animation = overlay iframe /animation-client?role=client (particulier) ou /animation-prestataire?role=pro (pro), deux animations séparées. Entrée directe : ?role=client|pro&go=inscription
(fin de l'animation) ouvre l'écran bêta. Une seule étape visible à la fois (data-stage sur .deck)."""
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
BACK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>'
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
          <span class="lbl">ou scannez le code</span>
        </div>
      </div>
      <p class="bulle">Inscrivez-vous, puis laissez vos commentaires dans la <b>bulle verte</b> en bas à droite de l'écran : ils nous aident à améliorer PING.</p>
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
  .deck[data-stage="cover"] .back, .deck:not([data-stage="slides"]) .count{visibility:hidden;}
  .deck:not([data-stage="slides"]) .deck-nav{display:none;}
  .back svg{width:14px; height:14px; margin-right:6px;}
  .choice .who{font-family:var(--display); font-size:30px; line-height:1.15; margin:0; color:#fff; max-width:14ch; text-wrap:balance;}
  .cta.a, .cta.b{text-decoration:none;}
  .anim-btn{border:none; cursor:pointer;}
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
  .join .bulle{max-width:34ch; margin:10px auto 0; font-size:13.5px; line-height:1.5; color:rgba(255,255,255,.88); text-align:center;}
  .betaw .cta{max-width:340px; justify-content:center; margin-top:4px;}
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
<section class="deck" data-stage="cover" aria-label="Plaquette PING">
  <div class="deck-head"><span class="kicker">Avant-première</span><button type="button" class="anim-btn back" data-back>%%BACK%%Retour</button><span class="count"></span></div>
  <div class="deck-track" id="track"></div>
  <div class="deck-nav">
    <button type="button" class="arrow prev" aria-label="Écran précédent"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg></button>
    <div class="dots"></div>
    <button type="button" class="arrow next" aria-label="Écran suivant"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg></button>
  </div>
</section>
</main>

<template id="t-cover">
    <div class="slide cover">
      <div class="radar" aria-hidden="true"><i></i><i></i><i></i>%%DEVICE%%</div>
      <h1 class="word">PING</h1>
      <p class="ask">Et si ce que vous cherchez se trouvait juste à côté ?</p>
      <div class="rule"></div>
      <div class="choices">
        <button type="button" class="cta a" data-role="particulier"><span>Je cherche un prestataire</span>%%ARROW%%</button>
        <button type="button" class="cta b" data-role="pro"><span>Je suis prestataire</span>%%ARROW%%</button>
      </div>
    </div>
</template>
<template id="t-choice">
    <div class="slide cover choice">
      <h2 class="who"></h2>
      <p class="ask">Comment voulez-vous découvrir PING ?</p>
      <div class="choices">
        <button type="button" class="cta a" data-act="follow"><span>Suivre le parcours</span>%%ARROW%%</button>
        <button type="button" class="cta b" data-act="anim"><span>Voir l'animation</span>%%PLAY%%</button>
      </div>
    </div>
</template>
<template id="t-beta">
    <div class="slide betaw">
      <h2>Bienvenue sur PING — version bêta</h2>
      <p>Inscrivez-vous, comme particulier ou comme prestataire (vous pouvez essayer les deux côtés) : tout fonctionne, à l'exception des paiements et de la transaction réelle entre prestataires et clients. Nous vous sollicitons pour un test : votre avis sur l'ergonomie, les options qui vous manquent, vos observations et commentaires. Vous pouvez les laisser dans la petite bulle verte, sur la droite, une fois inscrit(e). Votre inscription et vos commentaires sont conservés. Merci encore pour votre participation.</p>
      <a class="cta a" id="betago" href="/l/ins"><span>Continuer vers l'inscription</span>%%ARROW%%</a>
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
  var WHO = { particulier: 'Je cherche un prestataire', pro: 'Je suis prestataire' };
  var SIGNUP = { particulier: '/l/ins', pro: '/l/insp' };
  var ANIM = { particulier: '/animation-client?role=client', pro: '/animation-prestataire?role=pro' };
  var role = null, stage = 'cover', betaFrom = 'choice';
  var ov = document.getElementById('ov'), ovf = document.getElementById('ovf'), lastFocus = null;
  function n(){ return track.children.length; }
  function cur(){ return track.clientWidth ? Math.round(track.scrollLeft / track.clientWidth) : 0; }
  function go(i, instant){ track.scrollTo({ left: i * track.clientWidth, behavior: instant ? 'auto' : 'smooth' }); }
  function tpl(id){ return document.getElementById(id).content.cloneNode(true); }
  function norm(r){ return r === 'client' ? 'particulier' : ((r === 'particulier' || r === 'pro') ? r : null); }
  function update(){
    if (stage !== 'slides'){ kicker.textContent = (stage !== 'cover' && role) ? KICK[role] : 'Avant-première'; return; }
    var k = cur(), t = n();
    Array.prototype.forEach.call(dots.children, function(d, i){ d.classList.toggle('on', i === k); });
    prev.disabled = k === 0; next.disabled = k >= t - 1; count.textContent = (k + 1) + ' / ' + t;
  }
  function show(st){
    if (!role && st !== 'cover') st = 'cover';
    stage = st; deck.setAttribute('data-stage', st);
    track.innerHTML = ''; dots.innerHTML = '';
    track.appendChild(tpl(st === 'cover' ? 't-cover' : st === 'choice' ? 't-choice' : st === 'beta' ? 't-beta' : 't-' + role));
    if (st === 'choice') track.querySelector('.who').textContent = WHO[role];
    if (st === 'beta') document.getElementById('betago').href = SIGNUP[role];
    if (st === 'slides') for (var i = 0; i < n(); i++) (function(i){
      var b = document.createElement('button'); b.type = 'button'; b.setAttribute('aria-label', 'Écran ' + (i + 1));
      b.addEventListener('click', function(){ go(i); }); dots.appendChild(b);
    })(i);
    track.scrollLeft = 0;
    bindMail(); update();
    window.scrollTo(0, 0);
  }
  function setRole(r){
    role = norm(r);
    try { history.replaceState(null, '', location.pathname + (role ? '#' + role : '')); } catch (x) {}
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
  function openAnim(){ lastFocus = document.activeElement; ovf.src = ANIM[role]; ov.hidden = false; document.body.style.overflow = 'hidden'; document.getElementById('ovx').focus(); }
  function closeAnim(){ ov.hidden = true; ovf.src = 'about:blank'; document.body.style.overflow = ''; if (lastFocus && lastFocus.focus) lastFocus.focus(); }
  function back(){
    if (stage === 'beta') show(betaFrom);
    else if (stage === 'slides') show('choice');
    else if (stage === 'choice'){ setRole(null); show('cover'); }
  }
  var tick = false;
  track.addEventListener('scroll', function(){ if (tick) return; tick = true; requestAnimationFrame(function(){ update(); tick = false; }); });
  prev.addEventListener('click', function(){ go(Math.max(0, cur() - 1)); });
  next.addEventListener('click', function(){ go(Math.min(n() - 1, cur() + 1)); });
  document.addEventListener('keydown', function(e){
    if (!ov.hidden){ if (e.key === 'Escape') closeAnim(); return; }
    if (stage !== 'slides') return;
    if (e.key === 'ArrowRight') go(Math.min(n() - 1, cur() + 1)); else if (e.key === 'ArrowLeft') go(Math.max(0, cur() - 1));
  });
  deck.addEventListener('click', function(e){
    var r = e.target.closest('[data-role]');
    if (r){ setRole(r.getAttribute('data-role')); show('choice'); return; }
    var a = e.target.closest('[data-act]');
    if (a){ if (a.getAttribute('data-act') === 'anim') openAnim(); else show('slides'); return; }
    if (e.target.closest('[data-back]')){ back(); return; }
    var su = e.target.closest('a.signup');
    if (su){ e.preventDefault(); betaFrom = 'slides'; show('beta'); }
  });
  document.getElementById('ovx').addEventListener('click', closeAnim);
  ov.addEventListener('click', function(e){ if (e.target === ov) closeAnim(); });
  window.addEventListener('hashchange', function(){
    var k = norm((location.hash || '').slice(1));
    if (k !== role){ role = k; show(k ? 'choice' : 'cover'); }
  });
  // entrée : #particulier / #pro ; ?role=client|pro (&go=inscription -> écran bêta directement)
  var q = location.search.match(/[?&]role=([a-z]+)/), g = /[?&]go=inscription\b/.test(location.search);
  if (q && norm(q[1])){
    setRole(q[1]);
    if (g){ betaFrom = 'choice'; show('beta'); } else show('choice');
  } else {
    role = norm((location.hash || '').slice(1));
    show(role ? 'choice' : 'cover');
  }
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
    .replace("%%BACK%%", BACK)
    .replace("%%DEVICE%%", PARTS["%%DEVICE%%"])
)
assert "%%" not in html, "jeton non remplacé"
OUT.write_text(html)
print("écrit", OUT)
