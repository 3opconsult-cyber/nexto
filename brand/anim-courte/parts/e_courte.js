%%PLAYER_JS%%
  // ---------- vidéos courtes (23/11/2026) : /animation-courte-client et /animation-courte-prestataire ----------
  // Rendu déterministe : chaque scène est un pur calcul du temps local u (seek). CFG.scenes vient de brand/anim-courte/scenarios.py (source unique) :
  // msgs = textes à l'écran (une idée par scène, 8 mots par ligne au plus), taps = touchers montrés (le doigt arrive 0,8 s avant, le résultat reste 1,2 s).
  // Même logo (mot « ping », épingle), mêmes couleurs et mêmes polices que les animations d'origine (helpers c_helpers.js).
  var CFG = %%CFG%%;
  var NAVY = '#123644', TEAL = '#12B39C', TEALD = '#0C8F7E', GOLD = '#F2A93B', GREEN = '#2FD06E', GREY = '#4E6470', ORANGE = '#E8743B', LINE = '#DCE5E3';
  IC.shield = 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z|M8.5 12l2.5 2.5L16 9.5';
  IC.qr = 'M4 4h6v6H4z|M14 4h6v6h-6z|M4 14h6v6H4z|M14 14h2.5v2.5H14z|M18 14h2v2|M14 19h2M18 18.5h2v1.5h-3';
  IC.star = 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z';
  IC.house = 'M4 11l8-7 8 7|M6 10v10h12V10|M10 20v-5h4v5';
  IC.iron = 'M3 17h18l-2.5-6.5C17.5 8 15.5 7 13 7H8v10|M3 17v3h18v-3|M12 11h4';
  IC.spark = 'M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z|M19 3v4M17 5h4';
  IC.person = 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8|M4 21c1-4.5 4-6.5 8-6.5s7 2 8 6.5';
  IC.bank = 'M3 9l9-5 9 5|M5 10v7M9.5 10v7M14.5 10v7M19 10v7|M3 20h18';

  ['phone', 'cap', 'capText', 'sep', 'args', 'intro', 'end', 'bgRings', 'partLbl'].forEach(function(id){ var n = $(id); if (n) n.setAttribute('display', 'none'); });
  var svgEl = $('svg'), prog = $('prog'), defs = svgEl.querySelector('defs');
  function layer(attrs){ var g = el('g', attrs || {}); svgEl.insertBefore(g, prog); return g; }
  function lerp(a, b, k){ return a + (b - a) * k; }
  function smooth(x){ return x * x * (3 - 2 * x); }

  // ---------- plan de montage ----------
  var SH = [], TOTAL = 0;
  CFG.scenes.forEach(function(s){ SH.push({ s: s, t0: TOTAL, t1: TOTAL + s.d }); TOTAL += s.d; });
  function shotAt(T){ for (var i = 0; i < SH.length; i++) if (T < SH[i].t1) return i; return SH.length - 1; }

  // ---------- éléments communs ----------
  function pill(p, x, y, w, h, label, fill, col, s){
    var g = el('g', {}, p); el('rect', { x: x, y: y, width: w, height: h, rx: h / 2, fill: fill }, g);
    var t = tx(g, x + w / 2, y + h / 2 + (s || 20) * 0.36, label, { s: s || 20, w: 700, c: col, a: 'middle' }); g.t = t; return g;
  }
  function exTag(p, x, y, label){ return pill(p, x, y, 8 + (label || 'Exemple').length * 12, 36, label || 'Exemple', '#FDEBC8', '#7A4E00', 20); }
  function fit(n, maxw){ var w = n.getComputedTextLength(), s = parseFloat(n.getAttribute('font-size')); if (w > maxw) n.setAttribute('font-size', (s * maxw / w).toFixed(1)); }
  function pinAt(p, x, y, col, k){
    var c = el('g', {}, p), halo = el('circle', { r: 26, fill: col, opacity: 0.2 }, c);
    el('path', { d: 'M0 22 C-7 7 -17 -2 -17 -12 a17 17 0 1 1 34 0 c0 10 -10 19 -17 34z', fill: col }, c);
    el('circle', { cx: 0, cy: -12, r: 6, fill: '#fff' }, c);
    c.px = x; c.py = y; c.halo = halo; return c;
  }
  function popPin(c, u, a){
    var k = back(seg(u, a, a + 0.5)); tr(c, 'translate(' + c.px + ',' + c.py + ') scale(' + k.toFixed(3) + ')'); show(c, seg(u, a, a + 0.2));
    var r = mod(u - a, 1.6) / 1.6; c.halo.setAttribute('r', (22 + 16 * r).toFixed(1)); c.halo.setAttribute('opacity', (0.3 * (1 - r)).toFixed(3));
  }
  function road(g, d, w, col, cas){
    if (cas) el('path', { d: d, fill: 'none', stroke: cas, 'stroke-width': w + 5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
    el('path', { d: d, fill: 'none', stroke: col, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
  }
  // carte aux couleurs PING (celle des animations d'origine : fond vert pâle, eau, routes blanches)
  function mapBrand(g){
    el('rect', { width: 540, height: 960, fill: '#E9F1EA' }, g);
    el('path', { d: 'M330 960 C380 860 460 800 540 780 V960Z', fill: '#CBE6EE' }, g);
    el('rect', { x: 236, y: 548, width: 112, height: 104, rx: 20, fill: '#D3EAD0' }, g);
    el('rect', { x: 50, y: 520, width: 130, height: 120, rx: 20, fill: '#D3EAD0' }, g);
    [150, 330, 520, 700, 860].forEach(function(y, i){ road(g, 'M-10 ' + y + ' Q270 ' + (y + (i % 2 ? 16 : -14)) + ' 550 ' + (y - 6), 12, '#fff'); });
    [70, 210, 360, 450].forEach(function(x, i){ road(g, 'M' + x + ' -10 Q' + (x + (i % 2 ? 12 : -10)) + ' 480 ' + (x + 4) + ' 970', 11, '#fff'); });
    road(g, 'M-10 430 L550 250', 9, '#fff'); road(g, 'M120 960 L330 600', 8, '#fff');
  }
  // carte du suivi : fond clair, routes blanches, grands axes et trajet en jaune
  var RH = [160, 300, 430, 600, 760, 900], RV = [70, 210, 360, 450];
  function mapRoute(g){
    el('rect', { width: 540, height: 960, fill: '#EFECE5' }, g);
    el('path', { d: 'M0 330 C60 300 90 360 150 350 C230 340 250 250 330 240 L330 0 H0Z', fill: '#C9E1EE', opacity: 0.0 }, g);
    el('path', { d: 'M470 960 C470 880 500 840 540 820 V960Z', fill: '#C9E1EE' }, g);
    el('rect', { x: 238, y: 650, width: 100, height: 88, rx: 16, fill: '#D7E9CC' }, g);
    el('rect', { x: 90, y: 330, width: 100, height: 76, rx: 16, fill: '#D7E9CC' }, g);
    el('rect', { x: 376, y: 620, width: 62, height: 120, rx: 14, fill: '#E3DFD4' }, g);
    RH.forEach(function(y, i){ road(g, 'M-10 ' + y + ' H550', i === 1 ? 15 : 11, i === 1 ? '#FFE9A0' : '#fff', i === 1 ? '#E3BC4A' : '#D9D4C7'); });
    RV.forEach(function(x, i){ road(g, 'M' + x + ' -10 V970', i === 2 ? 15 : 11, i === 2 ? '#FFE9A0' : '#fff', i === 2 ? '#E3BC4A' : '#D9D4C7'); });
  }
  function clonedQR(g, x, y, k){
    var q = $('e3').cloneNode(true); q.removeAttribute('id'); var s = q.querySelector('#qrsrc'); if (s) s.removeAttribute('id');
    tr(q, 'translate(' + x + ',' + y + ') scale(' + k + ') translate(-270,-546)'); g.appendChild(q); return q;
  }
  function press(n, k, cx, cy){ sc(n, 1 - 0.07 * Math.sin(Math.PI * k), cx, cy); }
  function appear(n, u, a, d, dy){ var k = eout(seg(u, a, a + (d || 0.35))); show(n, k); tr(n, 'translate(0,' + ((dy == null ? 16 : dy) * (1 - k)).toFixed(1) + ')'); return k; }
  function buildWord(g, size, y, cx){
    g.innerHTML = '';
    var p = el('text', { y: y, 'font-family': 'Quicksand', 'font-weight': 700, 'font-size': size, fill: '#fff' }, g); p.textContent = 'p';
    var ng = el('text', { y: y, 'font-family': 'Quicksand', 'font-weight': 700, 'font-size': size, fill: '#fff' }, g); ng.textContent = 'ng';
    var wp = p.getComputedTextLength(), wn = ng.getComputedTextLength();
    var ph = size * 0.74, pw = ph * 38 / 65, gap = size * 0.06, total = wp + gap + pw + gap + wn, x0 = cx - total / 2;
    p.setAttribute('x', x0);
    var px = x0 + wp + gap, s = ph / 65;
    var pin = el('g', { transform: 'translate(' + px + ',' + (y - ph) + ') scale(' + s + ') translate(-71,-35)' }, g);
    el('path', { d: 'M90 100 C84 84, 71 70, 71 54 a19 19 0 1 1 38 0 c0 16 -13 30 -19 46z', fill: '#fff' }, pin);
    el('circle', { cx: 90, cy: 53, r: 8.6, fill: GREEN }, pin);
    ng.setAttribute('x', x0 + wp + gap + pw + gap);
    return { x: px + (90 - 71) * s, y: y - ph + (53 - 35) * s };
  }

  // ---------- messages à l'écran (textes de scenarios.py) ----------
  function mkMsgs(g, s){
    var items = (s.msgs || []).map(function(m){
      var G = el('g', {}, g), M = G, st = m.style, n = m.lines.length, lt = [], cx = 270, mw = 440, y0;
      if (st === 'cap' || st === 'q' || st === 'a') {
        var h = n * 46 + 34;
        box(G, 24, 40, 492, h, { rx: 26, fill: st === 'q' ? NAVY : '#fff', stroke: 'none', sh: true });
        if (st === 'a') { el('circle', { cx: 74, cy: 40 + h / 2, r: 24, fill: GREEN }, G); icon(G, 'check', 74, 40 + h / 2, 1.2, '#fff', 2.6); cx = 305; mw = 380; }
        lt = m.lines.map(function(L, k){
          return tx(G, cx, 40 + 17 + 34 + k * 46, L, { f: 'Q', s: 33, a: 'middle', c: st === 'q' ? '#fff' : (m.hl === k ? TEALD : NAVY) });
        });
      } else if (st === 'tag' || st === 'tag2') {
        y0 = m.y || (st === 'tag' ? 292 : 496);
        lt = m.lines.map(function(L, k){ return tx(G, 270, y0 + k * 50, L, { f: 'Q', s: st === 'tag' ? 37 : 40, a: 'middle', c: m.hl === k ? GREEN : '#fff' }); });
        mw = 484;
      } else if (st === 'big') {
        y0 = m.y || 372;
        el('rect', { x: 90, y: y0 - 50, width: 360, height: 86, rx: 43, fill: TEAL }, G);
        lt = [tx(G, 270, y0 + 2, m.lines[0], { f: 'Q', s: 44, a: 'middle', c: '#fff' })]; mw = 330;
      } else if (st === 'chip') {
        box(G, 24, 100, 366, 66, { rx: 33, fill: NAVY, stroke: 'none', sh: true });
        el('circle', { cx: 62, cy: 133, r: 10, fill: GREEN }, G);
        G.dot = el('circle', { cx: 62, cy: 133, r: 10, fill: GREEN, opacity: 0.4 }, G);
        lt = [tx(G, 226, 145, m.lines[0], { f: 'Q', s: 34, a: 'middle', c: '#fff' })]; mw = 300;
      } else if (st === 'notif') {
        box(G, 24, 190, 492, 122, { rx: 28, fill: '#fff', stroke: '#E6E1D6', sh: true });
        el('circle', { cx: 82, cy: 251, r: 32, fill: NAVY }, G);
        var pn = el('g', { transform: 'translate(70,236) scale(.34) translate(-71,-35)' }, G);
        el('path', { d: 'M90 100 C84 84, 71 70, 71 54 a19 19 0 1 1 38 0 c0 16 -13 30 -19 46z', fill: '#fff' }, pn); el('circle', { cx: 90, cy: 53, r: 8.6, fill: GREEN }, pn);
        tx(G, 134, 224, 'PING · maintenant', { s: 20, w: 600, c: GREY });
        M = el('g', {}, G);
        lt = m.lines.map(function(L, k){ return tx(M, 134, 256 + k * 32, L, { s: 27, w: 700, c: NAVY }); }); mw = 366;
      }
      lt.forEach(function(t){ fit(t, mw); });
      M.setAttribute('data-msg', s.id + '-' + m.id);
      return { m: m, G: G };
    });
    return function(u){
      items.forEach(function(it){
        var m = it.m, k = seg(u, m.at, m.at + 0.3), o = k, up = m.until ? 1 - seg(u, m.until - 0.25, m.until) : 1;
        o = Math.min(o, up); show(it.G, o); tr(it.G, 'translate(0,' + (14 * (1 - eout(k))).toFixed(1) + ')');
        if (it.G.dot) it.G.dot.setAttribute('r', (10 + 8 * mod(u, 1.2) / 1.2).toFixed(1)), it.G.dot.setAttribute('opacity', (0.5 * (1 - mod(u, 1.2) / 1.2)).toFixed(3));
      });
    };
  }

  // ---------- le doigt : visible 0,8 s avant l'action, le résultat reste 1,2 s ----------
  var FL = null, FG = null;
  function mkFinger(){
    FL = layer({ id: 'finger', opacity: 0 });
    var rip = el('circle', { r: 0, fill: 'none', stroke: TEAL, 'stroke-width': 6 }, FL);
    el('circle', { r: 20, fill: NAVY, opacity: 0.22 }, FL);
    var hand = el('g', { transform: 'rotate(12)' }, FL);
    el('rect', { x: -26, y: 34, width: 56, height: 50, rx: 18, fill: '#fff', stroke: NAVY, 'stroke-width': 3.2 }, hand);
    el('rect', { x: -40, y: 48, width: 22, height: 32, rx: 11, fill: '#fff', stroke: NAVY, 'stroke-width': 3.2, transform: 'rotate(-24 -29 64)' }, hand);
    el('rect', { x: -10, y: 2, width: 20, height: 62, rx: 10, fill: '#fff', stroke: NAVY, 'stroke-width': 3.2 }, hand);
    FG = { g: FL, rip: rip, hand: hand };
  }
  function fingerUpd(u, taps){
    if (!taps.length) { show(FG.g, 0); return; }
    var T = taps.map(function(q){ return q[0]; }), P = taps.map(function(q){ return [q[1], q[2]]; });
    var st = [P[0][0] + 130, P[0][1] + 190], x, y, n = taps.length;
    var A0 = T[0] - 0.8;
    if (u < A0) { var k0 = eio(seg(u, 0, A0)); x = lerp(st[0], P[0][0], k0); y = lerp(st[1], P[0][1], k0); }
    else { x = P[0][0]; y = P[0][1]; }
    for (var i = 0; i < n; i++) {
      if (i + 1 < n) {
        var d0 = T[i] + 0.5, a1 = T[i + 1] - 0.8;
        if (u >= d0 && u < a1) { var k = eio(seg(u, d0, a1)); x = lerp(P[i][0], P[i + 1][0], k); y = lerp(P[i][1], P[i + 1][1], k); }
        else if (u >= a1) { x = P[i + 1][0]; y = P[i + 1][1]; }
      }
    }
    var pr = 0, rp = 0; T.forEach(function(t){ pr = Math.max(pr, Math.sin(Math.PI * seg(u, t - 0.15, t + 0.2))); rp = Math.max(rp, seg(u, t, t + 0.7)); });
    var rr = 0; T.forEach(function(t){ var k2 = seg(u, t, t + 0.7); if (k2 > 0 && k2 < 1) rr = Math.max(rr, k2); });
    var fo = Math.min(seg(u, 0, 0.25), 1 - seg(u, T[n - 1] + 1.0, T[n - 1] + 1.25));
    tr(FG.g, 'translate(' + x.toFixed(1) + ',' + y.toFixed(1) + ')');
    FG.hand.setAttribute('transform', 'rotate(12) translate(0,' + (8 * pr).toFixed(1) + ') scale(' + (1 - 0.06 * pr).toFixed(3) + ')');
    FG.rip.setAttribute('r', (14 + 46 * rr).toFixed(1)); FG.rip.setAttribute('opacity', rr > 0 ? (0.7 * (1 - rr)).toFixed(3) : 0);
    show(FG.g, fo);
  }

  // ---------- constructeurs de scènes : build(g, s) -> update(u) ----------
  var BUILD = {};

  // 1. Accroche : le logo, la tagline, la carte où les gens apparaissent « juste à côté »
  BUILD.hook = function(g, s){
    var pro = CFG.who === 'pro';
    mapBrand(g);
    var pts = pro ? [[110, 610, 'Ménage', TEAL], [400, 580, 'Repassage', TEAL], [170, 830, 'Nettoyage', TEAL], [420, 800, 'Urgent', ORANGE]]
                  : [[110, 610, '200 m', TEAL], [400, 580, '350 m', TEAL], [170, 830, '600 m', TEAL], [420, 800, '450 m', TEAL]];
    var pins = pts.map(function(p){
      var c = pinAt(g, p[0], p[1], p[3]), w = 28 + p[2].length * 11;
      var lb = el('g', {}, g); box(lb, p[0] - w / 2, p[1] + 28, w, 38, { rx: 19, fill: '#fff', stroke: 'none', sh: true }); tx(lb, p[0], p[1] + 54, p[2], { s: 21, w: 700, c: p[3] === ORANGE ? '#B8501F' : NAVY, a: 'middle' });
      c.lb = lb; return c;
    });
    var me = el('g', {}, g), meR = [0, 1].map(function(){ return el('circle', { cx: 270, cy: 720, r: 0, fill: 'none', stroke: TEAL, 'stroke-width': 3 }, me); });
    el('circle', { cx: 270, cy: 720, r: 17, fill: TEAL, stroke: '#fff', 'stroke-width': 5 }, me);
    var vl = el('g', {}, me); box(vl, 228, 744, 84, 36, { rx: 18, fill: NAVY, stroke: 'none' }); tx(vl, 270, 769, 'Vous', { s: 21, w: 700, c: '#fff', a: 'middle' });
    // panneau navy : logo + radar + tagline
    var cp = el('clipPath', { id: 'clipPanel' }, defs); el('rect', { x: -20, y: -60, width: 580, height: 500, rx: 48 }, cp);
    var P = el('g', {}, g);
    el('rect', { x: -20, y: -60, width: 580, height: 510, rx: 48, fill: NAVY }, P);
    var rg = el('g', { 'clip-path': 'url(#clipPanel)' }, P), rings = [0, 1, 2].map(function(){ return el('circle', { r: 0, fill: 'none', stroke: TEAL, 'stroke-width': 2.5 }, rg); });
    var wg = el('g', {}, P), dot = buildWord(wg, 104, 170, 270);
    var msgs = mkMsgs(g, s);
    return function(u){
      var wk = back(seg(u, 0.1, 0.8)); tr(wg, 'translate(' + dot.x + ',' + dot.y + ') scale(' + wk.toFixed(3) + ') translate(' + (-dot.x) + ',' + (-dot.y) + ')');
      rings.forEach(function(c, i){ var k = mod(u - 0.5 - i * 0.7, 2.1) / 2.1; c.setAttribute('cx', dot.x); c.setAttribute('cy', dot.y); c.setAttribute('r', (14 + k * 260).toFixed(1)); show(c, u > 0.5 + i * 0.7 ? (1 - k) * 0.5 : 0); });
      pins.forEach(function(c, i){ var a = 1.0 + i * 0.45; popPin(c, u, a); show(c.lb, seg(u, a + 0.2, a + 0.5)); });
      meR.forEach(function(c, i){ var k = mod(u - 0.4 - i * 0.9, 1.8) / 1.8; c.setAttribute('r', (18 + k * 120).toFixed(1)); show(c, (1 - k) * 0.5 * seg(u, 0.4, 0.8)); });
      show(me, seg(u, 0.4, 0.8)); show(vl, seg(u, 0.5, 0.9));
      msgs(u);
    };
  };

  // 2. Crainte client : « Un inconnu chez vous ? » -> profil vérifié par PING
  BUILD.trust = function(g, s){
    el('rect', { width: 540, height: 960, fill: '#EAF3F1' }, g);
    el('circle', { cx: 270, cy: 560, r: 300, fill: '#DCEEEA', opacity: 0.6 }, g);
    var card = el('g', {}, g); box(card, 40, 240, 460, 600, { rx: 34, sh: true, stroke: 'none' });
    exTag(card, 358, 258);
    var A = el('g', {}, g), B = el('g', {}, g);
    el('circle', { cx: 270, cy: 430, r: 96, fill: '#DDE6E4' }, A); el('circle', { cx: 270, cy: 405, r: 32, fill: '#B7C6C2' }, A);
    el('path', { d: 'M200 500 C205 450 335 450 340 500 A96 96 0 0 1 200 500Z', fill: '#B7C6C2' }, A);
    tx(A, 270, 468, '?', { f: 'Q', s: 80, c: GREY, a: 'middle' });
    [[170, 600, 200], [150, 640, 240], [200, 680, 140]].forEach(function(r){ el('rect', { x: r[0], y: r[1], width: r[2], height: 22, rx: 11, fill: '#E3EBE9' }, A); });
    el('circle', { cx: 270, cy: 430, r: 96, fill: TEAL }, B); tx(B, 270, 462, 'C', { f: 'Q', s: 96, c: '#fff', a: 'middle' });
    var bd = el('g', {}, B); el('circle', { cx: 340, cy: 500, r: 34, fill: GREEN, stroke: '#fff', 'stroke-width': 6 }, bd); icon(bd, 'shield', 340, 500, 1.3, '#fff', 2.2);
    tx(B, 270, 596, 'Camille R.', { f: 'Q', s: 40, a: 'middle' });
    var st = starRow(B, 270, 646, 1.5); tx(B, 270, 698, 'Avis des clients', { s: 24, w: 600, c: GREY, a: 'middle' });
    var c1 = pill(B, 90, 716, 360, 52, 'Pièce d’identité fournie', '#DDF5F0', TEALD, 26), c2 = pill(B, 90, 780, 360, 52, 'Assurance renseignée', '#DDF5F0', TEALD, 26);
    fit(c1.t, 330); fit(c2.t, 330);
    var msgs = mkMsgs(g, s), tB = s.msgs[1].at - 0.1;
    return function(u){
      var kA = 1 - seg(u, tB - 0.2, tB + 0.1), kB = seg(u, tB, tB + 0.4);
      show(A, kA); show(B, kB); sc(B, 0.92 + 0.08 * back(seg(u, tB, tB + 0.5)), 270, 430);
      st.forEach(function(p, i){ show(p, seg(u, tB + 0.2 + i * 0.06, tB + 0.3 + i * 0.06)); });
      show(c1, seg(u, tB + 0.3, tB + 0.5)); show(c2, seg(u, tB + 0.4, tB + 0.6));
      show(bd, seg(u, tB + 0.1, tB + 0.3)); sc(bd, back(seg(u, tB + 0.1, tB + 0.6)), 340, 500);
      msgs(u);
    };
  };

  // 3. Quatre appuis : Trouver un prestataire, Ménage, Voir les prestataires, Réserver (parcours réel de la carte du particulier)
  BUILD.find = function(g, s){
    var T = s.taps.map(function(q){ return q[0]; });
    mapBrand(g);
    var pins = [[110, 560], [400, 520], [170, 760], [430, 690]].map(function(p){ return pinAt(g, p[0], p[1], TEAL); });
    var dots = [1, 2, 3, 4].map(function(n, i){
      var c = el('g', {}, g), x = 270 + (i - 1.5) * 62;
      var ci = el('circle', { cx: x, cy: 176, r: 22, fill: '#fff', stroke: LINE, 'stroke-width': 3 }, c);
      var tt = tx(c, x, 185, String(n), { f: 'Q', s: 26, a: 'middle', c: GREY });
      c.ci = ci; c.tt = tt; return c;
    });
    var bt = btn(g, 270, 868, 456, 88, 'Trouver un prestataire', { s: 31 }); bt.setAttribute('filter', 'url(#sh)');
    // feuille
    var S = el('g', {}, g); box(S, 0, 470, 540, 560, { rx: 44, sh: true, stroke: 'none' });
    el('rect', { x: 235, y: 484, width: 70, height: 7, rx: 3.5, fill: '#D5DFDD' }, S);
    tx(S, 36, 548, 'Trouver un prestataire', { f: 'Q', s: 31 });
    var A = el('g', {}, S), tiles = [['Ménage', 'house'], ['Repassage', 'iron'], ['Nettoyage', 'spark']].map(function(q, i){
      var c = el('g', {}, A), x = 24 + i * 176;
      var r = box(c, x, 580, 164, 200, { rx: 26, fill: '#fff', stroke: LINE, sw: 3 });
      var bgc = el('circle', { cx: x + 82, cy: 664, r: 44, fill: '#DDF5F0' }, c); var ic = icon(c, q[1], x + 82, 664, 2.1, TEALD, 1.9);
      tx(c, x + 82, 752, q[0], { f: 'Q', s: 28, a: 'middle' }); c.r = r; c.bgc = bgc; c.ic = ic; c.cx = x + 82; return c;
    });
    var Bg = el('g', {}, S), opts = [['Dès que possible', true], ['Aujourd’hui', false], ['Choisir une date', false]].map(function(q, i){
      var c = el('g', {}, Bg), y = 580 + i * 80;
      box(c, 24, y, 492, 68, { rx: 20, fill: q[1] ? '#EEF9F7' : '#fff', stroke: q[1] ? TEAL : LINE, sw: q[1] ? 3 : 2 });
      el('circle', { cx: 66, cy: y + 34, r: 14, fill: q[1] ? TEAL : '#fff', stroke: q[1] ? TEAL : '#B8C9C5', 'stroke-width': 3 }, c); if (q[1]) el('circle', { cx: 66, cy: y + 34, r: 5, fill: '#fff' }, c);
      tx(c, 100, y + 45, q[0], { f: 'Q', s: 29 }); return c;
    });
    var bV = btn(Bg, 270, 876, 492, 80, 'Voir les prestataires', { s: 31 });
    var C = el('g', {}, S);
    box(C, 24, 580, 492, 190, { rx: 28, fill: 'rgba(18,179,156,.06)', stroke: TEAL, sw: 3 });
    el('circle', { cx: 92, cy: 675, r: 44, fill: INK }, C); tx(C, 92, 692, 'C', { f: 'Q', s: 50, c: '#fff', a: 'middle' });
    tx(C, 160, 656, 'Camille R.', { f: 'Q', s: 35 }); tx(C, 160, 700, '4,9 ★ · 400 m', { s: 26, w: 600, c: GREY });
    pill(C, 160, 718, 140, 38, 'Disponible', '#DDF5F0', TEALD, 21);
    var bR = btn(C, 270, 876, 492, 84, 'Réserver · 60 €', { s: 33 });
    var D = el('g', {}, g);
    el('rect', { width: 540, height: 960, fill: '#fff' }, D);
    el('circle', { cx: 270, cy: 330, r: 82, fill: '#DDF5F0' }, D); icon(D, 'check', 270, 330, 3.6, TEAL, 2.4);
    tx(D, 270, 500, 'Prix validé', { f: 'Q', s: 54, a: 'middle' }); tx(D, 270, 620, '60 €', { f: 'Q', s: 118, a: 'middle', c: TEALD });
    tx(D, 270, 700, 'Ménage', { s: 32, w: 600, c: GREY, a: 'middle' });
    var msgs = mkMsgs(g, s);
    return function(u){
      pins.forEach(function(c, i){ popPin(c, u, 0.4 + i * 0.2); });
      show(bt, 1);
      dots.forEach(function(c, i){ var on = u >= T[i] + 0.15; c.ci.setAttribute('fill', on ? TEAL : '#fff'); c.ci.setAttribute('stroke', on ? TEAL : LINE); c.tt.setAttribute('fill', on ? '#fff' : GREY); });
      press(bt, seg(u, T[0] - 0.15, T[0] + 0.25), 270, 868);
      var so = eout(seg(u, T[0] + 0.1, T[0] + 0.7)); tr(S, 'translate(0,' + (560 * (1 - so)).toFixed(1) + ')');
      show(A, Math.min(seg(u, T[0] + 0.15, T[0] + 0.4), 1 - seg(u, T[1] + 0.02, T[1] + 0.17)));
      tiles.forEach(function(c, i){ var on = i === 0 && u >= T[1] - 0.02; c.r.setAttribute('stroke', on ? TEAL : LINE); c.r.setAttribute('fill', on ? '#EEF9F7' : '#fff'); c.bgc.setAttribute('fill', on ? TEAL : '#DDF5F0'); c.ic.setAttribute('stroke', on ? '#fff' : TEALD); });
      press(tiles[0], seg(u, T[1] - 0.15, T[1] + 0.25), tiles[0].cx, 680);
      show(Bg, Math.min(seg(u, T[1] + 0.05, T[1] + 0.25), 1 - seg(u, T[2] + 0.02, T[2] + 0.17))); press(bV, seg(u, T[2] - 0.15, T[2] + 0.25), 270, 876);
      show(C, Math.min(seg(u, T[2] + 0.05, T[2] + 0.25), 1 - seg(u, T[3] + 0.02, T[3] + 0.17))); press(bR, seg(u, T[3] - 0.15, T[3] + 0.25), 270, 876);
      var dk = seg(u, T[3] + 0.05, T[3] + 0.4); show(D, dk); tr(D, 'translate(' + (60 * (1 - eout(dk))).toFixed(1) + ',0)');
      msgs(u);
    };
  };

  // 4. En route : carte aux routes jaunes, camionnette, horodateur, notification (scène factice marquée « Exemple de suivi »)
  BUILD.route = function(g, s){
    mapRoute(g);
    var PTS = [[70, 900], [70, 760], [210, 760], [210, 600], [360, 600], [360, 430], [450, 430]];
    var d = 'M' + PTS.map(function(p){ return p[0] + ' ' + p[1]; }).join(' L');
    var rc = el('path', { d: d, fill: 'none', stroke: '#C98F00', 'stroke-width': 28, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
    var rt = el('path', { d: d, fill: 'none', stroke: '#FFC400', 'stroke-width': 20, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
    var rp = el('path', { d: d, fill: 'none', stroke: '#BDB6A3', 'stroke-width': 20, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
    var L = rt.getTotalLength(); rp.setAttribute('stroke-dasharray', '0 ' + (L + 50));
    var dest = pinAt(g, 450, 430, NAVY); tr(dest, 'translate(450,418)'); dest.px = 450; dest.py = 418;
    var dl = el('g', {}, g); pill(dl, 350, 338, 168, 40, 'Chez vous', NAVY, '#fff', 21);
    var van = el('g', {}, g);
    el('circle', { r: 36, fill: '#fff', filter: 'url(#shs)' }, van);
    el('rect', { x: -24, y: -14, width: 30, height: 24, rx: 5, fill: TEAL }, van);
    el('path', { d: 'M8 -14 h9 l8 9 v15 h-17z', fill: TEALD }, van); el('path', { d: 'M12 -10 h4 l5 6 h-9z', fill: '#DDF5F0' }, van);
    [[-13, 11], [14, 11]].forEach(function(w){ el('circle', { cx: w[0], cy: w[1], r: 6.5, fill: NAVY }, van); el('circle', { cx: w[0], cy: w[1], r: 2.4, fill: '#fff' }, van); });
    var tg = el('g', {}, g); exTag(tg, 24, 40, 'Exemple de suivi');
    var msgs = mkMsgs(g, s);
    return function(u){
      var k = seg(u, 0.6, 6.4), p = 0.65 * k + 0.35 * smooth(k), len = L * p, pt = rt.getPointAtLength(len);
      rp.setAttribute('stroke-dasharray', len.toFixed(1) + ' ' + (L + 50));
      tr(van, 'translate(' + pt.x.toFixed(1) + ',' + (pt.y - 4 + 2 * Math.sin(u * 14)).toFixed(1) + ')');
      var arr = seg(u, 6.2, 6.6); var r = mod(u, 1.4) / 1.4;
      dest.halo.setAttribute('r', (24 + 30 * r).toFixed(1)); dest.halo.setAttribute('opacity', (0.35 * (1 - r)).toFixed(3));
      tr(dest, 'translate(450,418) scale(' + (1 + 0.12 * Math.sin(Math.PI * arr)).toFixed(3) + ')');
      show(tg, seg(u, 0.1, 0.4));
      msgs(u);
    };
  };

  // 5. Arrivée, départ, notes croisées
  BUILD.times = function(g, s){
    el('rect', { width: 540, height: 960, fill: '#EAF3F1' }, g);
    var card = el('g', {}, g); box(card, 40, 230, 460, 560, { rx: 34, sh: true, stroke: 'none' }); exTag(card, 358, 246);
    el('path', { d: 'M96 330 V470', stroke: '#C6D8D4', 'stroke-width': 5, 'stroke-linecap': 'round' }, card);
    function evt(y, label, time, ic){
      var c = el('g', {}, g); el('circle', { cx: 96, cy: y, r: 36, fill: '#DDF5F0' }, c); icon(c, ic, 96, y, 1.5, TEALD, 2);
      tx(c, 156, y + 12, label, { f: 'Q', s: 38 }); tx(c, 464, y + 12, time, { f: 'Q', s: 38, c: TEALD, a: 'end' });
      var ck = el('g', {}, c); el('circle', { cx: 96, cy: y, r: 36, fill: GREEN }, ck); icon(ck, 'check', 96, y, 1.4, '#fff', 2.6); c.ck = ck; return c;
    }
    var e1 = evt(330, 'Arrivée', '15:00', 'qr'), e2 = evt(470, 'Départ', '17:00', 'qr');
    el('rect', { x: 70, y: 540, width: 400, height: 3, fill: '#E2ECEA' }, g);
    var r1 = el('g', {}, g), r2 = el('g', {}, g);
    tx(r1, 70, 612, 'Client', { f: 'Q', s: 32 }); var s1 = starRow(r1, 380, 600, 1.15);
    tx(r2, 70, 722, 'Prestataire', { f: 'Q', s: 32 }); var s2 = starRow(r2, 380, 710, 1.15);
    var msgs = mkMsgs(g, s);
    return function(u){
      appear(e1, u, 0.8, 0.3, 20); appear(e2, u, 1.8, 0.3, 20);
      show(e1.ck, seg(u, 1.2, 1.5)); show(e2.ck, seg(u, 2.2, 2.5));
      appear(r1, u, 2.5, 0.3, 16); appear(r2, u, 3.0, 0.3, 16);
      s1.forEach(function(p, i){ show(p, seg(u, 2.8 + i * 0.08, 2.95 + i * 0.08)); }); s2.forEach(function(p, i){ show(p, seg(u, 3.3 + i * 0.08, 3.45 + i * 0.08)); });
      msgs(u);
    };
  };

  // 6. Paiement : sous séquestre (SEQUESTRE = True) ou par virement, prix validé
  BUILD.pay = function(g, s){
    var seq = CFG.sequestre;
    el('rect', { width: 540, height: 960, fill: NAVY }, g);
    var rg = [0, 1, 2].map(function(){ return el('circle', { cx: 270, cy: 560, r: 0, fill: 'none', stroke: TEAL, 'stroke-width': 2 }, g); });
    var cx0 = 100, cx1 = 440, cy = 560;
    el('path', { d: 'M110 560 H430', stroke: '#2A5566', 'stroke-width': 6, 'stroke-dasharray': '4 12', 'stroke-linecap': 'round' }, g);
    var L = el('g', {}, g); el('circle', { cx: cx0, cy: cy, r: 50, fill: '#1E4352' }, L); icon(L, 'person', cx0, cy, 2.2, '#fff', 1.8); tx(L, cx0, cy + 86, 'Vous', { f: 'Q', s: 28, c: '#fff', a: 'middle' });
    var R = el('g', {}, g); el('circle', { cx: cx1, cy: cy, r: 50, fill: '#1E4352' }, R); icon(R, 'house', cx1, cy, 2.2, '#fff', 1.8); tx(R, cx1, cy + 86, 'Prestataire', { f: 'Q', s: 28, c: '#fff', a: 'middle' });
    var V = el('g', {}, g); el('circle', { cx: 270, cy: cy, r: 66, fill: seq ? '#1E4352' : '#1E4352', stroke: seq ? GREEN : TEAL, 'stroke-width': 4 }, V);
    icon(V, seq ? 'lock' : 'bank', 270, cy - 14, 1.9, GREEN, 1.8); tx(V, 270, cy + 40, '60 €', { f: 'Q', s: 32, c: '#fff', a: 'middle' });
    var coin = el('g', {}, g); el('circle', { r: 18, fill: GOLD }, coin); tx(coin, 0, 7, '€', { f: 'Q', s: 22, c: '#7A4E00', a: 'middle' });
    var msgs = mkMsgs(g, s);
    return function(u){
      rg.forEach(function(c, i){ var k = mod(u - 0.4 - i * 0.8, 2.4) / 2.4; c.setAttribute('r', (70 + k * 200).toFixed(1)); show(c, u > 0.4 ? (1 - k) * 0.25 : 0); });
      appear(L, u, 0.7, 0.35, 14); appear(R, u, 0.9, 0.35, 14); appear(V, u, 0.8, 0.4, 14);
      var k = seg(u, 1.3, 2.3), kk = seq ? k : seg(u, 1.3, 3.0);
      var x = lerp(cx0 + 56, seq ? 270 : cx1 - 56, eio(kk)); tr(coin, 'translate(' + x.toFixed(1) + ',' + cy + ')'); show(coin, seg(u, 1.2, 1.4) * (seq ? 1 - seg(u, 2.3, 2.5) : 1 - seg(u, 3.0, 3.2)));
      sc(V, 1 + 0.08 * Math.sin(Math.PI * seg(u, 2.3, 2.7)), 270, cy);
      msgs(u);
    };
  };

  // Pro 2. Crainte : impayés, rendez-vous perdus -> prix validé, paiement sous séquestre
  BUILD.mission = function(g, s){
    el('rect', { width: 540, height: 960, fill: '#EAF3F1' }, g);
    var card = el('g', {}, g); box(card, 40, 260, 460, 520, { rx: 34, sh: true, stroke: 'none' }); exTag(card, 358, 278);
    tx(card, 76, 360, 'Ménage', { f: 'Q', s: 44 }); tx(card, 76, 408, '3 h', { s: 28, w: 600, c: GREY });
    var A = el('g', {}, g), B = el('g', {}, g);
    tx(A, 270, 580, '? €', { f: 'Q', s: 132, c: '#B6C5C2', a: 'middle' }); pill(A, 175, 640, 190, 50, 'En attente', '#EDF1F0', GREY, 24);
    tx(B, 270, 580, '60 €', { f: 'Q', s: 132, c: TEALD, a: 'middle' });
    var lk = el('g', {}, B); el('circle', { cx: 440, cy: 470, r: 40, fill: GREEN }, lk); icon(lk, 'lock', 440, 470, 1.8, '#fff', 2.2);
    pill(B, 175, 640, 190, 50, 'Réservé', '#DDF5F0', TEALD, 26);
    var msgs = mkMsgs(g, s), tB = s.msgs[1].at - 0.1;
    return function(u){
      show(A, 1 - seg(u, tB - 0.2, tB + 0.1)); show(B, seg(u, tB, tB + 0.4)); sc(lk, back(seg(u, tB + 0.2, tB + 0.7)), 440, 470);
      msgs(u);
    };
  };

  // Pro 3. QR à l'arrivée et au départ
  BUILD.scan = function(g, s){
    el('rect', { width: 540, height: 960, fill: '#EAF3F1' }, g);
    var card = el('g', {}, g); box(card, 90, 240, 360, 360, { rx: 34, sh: true, stroke: 'none' });
    clonedQR(g, 270, 420, 1.55);
    var scan = el('rect', { x: 100, y: 260, width: 340, height: 6, rx: 3, fill: TEAL, opacity: 0.85 }, g);
    var ex = exTag(g, 374, 250);
    function pl(y, label, time){
      var c = el('g', {}, g); box(c, 40, y, 460, 84, { rx: 28, fill: '#fff', stroke: '#BDE7DF', sw: 3, sh: true });
      el('circle', { cx: 92, cy: y + 42, r: 26, fill: GREEN }, c); icon(c, 'check', 92, y + 42, 1.2, '#fff', 2.6);
      tx(c, 140, y + 54, label, { f: 'Q', s: 36 }); tx(c, 470, y + 54, time, { f: 'Q', s: 36, c: TEALD, a: 'end' }); return c;
    }
    var p1 = pl(660, 'Arrivée', '14:00'), p2 = pl(766, 'Départ', '16:00');
    var msgs = mkMsgs(g, s);
    return function(u){
      var ph = u < 2.4 ? seg(u, 0.8, 1.9) : seg(u, 3.0, 4.0), on = u < 2.4 ? seg(u, 0.7, 0.9) * (1 - seg(u, 1.85, 2.0)) : seg(u, 3.0, 3.1) * (1 - seg(u, 3.9, 4.0));
      tr(scan, 'translate(0,' + (320 * (0.5 - 0.5 * Math.cos(Math.PI * ph))).toFixed(1) + ')'); show(scan, on);
      appear(p1, u, 1.9, 0.4, 20);
      appear(p2, u, 4.0, 0.4, 20);
      msgs(u);
    };
  };

  // Pro 4. Demandes autour de moi (le prestataire touche une demande)
  BUILD.demands = function(g, s){
    var T = s.taps[0][0];
    mapBrand(g);
    var pts = [[110, 470, '800 m', TEAL], [400, 470, '1,9 km', TEAL], [170, 700, '2,4 km', TEAL], [328, 560, '1,2 km', ORANGE]];
    var pins = pts.map(function(p){
      var c = pinAt(g, p[0], p[1], p[3]), w = 28 + p[2].length * 11, lb = el('g', {}, g);
      box(lb, p[0] - w / 2, p[1] + 28, w, 38, { rx: 19, fill: '#fff', stroke: 'none', sh: true }); tx(lb, p[0], p[1] + 54, p[2], { s: 21, w: 700, c: NAVY, a: 'middle' }); c.lb = lb; return c;
    });
    var me = el('g', {}, g); el('circle', { cx: 270, cy: 400, r: 15, fill: NAVY, stroke: '#fff', 'stroke-width': 5 }, me);
    var C = el('g', {}, g); box(C, 24, 690, 492, 230, { rx: 32, sh: true, stroke: 'none' });
    pill(C, 52, 716, 104, 38, 'Urgent', ORANGE, '#fff', 22); tx(C, 52, 800, 'Ménage', { f: 'Q', s: 44 }); tx(C, 52, 846, 'À 1,2 km', { s: 28, w: 600, c: GREY });
    var rb = btn(C, 392, 810, 200, 76, 'Répondre', { s: 30 });
    var msgs = mkMsgs(g, s);
    return function(u){
      pins.forEach(function(c, i){ var a = 0.9 + i * 0.35; popPin(c, u, a); show(c.lb, seg(u, a + 0.2, a + 0.5)); });
      show(me, seg(u, 0.5, 0.9));
      var k = eout(seg(u, T + 0.15, T + 0.65)); show(C, k); tr(C, 'translate(0,' + (240 * (1 - k)).toFixed(1) + ')');
      msgs(u);
    };
  };

  // Pro 5. Disponible maintenant
  BUILD.online = function(g, s){
    var T = s.taps[0][0];
    mapBrand(g);
    var rings = [0, 1, 2].map(function(){ return el('circle', { cx: 270, cy: 560, r: 0, fill: 'none', stroke: TEAL, 'stroke-width': 3 }, g); });
    el('circle', { cx: 270, cy: 560, r: 17, fill: TEAL, stroke: '#fff', 'stroke-width': 5 }, g);
    var pp = [[110, 430], [410, 450]].map(function(p){ return pinAt(g, p[0], p[1], TEAL); });
    var C = el('g', {}, g); box(C, 24, 690, 492, 200, { rx: 34, sh: true, stroke: 'none' });
    var dot = el('circle', { cx: 70, cy: 760, r: 13, fill: '#C0503A' }, C);
    var off = tx(C, 100, 772, 'Hors ligne', { f: 'Q', s: 40, c: GREY }), on = tx(C, 100, 772, 'Disponible maintenant', { f: 'Q', s: 36 }); fit(on, 262);
    var tog = el('rect', { x: 376, y: 746, width: 108, height: 62, rx: 31, fill: '#CDD6D3' }, C), knob = el('circle', { cx: 407, cy: 777, r: 25, fill: '#fff', filter: 'url(#shs)' }, C);
    tx(C, 100, 836, 'Visible sur la carte', { s: 26, w: 600, c: GREY });
    var msgs = mkMsgs(g, s);
    return function(u){
      var k = eio(seg(u, T, T + 0.35)), isOn = u >= T + 0.05;
      tog.setAttribute('fill', isOn ? GOLD : '#CDD6D3'); knob.setAttribute('cx', (407 + 70 * k).toFixed(1)); dot.setAttribute('fill', isOn ? TEAL : '#C0503A');
      show(off, 1 - seg(u, T, T + 0.2)); show(on, seg(u, T + 0.1, T + 0.4));
      press(tog, seg(u, T - 0.15, T + 0.25), 430, 777);
      rings.forEach(function(c, i){ var kk = mod(u - T - 0.2 - i * 0.6, 1.8) / 1.8; c.setAttribute('r', (18 + kk * 230).toFixed(1)); show(c, u > T + 0.2 + i * 0.6 ? (1 - kk) * 0.55 : 0); });
      pp.forEach(function(c, i){ popPin(c, u, T + 0.5 + i * 0.3); });
      msgs(u);
    };
  };

  // Pro 6. Payé et noté
  BUILD.paid = function(g, s){
    el('rect', { width: 540, height: 960, fill: '#EAF3F1' }, g);
    var card = el('g', {}, g); box(card, 40, 250, 460, 540, { rx: 34, sh: true, stroke: 'none' }); exTag(card, 358, 268);
    var ck = el('g', {}, g); el('circle', { cx: 270, cy: 370, r: 62, fill: GREEN }, ck); icon(ck, 'check', 270, 370, 2.8, '#fff', 2.4);
    var t1 = tx(g, 270, 506, 'Paiement reçu', { f: 'Q', s: 44, a: 'middle' }), t2 = tx(g, 270, 600, '60 €', { f: 'Q', s: 84, c: TEALD, a: 'middle' });
    el('rect', { x: 90, y: 640, width: 360, height: 3, fill: '#E2ECEA' }, g);
    var r = el('g', {}, g); tx(r, 270, 698, 'Avis du client', { f: 'Q', s: 30, a: 'middle', c: GREY }); var st = starRow(r, 270, 744, 1.5);
    var msgs = mkMsgs(g, s);
    return function(u){
      show(ck, seg(u, 0.8, 1.1)); sc(ck, back(seg(u, 0.8, 1.4)), 270, 370); appear(t1, u, 1.2, 0.4, 16); appear(t2, u, 1.5, 0.4, 16);
      appear(r, u, 2.6, 0.4, 16); st.forEach(function(p, i){ show(p, seg(u, 3.0 + i * 0.15, 3.25 + i * 0.15)); });
      msgs(u);
    };
  };

  // Dernier plan : logo, « Activer PING » / « Inscrivez-vous », la phrase, QR, adresse
  BUILD.final = function(g, s){
    el('rect', { width: 540, height: 960, fill: NAVY }, g);
    var cp = el('clipPath', { id: 'clipFinal' }, defs); el('rect', { width: 540, height: 960 }, cp);
    var rg = el('g', { 'clip-path': 'url(#clipFinal)' }, g), rings = [0, 1, 2].map(function(){ return el('circle', { r: 0, fill: 'none', stroke: TEAL, 'stroke-width': 2.5 }, rg); });
    var wg = el('g', {}, g), dot = buildWord(wg, 104, 215, 270);
    var qr = clonedQR(g, 270, 628, 1.0);
    var url = tx(g, 270, 770, 'nexto-eta.vercel.app/l/' + CFG.code, { s: 22, w: 600, c: GREEN, a: 'middle' });
    var sv = tx(g, 270, 806, 'Ménage · repassage · nettoyage', { s: 22, w: 600, c: '#B7CBD1', a: 'middle' });
    var msgs = mkMsgs(g, s);
    return function(u){
      var wk = back(seg(u, 0.1, 0.8)); tr(wg, 'translate(' + dot.x + ',' + dot.y + ') scale(' + wk.toFixed(3) + ') translate(' + (-dot.x) + ',' + (-dot.y) + ')');
      rings.forEach(function(c, i){ var k = mod(u - 0.5 - i * 0.7, 2.1) / 2.1; c.setAttribute('cx', dot.x); c.setAttribute('cy', dot.y); c.setAttribute('r', (14 + k * 300).toFixed(1)); show(c, u > 0.5 + i * 0.7 ? (1 - k) * 0.4 : 0); });
      var k2 = seg(u, 1.0, 1.4); show(qr, k2); show(url, seg(u, 1.4, 1.8)); show(sv, seg(u, 1.6, 2.0));
      msgs(u);
    };
  };
  var INK = NAVY;

  // ---------- montage ----------
  var dip = null, cta = $('cta'), subEl = document.getElementById('sub'), CC = { on: /[?&]st=1\b/.test(location.search), btn: null };
  function addCC(){
    var tp = document.querySelector('.transport'); if (!tp || CC.btn) return;
    var b = document.createElement('button'); b.type = 'button'; b.id = 'cc';
    b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" style="fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M8 11h2.5M8 14.5h6M13.5 11H16"/></svg><span>Sous-titres</span>';
    function set(){ b.setAttribute('aria-pressed', CC.on ? 'true' : 'false'); }
    b.addEventListener('click', function(){ CC.on = !CC.on; set(); if (window.PING_ANIM) window.PING_ANIM.seek(window.PING_ANIM.time); });
    tp.appendChild(b); CC.btn = b; set();
  }

  // ---------- voix off : fichier mp3 si présent ; sinon muette (essai ?voix=nav : voix de l'appareil) ----------
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
      var u = new SpeechSynthesisUtterance(CFG.scenes[i].v); u.lang = 'fr-FR'; u.rate = 0.95;
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
    dur: TOTAL, speed: 1, still: 3.0,
    scenes: SH.map(function(q, i){ return { a: q.t0, go: q.t0 + (i ? 0.3 : 0.01), title: q.s.lib, d: q.s.desc }; }),
    init: function(){
      mkFinger();   // le calque du doigt est replacé au-dessus des scènes juste après leur création
      SH.forEach(function(q){ q.g = layer(); q.upd = BUILD[q.s.kind](q.g, q.s); });
      svgEl.insertBefore(FL, prog);
      dip = el('rect', { id: 'dip', x: 0, y: 0, width: 540, height: 960, fill: NAVY, opacity: 0 }); svgEl.insertBefore(dip, prog);
      addCC();
      window.PING_DBG = { scenes: SH.map(function(q){ return { id: q.s.id, t0: q.t0, d: q.s.d, taps: q.s.taps || [] }; }), total: TOTAL };
    },
    onFrame: voiceFrame, onState: voiceState,
    paint: function(T){ draw(T); }
  });
  function draw(T){
    if (!SH[0].upd) return;
    var i = shotAt(T), q = SH[i], u = T - q.t0, s = q.s;
    SH.forEach(function(r, j){ r.g.setAttribute('display', j === i ? 'inline' : 'none'); });
    q.upd(u); fingerUpd(u, (s.taps || []).map(function(t){ return t; }));
    prog.setAttribute('width', (540 * T / TOTAL).toFixed(1));
    var dv = 0; for (var j = 1; j < SH.length; j++) dv = Math.max(dv, 1 - Math.abs(T - SH[j].t0) / 0.25);
    show(dip, dv);
    cta.classList.toggle('on', s.kind === 'final' && u > 1.9);
    if (subEl) {
      var vs = s.v0 || 0.35, ve = s.kind === 'final' ? s.d : s.d - 0.25, on = CC.on && u >= vs && u < ve;
      subEl.innerHTML = on ? s.sl.map(function(L){ return '<span>' + L.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</span>'; }).join('<br>') : '';
      subEl.classList.toggle('on', on); subEl.classList.toggle('up', s.kind === 'final');
    }
  }
})();
</script>
