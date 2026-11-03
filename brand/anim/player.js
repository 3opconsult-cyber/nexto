  // ---------- lecteur partagé (brand/anim/player.js, injecté par chaque build.py) ----------
  // Contrat d'URL : ?admin=1 (panneau scénario), ?embed=1 (lecteur seul + rubriques repliables, postMessage
  // {ping:'anim-ended'} à la fin), ?scene=N (rang 1..n dans la liste des rubriques), ?autoplay=0 (démarre en pause),
  // ?speed=0.75|0.85|1. Vitesse par défaut 0,85× : seul le temps de lecture est ralenti, seek(t) reste déterministe.
  // cfg = { dur, scenes:[{a:début, go:point de saut, title, d}], paint(t), init(), start(): t initial, still }
  function makePlayer(cfg){
    var DUR = cfg.dur, SC = cfg.scenes, q = location.search, g = function(id){ return document.getElementById(id); };
    var admin = /[?&]admin=1\b/.test(q), embed = /[?&]embed=1\b/.test(q), rec = location.hash === '#record';
    var speed = 0.85, ms = /[?&]speed=(0\.75|0\.85|1)(?:\.0+)?\b/.exec(q); if (ms) speed = parseFloat(ms[1]);
    var reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    var playing = !reduced && !/[?&]autoplay=0\b/.test(q), last = null, t = 0, ended = false;
    if (rec) { document.body.classList.add('rec'); playing = false; speed = 1; }
    var side = g('side');
    if (side && (!admin || embed)) side.parentNode.removeChild(side);
    function fmt(x){ return x.toFixed(1).replace('.', ','); }
    function mk(list, withDesc, cls){
      var out = [];
      SC.forEach(function(C, i){
        var li = document.createElement('li'), b = document.createElement('button'); b.type = 'button';
        if (withDesc) {
          b.innerHTML = '<span class="tc">' + fmt(C.a) + ' s</span><span><b></b><span class="d"></span></span>';
          b.querySelector('b').textContent = (i + 1) + '. ' + C.title; b.querySelector('.d').textContent = C.d;
        } else {
          b.innerHTML = '<span class="n"></span><span class="ti"></span>';
          b.querySelector('.n').textContent = (i + 1); b.querySelector('.ti').textContent = C.title;
        }
        b.addEventListener('click', function(){ seek(C.go); playing = true; sync(); });
        li.appendChild(b); list.appendChild(li); out.push(b);
      });
      return out;
    }
    // Vitesse et Rubriques : infos internes, absentes du DOM pour les participants (sans ?admin=1), embed compris.
    ['rub'].forEach(function(id){ var n = g(id); if (n && !admin) n.parentNode.removeChild(n); });
    var spd = document.querySelector('.speed'); if (spd && !admin) spd.parentNode.removeChild(spd);
    var adminBtns = g('scenes') ? mk(g('scenes'), true) : [], rubBtns = g('rubList') ? mk(g('rubList'), false) : [];
    if (!embed && g('rub')) g('rub').open = true;
    function cur(x){ var k = 0; SC.forEach(function(C, i){ if (x >= C.a) k = i; }); return k; }
    function seek(x){ t = Math.max(0, Math.min(DUR, x)); if (t < DUR - 0.05) ended = false; paint(); }
    function paint(){
      cfg.paint(t);
      g('scrub').value = t;
      g('tc').textContent = fmt(t / speed) + ' / ' + fmt(DUR / speed) + ' s';
      var k = cur(t);
      adminBtns.concat(rubBtns).forEach(function(b, i){ b.classList.toggle('on', i % SC.length === k); });
    }
    var PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15L19.5 12z"/></svg><span>Lecture</span>';
    var PAUSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3.4v14H7zM13.6 5H17v14h-3.4z"/></svg><span>Pause</span>';
    function sync(){ var p = g('play'); p.innerHTML = playing ? PAUSE : PLAY; p.setAttribute('aria-label', playing ? 'Pause' : 'Lecture'); }
    function finish(){
      t = DUR; playing = false; sync();
      if (!ended) { ended = true; try { window.parent.postMessage({ ping: 'anim-ended' }, '*'); } catch (e) {} }
    }
    function loop(now){
      if (playing) {
        if (last != null) {
          t += Math.min((now - last) / 1000, 0.5) * speed;
          if (t >= DUR) { if (embed) finish(); else t = 0; }
        }
        paint();
      }
      last = now; requestAnimationFrame(loop);
    }
    g('play').addEventListener('click', function(){
      if (!playing && embed && t >= DUR - 0.05) { seek(0); }
      playing = !playing; sync();
    });
    g('replay').addEventListener('click', function(){ seek(0); playing = true; sync(); });
    g('next').addEventListener('click', function(){ var k = cur(t); seek(SC[Math.min(k + 1, SC.length - 1)].go); });
    g('prev').addEventListener('click', function(){
      var k = cur(t); seek(SC[(t - SC[k].go < 2 && k > 0) ? k - 1 : k].go);
    });
    g('scrub').addEventListener('input', function(e){ playing = false; sync(); seek(parseFloat(e.target.value)); });
    var spBtns = Array.prototype.slice.call(document.querySelectorAll('.speed [data-speed]'));
    function setSpeed(v){ speed = v; spBtns.forEach(function(b){ b.setAttribute('aria-pressed', parseFloat(b.getAttribute('data-speed')) === v ? 'true' : 'false'); }); paint(); }
    spBtns.forEach(function(b){ b.addEventListener('click', function(){ setSpeed(parseFloat(b.getAttribute('data-speed'))); }); });
    g('scrub').max = DUR;
    window.PING_ANIM = { duration: DUR, seek: function(x){ seek(x); }, get speed(){ return speed; } };
    var start = function(){
      if (cfg.init) cfg.init();
      setSpeed(speed); sync();
      var ms2 = /[?&]scene=(\d+)\b/.exec(q), n = ms2 ? parseInt(ms2[1], 10) : 0;
      if (!rec && n >= 1 && n <= SC.length) seek(SC[n - 1].go);
      else if (!rec && cfg.start) seek(cfg.start());
      else if (reduced && !rec && cfg.still != null) seek(cfg.still);
      if (!rec) requestAnimationFrame(loop);
      window.PING_ANIM.ready = true;
    };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(start); else start();
  }
