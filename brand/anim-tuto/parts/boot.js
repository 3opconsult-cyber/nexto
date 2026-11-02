  // ---------- mise en route ----------
  for (var s=0; s<5; s++){
    var sg = el('g', {transform:'translate('+(65+s*30)+',162)'}, $('stars'));
    el('path', {d:STAR, fill:'#E2ECEA'}, sg);
    stars.push(el('path', {d:STAR, fill:'#F2A93B'}, sg));
  }
  for (var cl=0; cl<2; cl++) capLines.push(el('text', {x:270, 'text-anchor':'middle', 'font-family':'Quicksand', 'font-weight':700, 'font-size':28, fill:'#123644'}, $('capText')));
  for (var e=0; e<3; e++) endRings.push(el('circle', {cx:270, cy:370+(148-95)*1.75, r:0, 'stroke-width':2.5}, $('endRings')));
  buildFar($('far')); buildCity($('city')); buildGround(); buildHouse($('house'));
  $('tag1').textContent = CFG.tags[0]; $('tag2').textContent = CFG.tags[1]; $('tag3').textContent = CFG.tags[2];
  if (CFG.init) CFG.init();

  // ---------- lecteur (identique à l'animation de référence) ----------
  var list = $('scenes'), sceneBtns = [];
  var PANEL = CFG.caps.map(function(C){ return { at: C.a, S: C }; }).concat([{ at: CFG.end, S: { title:'Signature', d: CFG.endDesc } }]);
  PANEL.forEach(function(P, i){
    var li = document.createElement('li'), b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = '<span class="tc">'+P.at.toFixed(1).replace('.',',')+' s</span><span><b></b><span class="d"></span></span>';
    b.querySelector('b').textContent = (i+1)+'. '+P.S.title; b.querySelector('.d').textContent = P.S.d;
    b.addEventListener('click', function(){ seek(P.at + 0.01); playing = true; sync(); });
    li.appendChild(b); list.appendChild(li); sceneBtns.push(b);
  });
  var t = 0, playing = !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches), last = null;
  var rec = location.hash === '#record';
  if (rec) { document.body.classList.add('rec'); playing = false; }
  var REAL = CFG.dur;
  function seek(x){ t = clamp(x, 0, REAL); paint(); }
  function paint(){
    render(t);
    $('scrub').value = t; $('tc').textContent = t.toFixed(1).replace('.',',')+' s';
    sceneBtns.forEach(function(b, i){ var nx = i + 1 < PANEL.length ? PANEL[i+1].at : REAL + 1; b.classList.toggle('on', t >= PANEL[i].at && t < nx); });
  }
  function sync(){ $('play').textContent = playing ? 'Pause' : 'Lecture'; }
  function loop(now){
    if (playing) { if (last != null) { t += (now-last)/1000; if (t >= REAL) t = 0; } paint(); }
    last = now; requestAnimationFrame(loop);
  }
  $('play').addEventListener('click', function(){ playing = !playing; sync(); });
  $('replay').addEventListener('click', function(){ seek(0); playing = true; sync(); });
  $('scrub').addEventListener('input', function(e){ playing = false; sync(); seek(parseFloat(e.target.value)); });
  $('scrub').max = REAL;
  window.PING_ANIM = { duration: REAL, seek: function(x){ seek(x); } };
  var start = function(){ buildWord(); paint(); sync(); if (!rec) requestAnimationFrame(loop); window.PING_ANIM.ready = true; };
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(start); else start();
  if (!playing && !rec) seek(CFG.still);
