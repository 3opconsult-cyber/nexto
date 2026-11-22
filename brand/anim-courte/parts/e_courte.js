%%PLAYER_JS%%
  // ---------- animations courtes (22/11/2026) : plans bout à bout, mêmes scènes que /animation-client et /animation-prestataire ----------
  // CFG.shots = [{k:'intro'|'phone'|'arg'|'end', d, src:[début, fin] (temps SOURCE de render()), t:[titre], i, v, sl:[lignes de sous-titre], v0}].
  // Chaque plan est un pur calcul de T (seek déterministe). Titre (4 mots max) en haut, sous-titre = texte de la voix en bas,
  // voile navy à chaque jonction (la coupure se fait au plus sombre). La voix (fichier mp3) se joue seulement si elle existe.
  var CFG = %%CFG%%;
  var SH = [], TOTAL = 0;
  CFG.shots.forEach(function(s){ SH.push({ s: s, t0: TOTAL, t1: TOTAL + s.d }); TOTAL += s.d; });
  function shotAt(T){ for (var i = 0; i < SH.length; i++) if (T < SH[i].t1) return i; return SH.length - 1; }

  var svgEl = $('svg'), prog = $('prog');
  function layer(attrs){ var g = el('g', attrs || {}); svgEl.insertBefore(g, prog); return g; }
  // plan « argument » : fond navy, pictogramme, titre
  var kArg = layer({ opacity: 0 });
  el('rect', { width: 540, height: 960, fill: '#123644' }, kArg);
  var kRings = [0, 1, 2].map(function(){ return el('circle', { cx: 270, cy: 330, r: 0, fill: 'none', stroke: '#12B39C', 'stroke-width': 2 }, kArg); });
  var kIc = el('g', {}, kArg); el('circle', { cx: 270, cy: 330, r: 58, fill: '#1E4352' }, kIc);
  var kIcons = {};
  CFG.shots.forEach(function(s){ if (s.i && !kIcons[s.i]) { kIcons[s.i] = icon(kIc, s.i, 270, 330, 2.5, '#2FD06E', 1.6); kIcons[s.i].setAttribute('display', 'none'); } });
  var kT = [tx(kArg, 270, 490, '', { f: 'Q', s: 38, a: 'middle', c: '#fff' }), tx(kArg, 270, 540, '', { f: 'Q', s: 38, a: 'middle', c: '#2FD06E' })];
  // sous-titres : le texte de la voix, 1 à 2 lignes
  var subG = layer({ opacity: 0 });
  el('rect', { x: 24, y: 868, width: 492, height: 80, rx: 18, fill: '#0B1B22', opacity: 0.9 }, subG);
  var subL = [tx(subG, 270, 0, '', { s: 22, w: 600, c: '#fff', a: 'middle' }), tx(subG, 270, 0, '', { s: 22, w: 600, c: '#fff', a: 'middle' })];
  var dip = el('rect', { x: 0, y: 0, width: 540, height: 960, fill: '#123644', opacity: 0 });
  svgEl.insertBefore(dip, prog);
  var cta = $('cta');

  // ---------- voix off : fichier mp3 si présent ; sinon muet (essai ?voix=nav : voix de l'appareil) ----------
  var V = { audio: null, ok: false, muted: false, btn: null, nav: /[?&]voix=nav\b/.test(location.search), spoken: -1 };
  function setBtn(){ if (!V.btn) return; V.btn.setAttribute('aria-pressed', V.muted ? 'false' : 'true'); V.btn.querySelector('span').textContent = V.muted ? 'Son coupé' : 'Son activé'; }
  function addBtn(){
    var tp = document.querySelector('.transport'); if (!tp || V.btn) return;
    var b = document.createElement('button'); b.type = 'button'; b.id = 'snd';
    b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" style="fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11"/></svg><span>Son activé</span>';
    b.addEventListener('click', function(){
      V.muted = !V.muted; setBtn();
      if (V.ok && V.audio) { if (V.muted) V.audio.pause(); else if (window.PING_ANIM && window.PING_ANIM.playing) { V.audio.currentTime = window.PING_ANIM.time; V.audio.play().catch(function(){}); } }
      if (!V.ok && V.nav) stopNav();
    });
    tp.appendChild(b); V.btn = b; setBtn();
  }
  try {
    if (!V.nav && window.fetch && location.protocol !== 'file:') {
      fetch(CFG.voice, { method: 'HEAD', cache: 'no-store' }).then(function(r){
        var ct = (r.headers.get('content-type') || '').toLowerCase();
        if (!r.ok || !/audio|mpeg|octet-stream/.test(ct)) return;
        V.audio = new Audio(CFG.voice); V.audio.preload = 'auto'; V.ok = true; addBtn();
      }).catch(function(){});
    }
    if (V.nav && 'speechSynthesis' in window) addBtn();
  } catch (e) {}
  function stopNav(){ try { window.speechSynthesis.cancel(); } catch (e) {} V.spoken = -1; }
  function speakNav(i){
    try {
      var u = new SpeechSynthesisUtterance(CFG.shots[i].v); u.lang = 'fr-FR'; u.rate = 0.95;
      var vs = window.speechSynthesis.getVoices().filter(function(x){ return /^fr/i.test(x.lang); }); if (vs.length) u.voice = vs[0];
      window.speechSynthesis.cancel(); window.speechSynthesis.speak(u);
    } catch (e) {}
  }
  function voiceFrame(T, playing, speed){
    if (V.muted) return;
    if (V.ok && V.audio) {
      var a = V.audio;
      try { a.playbackRate = speed; } catch (e) {}
      if (playing) {
        if (a.paused) { a.currentTime = T; var p = a.play(); if (p && p.catch) p.catch(function(){}); }
        else if (Math.abs(a.currentTime - T) > 0.35) a.currentTime = T;
      } else { if (!a.paused) a.pause(); if (Math.abs(a.currentTime - T) > 0.05) a.currentTime = T; }
    } else if (V.nav && 'speechSynthesis' in window) {
      var i = shotAt(T), cue = SH[i].t0 + (SH[i].s.v0 || 0.35);
      if (!playing) { if (V.spoken !== -1) stopNav(); return; }
      if (T >= cue && V.spoken !== i && T < cue + 1.5) { V.spoken = i; speakNav(i); }
      if (T < SH[i].t0 + 0.1) V.spoken = -1;
    }
  }
  function voiceState(playing, T, speed){
    if (V.ok && V.audio && !playing) { try { V.audio.pause(); V.audio.currentTime = T; } catch (e) {} }
    if (V.nav && !playing) stopNav();
  }

  makePlayer({
    dur: TOTAL, speed: 1,
    scenes: SH.map(function(q, i){ return { a: q.t0, go: q.t0 + (i ? 0.7 : 0.01), title: q.s.lib, d: q.s.desc }; }),
    init: function(){
      introDot = buildWord($('introWord'), 92, 330, 270);
      endDot = buildWord($('endWord'), 76, 300, 270);
      if (VAR.end) for (var k in VAR.end) $(k).textContent = VAR.end[k];
    },
    onFrame: voiceFrame, onState: voiceState,
    paint: function(T){ draw(T); }
  });
  function draw(T){
    var i = shotAt(T), q = SH[i], s = q.s, u = T - q.t0, d = s.d, k = s.k, last = i === SH.length - 1, ts;
    if (k === 'intro') { ts = u; while (ts >= 3.9) ts -= 1.8; }
    else if (k === 'phone') ts = s.src[0] + (s.src[1] - s.src[0]) * (u / d);
    else if (k === 'end') ts = 64.2 + u * 1.35;
    else ts = 3.9;
    render(ts);
    // calques de la scène d'origine que ce plan n'utilise pas
    if (k !== 'intro') show($('intro'), 0);
    if (k !== 'end') show($('end'), 0);
    show($('args'), k === 'end' ? 1 : 0); show($('sep'), 0);
    $('partLbl').setAttribute('opacity', 0);
    prog.setAttribute('width', (540 * T / TOTAL).toFixed(1));
    var fade = last ? 1 : 1 - seg(u, d - 0.35, d - 0.1);
    // titre
    var tl = s.t || [], ot = last ? 0 : win(u, 0.35, d - 0.1, 0.3);
    show($('cap'), 0); show($('capText'), 0);
    if (k === 'phone') {
      var two = tl.length > 1;
      capLines[0].textContent = tl[0] || ''; capLines[1].textContent = tl[1] || '';
      capLines[0].setAttribute('font-size', 32); capLines[1].setAttribute('font-size', 32);
      capLines[0].setAttribute('y', two ? 88 : 108); capLines[1].setAttribute('y', 128);
      tr($('capText'), 'translate(0,' + ((1 - ot) * 8).toFixed(1) + ')');
      show($('capText'), ot); show($('cap'), ot);
    }
    if (k === 'intro') {
      ['in1', 'in2', 'in3'].forEach(function(id, j){
        var n = $(id), a = 0.6 + j * 0.4, e = eout(seg(u, a, a + 0.5));
        n.textContent = tl[j] || ''; show(n, e * fade); tr(n, 'translate(0,' + (16 * (1 - e)).toFixed(1) + ')');
      });
    }
    show(kArg, k === 'arg' ? 1 : 0);
    if (k === 'arg') {
      for (var nm in kIcons) kIcons[nm].setAttribute('display', nm === s.i ? 'inline' : 'none');
      sc(kIc, back(seg(u, 0.2, 0.8)), 270, 330);
      kRings.forEach(function(c, j){ var kk = mod(u - 0.4 - j * 0.7, 2.1) / 2.1; c.setAttribute('r', (60 + kk * 220).toFixed(1)); show(c, (1 - kk) * 0.28); });
      kT.forEach(function(n, j){ n.textContent = tl[j] || ''; var a = 0.5 + j * 0.35, e = eout(seg(u, a, a + 0.45)); show(n, e * fade); tr(n, 'translate(0,' + (18 * (1 - e)).toFixed(1) + ')'); });
    }
    // sous-titre : texte de la voix
    var sl = s.sl || [], vs = s.v0 || 0.35, ve = last ? d + 1 : d - 0.25, os = last ? seg(u, vs, vs + 0.25) : win(u, vs, ve, 0.25);
    subL[0].textContent = sl[0] || ''; subL[1].textContent = sl[1] || '';
    var y1 = sl.length > 1 ? 898 : 914;
    subL[0].setAttribute('y', y1); subL[1].setAttribute('y', 928);
    tr(subG, 'translate(0,' + (k === 'end' ? -146 : 0) + ')');
    show(subG, os);
    // voile aux jonctions
    var dv = 0; for (var j = 1; j < SH.length; j++) dv = Math.max(dv, 1 - Math.abs(T - SH[j].t0) / 0.25);
    show(dip, dv);
    // bouton d'inscription (page web) : quand l'écran final est lisible
    cta.classList.toggle('on', k === 'end' && u > 1.9);
  }
})();
</script>
