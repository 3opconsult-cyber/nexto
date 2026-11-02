  /* Noyau commun aux tutos : helpers, décor et personnage « Marc » repris de brand/anim/src.html
     (mêmes formes, mêmes couleurs, même graine). La chronologie vient du fichier de scène (CFG). */
  var NS = 'http://www.w3.org/2000/svg';
  var $ = function(id){ return document.getElementById(id); };
  function el(tag, attrs, parent){ var n = document.createElementNS(NS, tag); for (var k in attrs) n.setAttribute(k, attrs[k]); if (parent) parent.appendChild(n); return n; }
  function clamp(x,a,b){ a = a==null?0:a; b = b==null?1:b; return Math.max(a, Math.min(b, x)); }
  function seg(t,a,b){ return clamp((t-a)/(b-a)); }
  function eio(x){ return x<.5 ? 4*x*x*x : 1-Math.pow(-2*x+2,3)/2; }
  function eout(x){ return 1-Math.pow(1-x,3); }
  function back(x){ var c1=1.70158, c3=c1+1; return 1+c3*Math.pow(x-1,3)+c1*Math.pow(x-1,2); }
  function win(t,a,b,f){ f = f||.35; return Math.min(seg(t,a,a+f), 1-seg(t,b-f,b)); }
  function mod(a,n){ return ((a%n)+n)%n; }
  function show(n, o){ n.setAttribute('opacity', clamp(o).toFixed(3)); }
  function S(id, o){ show($(id), o); }
  function tr(n, s){ n.setAttribute('transform', s); }
  function hhmm(m){ var h = Math.floor(m/60), mm = Math.round(m%60); if (mm===60){h++;mm=0;} return h+':'+(mm<10?'0':'')+mm; }
  function pulse(id, t, a, b){ var k = seg(t, a, b); $(id).setAttribute('r', (8 + k*26).toFixed(1)); S(id, k > 0 && k < 1 ? 0.55*(1-k) : 0); }

  // ---------- décor procédural (graine fixe : même image à chaque lecture) ----------
  var seed = 7; function rnd(){ seed = (seed*16807) % 2147483647; return (seed-1)/2147483646; }
  var W = 1100;
  var FACADES = ['#EBC48A','#E9AFA0','#F3E4C4','#DE9A76','#F2D592','#E7C9A9'];
  var SHUTTERS = ['#4F8F86','#6C9BB5','#3E7C74','#8AA9B8'];
  function buildCity(g){
    [0, W].forEach(function(ox){
      var tile = el('g', {transform:'translate('+ox+',0)'}, g);
      var x = 0;
      while (x < W - 60) {
        var w = 96 + Math.floor(rnd()*58), h = 250 + Math.floor(rnd()*170);
        if (x + w > W) w = W - x;
        var top = 700 - h, col = FACADES[Math.floor(rnd()*FACADES.length)], sh = SHUTTERS[Math.floor(rnd()*SHUTTERS.length)];
        el('rect', {x:x, y:top, width:w, height:h, fill:col}, tile);
        el('rect', {x:x-3, y:top-8, width:w+6, height:10, fill:'#C9805E'}, tile);
        var cols = Math.max(1, Math.floor((w-20)/40)), rows = Math.max(1, Math.floor((h-70)/58));
        var gx = (w - cols*40)/2 + 8;
        for (var r=0; r<rows; r++) for (var c=0; c<cols; c++){
          var wx = x + gx + c*40, wy = top + 26 + r*58;
          el('rect', {x:wx-6, y:wy, width:5, height:28, fill:sh}, tile);
          el('rect', {x:wx+19, y:wy, width:5, height:28, fill:sh}, tile);
          el('rect', {x:wx, y:wy, width:18, height:28, fill:'#CFE5EC'}, tile);
        }
        el('rect', {x:x + w/2 - 13, y:658, width:26, height:42, rx:3, fill:'#6B5446'}, tile);
        x += w;
        if (rnd() < .45 && x < W - 70) { palm(tile, x + 22); x += 44; }
      }
      if (x < W) el('rect', {x:x, y:400, width:W-x, height:300, fill:'#EBC48A'}, tile);
    });
  }
  function palm(p, x){
    el('rect', {x:x-4, y:540, width:8, height:160, rx:4, fill:'#9C7350'}, p);
    [[-50,-10],[50,-10],[-34,-30],[34,-30],[0,-40]].forEach(function(v){
      el('path', {d:'M'+x+' 540 Q'+(x+v[0]/2)+' '+(540+v[1]-14)+' '+(x+v[0])+' '+(546+v[1]/3), fill:'none', stroke:'#2E8B6E', 'stroke-width':9, 'stroke-linecap':'round'}, p);
    });
  }
  function buildFar(g){
    [0, W].forEach(function(ox){
      var t = el('g', {transform:'translate('+ox+',0)'}, g);
      el('path', {d:'M0 470 Q150 380 300 440 T600 420 T900 450 T1100 430 V700 H0 Z', fill:'#A9CFD6'}, t);
      for (var i=0;i<14;i++){ var bw = 40+rnd()*50, bh = 60+rnd()*90, bx = i*80+rnd()*20; el('rect', {x:bx, y:700-bh-150, width:bw, height:bh+150, fill:'#BFDDE2'}, t); }
    });
  }
  function buildGround(){
    var j = $('joints'), d = $('dashes');
    for (var i=0;i<=Math.ceil(W*2/80);i++) el('rect', {x:i*80, y:702, width:2, height:68, fill:'#DCD0BA'}, j);
    for (var k=0;k<=Math.ceil(W*2/110);k++) el('rect', {x:k*110, y:866, width:54, height:8, rx:4, fill:'#E9EEF0'}, d);
  }
  function buildHouse(g){
    el('rect', {x:0, y:430, width:300, height:270, fill:'#F4E2C8'}, g);
    el('path', {d:'M-16 436 L150 352 L316 436 Z', fill:'#C9704F'}, g);
    el('rect', {x:-16, y:430, width:332, height:10, fill:'#B45F42'}, g);
    [[30,470],[210,470],[210,580]].forEach(function(p){
      el('rect', {x:p[0]-8, y:p[1], width:7, height:52, fill:'#3E7C74'}, g);
      el('rect', {x:p[0]+60, y:p[1], width:7, height:52, fill:'#3E7C74'}, g);
      el('rect', {x:p[0], y:p[1], width:59, height:52, fill:'#CFE5EC'}, g);
    });
    el('rect', {x:80, y:582, width:54, height:118, rx:26, fill:'#12B39C'}, g);
    el('circle', {cx:122, cy:644, r:4, fill:'#F2C94C'}, g);
    el('rect', {x:52, y:684, width:110, height:16, fill:'#D8C9B0'}, g);
    for (var i=0;i<6;i++) el('rect', {x:180+i*20, y:650, width:7, height:50, rx:3, fill:'#fff'}, g);
    el('rect', {x:176, y:664, width:130, height:6, fill:'#fff'}, g);
    el('circle', {cx:300, cy:600, r:40, fill:'#6E9E6A'}, g);
    el('rect', {x:296, y:620, width:8, height:80, fill:'#8A6B4C'}, g);
    if (CFG.paper) {
      // feuille collée sur la porte, avec le QR unique de la mission
      var p = el('g', {id:'paper', opacity:0}, g);
      el('rect', {x:84, y:606, width:46, height:56, rx:3, fill:'#fff', stroke:'#C9BFA8', 'stroke-width':1.4}, p);
      var q = el('g', {transform:'translate(90,611) scale(.36) translate(-68,-140)'}, p);
      el('use', {href:'#qrg'}, q);
    }
  }
  // logotype p·ng (l'épingle remplace le i) — identique à l'animation de référence
  function buildWord(){
    var g = $('word'); g.innerHTML = '';
    var size = 92, y = 640;
    var p = el('text', {y:y, 'font-family':'Quicksand', 'font-weight':700, 'font-size':size, fill:'#fff'}, g); p.textContent = 'p';
    var ng = el('text', {y:y, 'font-family':'Quicksand', 'font-weight':700, 'font-size':size, fill:'#fff'}, g); ng.textContent = 'ng';
    var wp = p.getComputedTextLength(), wn = ng.getComputedTextLength();
    var ph = size*0.74, pw = ph*38/65, gap = size*0.06;
    var total = wp + gap + pw + gap + wn, x0 = 270 - total/2;
    p.setAttribute('x', x0);
    var pin = el('g', {transform:'translate('+(x0+wp+gap)+','+(y-ph)+') scale('+(ph/65)+') translate(-71,-35)'}, g);
    el('path', {d:'M90 100 C84 84, 71 70, 71 54 a19 19 0 1 1 38 0 c0 16 -13 30 -19 46z', fill:'#fff'}, pin);
    el('circle', {cx:90, cy:53, r:8.6, fill:'#2FD06E'}, pin);
    ng.setAttribute('x', x0+wp+gap+pw+gap);
  }

  // ---------- trajectoire de Marc ----------
  function offFinal(){ return CFG.V*CFG.T1 + CFG.V*CFG.D/2; }
  function offset(t){ var V = CFG.V, T1 = CFG.T1, D = CFG.D; if (t<=T1) return V*t; var s = Math.min(t-T1, D); return V*T1 + V*(s - s*s/(2*D)); }
  function speed(t){ if (t<=CFG.T1) return 1; return 1 - Math.min(t-CFG.T1, CFG.D)/CFG.D; }

  var STAR = 'M0 -13 L3.8 -4.2 L13 -4 L5.8 2 L8 11.5 L0 6.2 L-8 11.5 L-5.8 2 L-13 -4 L-3.8 -4.2 Z';
  var stars = [], capLines = [], endRings = [];

  function phoneUp(t){
    var u = 0;
    CFG.phone.forEach(function(w){ var k = eout(seg(t, w[0], w[0]+.6)) * (1 - eio(seg(t, w[1]-.5, w[1]))); if (k > u) u = k; });
    return u;
  }

  function render(t){
    var off = offset(t), v = speed(t);
    tr($('far'), 'translate('+(-mod(off*0.35, W))+',0)');
    tr($('city'), 'translate('+(-mod(off, W))+',0)');
    tr($('joints'), 'translate('+(-mod(off, 80))+',0)');
    tr($('dashes'), 'translate('+(-mod(off*1.25, 110))+',0)');
    tr($('cloudA'), 'translate('+(mod(120 - t*12, 700)-80)+',150)');
    tr($('cloudB'), 'translate('+(mod(420 - t*9, 700)-80)+',215)');
    tr($('house'), 'translate('+((CFG.hx || 125) + offFinal() - off)+',0)');

    // marche (même cadence que l'animation de référence)
    var ph = off/95 * Math.PI * 2 * 0.9, sw = Math.sin(ph) * v;
    var bob = -Math.abs(Math.sin(ph)) * 4 * v;
    tr($('artisan'), 'translate(200,'+bob.toFixed(2)+')');
    tr($('legF'), 'rotate('+(26*sw)+' 0 668)');
    tr($('legB'), 'rotate('+(-26*sw)+' 0 668)');
    tr($('armB'), 'rotate('+(22*sw)+' 0 602)');
    var aF = -10*sw; tr($('armF'), 'rotate('+aF+' 0 602)');
    var rad = aF*Math.PI/180, hx = 0.5 - 54*Math.sin(rad), hy = 602 + 54*Math.cos(rad);
    tr($('bucket'), 'translate('+(hx+2)+','+(hy+14)+')');
    show($('beacon'), 0);

    // téléphone
    var u = phoneUp(t);
    show($('dim'), 0.62 * u);
    tr($('phone'), 'translate(145,'+(980 - (980-238)*u).toFixed(1)+')');
    var w = CFG.who(t);
    if (w) $('whoTx').textContent = w;
    show($('who'), w ? u : 0);
    ['qrShow','scan','ok','clock','rate','gen','pos','cmp','code','type','hour'].forEach(function(id){ if ($(id)) S(id, 0); });
    CFG.draw(t);

    // légende
    var cur = null, co = 0;
    CFG.caps.forEach(function(C, i){ var o = win(t, C.a, C.b, .3); if (i===0) o = Math.min(1, 1 - seg(t, C.b-.3, C.b)); if (o > co) { co = o; cur = C; } });
    if (cur) { capLines[0].textContent = cur.l[0]; capLines[1].textContent = cur.l[1]; }
    capLines[0].setAttribute('y', 104); capLines[1].setAttribute('y', 140);
    tr($('capText'), 'translate(0,'+((1-co)*8).toFixed(1)+')');
    show($('capText'), co);
    var E0 = CFG.end;
    show($('cap'), 1 - seg(t, E0 - .2, E0 + .2));
    $('prog').setAttribute('width', (540*t/CFG.dur).toFixed(1));

    // fin (signature)
    show($('end'), seg(t, E0, E0 + .45));
    var dk = back(seg(t, E0 + .3, E0 + .8)); tr($('device'), 'translate(270,370) scale('+dk.toFixed(3)+')');
    var ex = 270, ey = 370 + (148-95)*1.75;
    endRings.forEach(function(c, i){
      var k = mod(t - (E0 + .6) - i*0.6, 1.8)/1.8;
      c.setAttribute('cx', ex); c.setAttribute('cy', ey); c.setAttribute('r', (14 + k*170).toFixed(1));
      show(c, t > E0 + .6 + i*0.6 ? (1-k)*0.55 : 0);
    });
    [['word',.8],['tag1',1.2],['tag2',1.6],['tag3',2.0],['cta',2.3]].forEach(function(q){
      var k = eout(seg(t, E0 + q[1], E0 + q[1] + 0.45)); show($(q[0]), k); tr($(q[0]), 'translate(0,'+(14*(1-k)).toFixed(1)+')');
    });
  }
