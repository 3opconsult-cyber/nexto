  var NS = 'http://www.w3.org/2000/svg';
  var $ = function(id){ return document.getElementById(id); };
  function el(tag, attrs, parent){ var n = document.createElementNS(NS, tag); for (var k in attrs) n.setAttribute(k, attrs[k]); if (parent) parent.appendChild(n); return n; }
  function clamp(x,a,b){ a = a==null?0:a; b = b==null?1:b; return Math.max(a, Math.min(b, x)); }
  function seg(t,a,b){ return clamp((t-a)/(b-a)); }
  function eio(x){ return x<.5 ? 4*x*x*x : 1-Math.pow(-2*x+2,3)/2; }
  function eout(x){ return 1-Math.pow(1-x,3); }
  function back(x){ var c1=1.70158, c3=c1+1; return 1+c3*Math.pow(x-1,3)+c1*Math.pow(x-1,2); }
  function win(t,a,b,f){ f = f||.3; return Math.min(seg(t,a,a+f), 1-seg(t,b-f,b)); }
  function show(n, o){ n.setAttribute('opacity', clamp(o).toFixed(3)); }
  function tr(n, s){ n.setAttribute('transform', s); }
  function mod(a,n){ return ((a%n)+n)%n; }
  function hhmm(m){ var h = Math.floor(m/60), mm = Math.round(m%60); if (mm===60){h++;mm=0;} return h+':'+(mm<10?'0':'')+mm; }
  // scale autour d'un point
  function sc(n, k, cx, cy){ tr(n, 'translate('+cx+','+cy+') scale('+k.toFixed(3)+') translate('+(-cx)+','+(-cy)+')'); }

  // ---------- texte, cartes, pictogrammes ----------
  function tx(p, x, y, s, o){
    o = o || {};
    var n = el('text', {x:x, y:y, 'font-family': o.f === 'Q' ? 'Quicksand' : 'Inter', 'font-weight': o.w || (o.f === 'Q' ? 700 : 400),
      'font-size': o.s || 13, fill: o.c || '#123644'}, p);
    if (o.a) n.setAttribute('text-anchor', o.a);
    if (o.it) n.setAttribute('font-style', 'italic');
    if (o.ls) n.setAttribute('letter-spacing', o.ls);
    n.textContent = s; return n;
  }
  function box(p, x, y, w, h, o){ o = o || {};
    var a = {x:x, y:y, width:w, height:h, rx: o.rx == null ? 16 : o.rx, fill: o.fill || '#fff'};
    if (o.stroke !== 'none') { a.stroke = o.stroke || '#E2ECEA'; a['stroke-width'] = o.sw || 1.2; }
    if (o.dash) a['stroke-dasharray'] = o.dash;
    if (o.sh) a.filter = 'url(#shs)';
    return el('rect', a, p);
  }
  // Pictogrammes au trait sur une grille 24 × 24 (pas d'emoji : règle de Romain).
  var IC = {
    check: 'M5 12.5l4.5 4.5L19 7.5',
    chev: 'M9.5 6l6 6-6 6',
    lock: 'M6 11h12v10H6z|M8.5 11V8a3.5 3.5 0 0 1 7 0v3',
    pin: 'M12 21c-3-4-7-7.5-7-11.5a7 7 0 0 1 14 0c0 4-4 7.5-7 11.5z|M12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5',
    cal: 'M4 6h16v14H4z|M4 10h16|M8 3v5M16 3v5',
    bell: 'M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z|M10 20.5a2 2 0 0 0 4 0',
    chart: 'M4 19h16|M7 16v-5|M12 16V7|M17 16v-8',
    idc: 'M3 6h18v12H3z|M7 14.5c.6-1.4 1.8-2 3-2s2.4.6 3 2|M10 11a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6|M15 10h3M15 13h2',
    bank: 'M3 9l9-5 9 5|M5 10v7M9.5 10v7M14.5 10v7M19 10v7|M3 20h18',
    tag: 'M3 12V4h8l10 10-8 8z|M7.5 8.5h.01',
    ruler: 'M4 4l16 16|M4 4v16h16',
    euro: 'M17 6.5a6.5 6.5 0 1 0 0 11|M4 10.5h9M4 13.5h9',
    clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18|M12 7v5l3 2',
    doc: 'M6 2.5h8.5l4 4v15H6z|M14.5 2.5v4h4|M9 12h6.5M9 15.5h4.5',
    plus: 'M12 5v14M5 12h14'
  };
  function icon(p, name, cx, cy, s, c, w){
    s = s || 1; var g = el('g', {transform:'translate('+(cx-12*s)+','+(cy-12*s)+') scale('+s+')', fill:'none', stroke: c || '#0C8F7E',
      'stroke-width': w || 1.9, 'stroke-linecap':'round', 'stroke-linejoin':'round'}, p);
    IC[name].split('|').forEach(function(d){ el('path', {d:d}, g); });
    return g;
  }
  var STAR = 'M0 -13 L3.8 -4.2 L13 -4 L5.8 2 L8 11.5 L0 6.2 L-8 11.5 L-5.8 2 L-13 -4 L-3.8 -4.2 Z';
  function starRow(p, cx, cy, k){
    var out = [];
    for (var i = 0; i < 5; i++){ var g = el('g', {transform:'translate('+(cx + (i-2)*32)+','+cy+') scale('+k+')'}, p);
      el('path', {d:STAR, fill:'#E2ECEA'}, g); out.push(el('path', {d:STAR, fill:'#F2A93B'}, g)); }
    return out;
  }
  function header(p, title, sub){
    el('rect', {x:12, y:12, width:316, height:82, fill:'#fff'}, p);
    el('rect', {x:12, y:93, width:316, height:1, fill:'#E2ECEA'}, p);
    tx(p, 40, 36, '9:41', {s:11.5, w:600});
    tx(p, 170, sub ? 64 : 70, title, {f:'Q', s:18, a:'middle'});
    if (sub) tx(p, 170, 83, sub, {s:11.5, c:'#4E6470', a:'middle'});
  }
  function chip(p, x, y, label, o){
    o = o || {}; var w = o.w || (label.length * 6.4 + 20);
    var g = el('g', {}, p);
    var r = el('rect', {x:x, y:y, width:w, height: o.h || 22, rx: (o.h || 22)/2, fill: o.fill || '#DDF5F0'}, g);
    var t = tx(g, x + w/2, y + (o.h || 22)/2 + 4, label, {s: o.s || 11, w:600, c: o.c || '#0C8F7E', a:'middle'});
    g.r = r; g.t = t; g.w = w; return g;
  }
  function btn(p, cx, cy, w, h, label, o){
    o = o || {}; var g = el('g', {}, p);
    var r = el('rect', {x:cx - w/2, y:cy - h/2, width:w, height:h, rx:h/2, fill: o.fill || '#12B39C'}, g);
    if (o.stroke) { r.setAttribute('stroke', o.stroke); r.setAttribute('stroke-width', 1.6); }
    var t = tx(g, cx, cy + 5, label, {f:'Q', s: o.s || 15, c: o.c || '#fff', a:'middle'});
    g.r = r; g.t = t; return g;
  }

