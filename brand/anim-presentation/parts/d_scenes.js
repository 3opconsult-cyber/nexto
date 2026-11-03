  /* RUBRIQUES (ordre figé : ?scene=N sur /animation-ping, N = rang ci-dessous ; ne pas réordonner, /aide s'y réfère).
     Tableau de référence : var UI plus bas. Contrat d'URL du lecteur (brand/anim/player.js) :
     ?admin=1 panneau scénario · ?embed=1 lecteur seul + rubriques repliables (postMessage {ping:'anim-ended'} à la fin)
     · ?scene=N démarre au début de la rubrique N · ?autoplay=0 démarre en pause · ?speed=0.75|0.85|1.
      1. Accroche  (à 0 s)
      2. La carte  (à 4.6 s)
      3. Le chat et le prix  (à 10.8 s)
      4. Agenda et facture  (à 14.8 s)
      5. Je cherche un prestataire  (à 20.2 s)
      6. Je suis prestataire  (à 30.8 s)
      7. Moins de factures, plus de services  (à 43.2 s)
      8. Moins de paperasse, plus de travail  (à 46.2 s)
      9. Moins d’administratif, plus de productif  (à 49.2 s)
     10. QR de sécurité : l’heure fait foi  (à 52.2 s)
     11. Prestataires et clients se notent  (à 55.2 s)
     12. Service litige  (à 58.2 s)
     13. Paiement sécurisé : bientôt  (à 61.2 s)
     14. Final  (à 64.2 s)
  */

  var QRN = %%QR_N%%;
  IC.mail = 'M3 5h18v14H3z|M3 7l9 6 9-6';
  IC.search = 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14|M16.5 16.5L21 21';
  IC.link = 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1|M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1';
  IC.back = 'M15 6l-6 6 6 6';
  IC.eye = 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z|M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6';
  IC.folder = 'M3 6.5h6.5l2 2.5H21v10.5H3z';
  IC.qr = 'M4 4h6v6H4z|M14 4h6v6h-6z|M4 14h6v6H4z|M14 14h2.5v2.5H14z|M18 14h2v2|M14 19h2M18 18.5h2v1.5h-3';
  IC.star = 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z';
  IC.scales = 'M12 3v18M5 7h14|M5 7l-3 7a3.2 3.2 0 0 0 6 0L5 7z|M19 7l-3 7a3.2 3.2 0 0 0 6 0l-3-7z';
  var NAVY = '#123644', TEAL = '#12B39C', INK = '#123644', GREY = '#4E6470', ORANGE = '#E8743B', GOLD = '#F2A93B';
  var S = {};

  function bgNavy(g){ return el('rect', {x:12, y:12, width:316, height:656, fill:NAVY}, g); }
  function input(g, x, y, w, label, val, o){
    o = o || {};
    tx(g, x, y, label, {s:11.5, w:700, c:GREY});
    var r = box(g, x, y + 7, w, 36, {rx:10, fill:'#F6F9F8', stroke:'#DCE5E3', sw:1.3});
    var t = tx(g, x + 12, y + 30, '', {s:13.5, w:500});
    return {r:r, t:t, full:val, a:o.a, b:o.b, y:y};
  }
  function typing(f, t){
    if (!f || f.a == null) return;
    var k = seg(t, f.a, f.b), n = Math.floor(f.full.length * k + 0.0001);
    f.t.textContent = f.full.slice(0, n);
    var on = t >= f.a - 0.05 && t < f.b + 0.35;
    f.r.setAttribute('stroke', on ? TEAL : '#DCE5E3'); f.r.setAttribute('stroke-width', on ? 1.8 : 1.3);
  }
  function press(n, k, cx, cy){ sc(n, 1 - 0.06*Math.sin(Math.PI*k), cx, cy); }
  function appear(n, t, a, d, dy){ var k = eout(seg(t, a, a + (d || 0.4))); show(n, k); tr(n, 'translate(0,'+((dy == null ? 14 : dy)*(1-k)).toFixed(1)+')'); return k; }
  function pill(p, x, y, w, h, label, fill, col, s){
    var g = el('g', {}, p); el('rect', {x:x, y:y, width:w, height:h, rx:h/2, fill:fill}, g);
    tx(g, x + w/2, y + h/2 + (s || 11)*0.36, label, {s:s || 11, w:700, c:col, a:'middle'}); return g;
  }
  function row(g, y, label, sub, o){
    o = o || {};
    var h = sub ? 56 : 46, c = el('g', {}, g);
    box(c, 24, y, 292, h, {rx:14, fill:o.fill || '#fff', stroke:o.stroke || '#E7EDEB', sw:o.sw || 1.2});
    tx(c, 40, y + (sub ? 24 : 28), label, {f:'Q', s:14.5});
    if (sub) tx(c, 40, y + 42, sub, {s:11, c:o.subc || GREY});
    icon(c, 'chev', 296, y + h/2, .62, '#9DB4BC', 2.4);
    return c;
  }

  // ---------- carte (particulier) : même dessin pour la présentation et le tuto ----------
  function buildMap(g, o){
    el('rect', {x:12, y:12, width:316, height:656, fill:'#E9F1EA'}, g);
    el('path', {d:'M200 668 C230 560 270 520 328 500 V668 Z', fill:'#CBE6EE'}, g);
    [['M12 210 L328 150', 9], ['M60 12 L130 668', 9], ['M12 400 L328 360', 7], ['M230 12 L200 668', 7], ['M12 560 L200 520', 6]].forEach(function(r){
      el('path', {d:r[0], fill:'none', stroke:'#fff', 'stroke-width':r[1], 'stroke-linecap':'round'}, g); });
    box(g, 24, 50, 292, 44, {rx:22, sh:true, stroke:'none'});
    icon(g, 'search', 50, 72, .75, GREY, 2); tx(g, 70, 77, 'Que cherchez-vous ?', {s:13.5, c:'#6E8592'});
    var m = {};
    m.chips = [['Ménage', 24], ['Repassage', 100], ['Nettoyage', 192]].map(function(q){ return chip(g, q[1], 104, q[0], {w: q[0].length*7 + 24, h:28, s:12.5, fill:'#fff', c:INK}); });
    m.pins = [[88, 250], [190, 300], [262, 210], [140, 420]].map(function(p, i){
      var c = el('g', {}, g);
      var halo = el('circle', {r:22, fill:TEAL, opacity:.2}, c);
      el('path', {d:'M0 18 C-6 6 -14 -2 -14 -10 a14 14 0 1 1 28 0 c0 8 -8 16 -14 28z', fill: i === 1 ? '#0C8F7E' : TEAL}, c);
      el('circle', {cx:0, cy:-10, r:5, fill:'#fff'}, c);
      c.px = p[0]; c.py = p[1]; c.halo = halo; return c;
    });
    m.ask = btn(g, 170, 468, 232, 44, '+ Déposer une demande', {s:14.5});
    var pc = el('g', {}, g); m.card = pc;
    box(pc, 24, 524, 292, 124, {rx:20, sh:true, stroke:'none'});
    el('circle', {cx:58, cy:560, r:20, fill:INK}, pc); tx(pc, 58, 567, 'C', {f:'Q', s:19, c:'#fff', a:'middle'});
    tx(pc, 88, 556, 'Camille R.', {f:'Q', s:16}); tx(pc, 88, 575, 'Ménage · 60 € le forfait · 400 m', {s:11.5, c:GREY});
    chip(pc, 40, 592, 'Disponible', {w:84, h:22, s:11, fill:'#DDF5F0', c:'#0C8F7E'});
    m.contact = btn(pc, 250, 616, 112, 36, 'Contacter', {s:14});
    tx(pc, 142, 608, '4,9 ★', {s:11.5, w:600, c:GREY});
    return m;
  }
  function mapAnim(m, t, a, o){   // a = début des épingles ; o.chipAt = temps du toucher sur la puce
    m.pins.forEach(function(c, i){ var k = back(seg(t, a + i*0.18, a + 0.5 + i*0.18)); tr(c, 'translate('+c.px+','+c.py+') scale('+k.toFixed(3)+')'); show(c, seg(t, a + i*0.18, a + 0.2 + i*0.18));
      c.halo.setAttribute('r', (20 + 10*mod(t - a - i*0.4, 1.4)/1.4).toFixed(1)); c.halo.setAttribute('opacity', (0.28*(1 - mod(t - a - i*0.4, 1.4)/1.4)).toFixed(3)); });
    m.chips.forEach(function(c, i){ var on = i === 0 && (o.chipAt == null || t >= o.chipAt); c.r.setAttribute('fill', on ? TEAL : '#fff'); c.t.setAttribute('fill', on ? '#fff' : INK); });
  }

  // ---------- 1. carte (présentation) ----------
  (function(){
    S.m1 = buildMap($('sMap'), {});
  })();

  // ---------- 2. « Demandes autour de moi » (côté prestataire) ----------
  (function(){
    var g = $('sDem');
    el('rect', {x:12, y:12, width:316, height:656, fill:'#E9F1EA'}, g);
    el('path', {d:'M200 320 C230 300 270 280 328 270 V320 Z', fill:'#CBE6EE'}, g);
    [['M12 150 L328 100 L328 100', 9], ['M70 12 L110 330', 9], ['M12 250 L328 220', 7], ['M240 12 L230 330', 7]].forEach(function(r){
      el('path', {d:r[0], fill:'none', stroke:'#fff', 'stroke-width':r[1], 'stroke-linecap':'round'}, g); });
    box(g, 44, 46, 252, 38, {rx:19, sh:true, stroke:'none'});
    tx(g, 170, 70, 'Demandes autour de moi', {f:'Q', s:14.5, a:'middle'});
    S.dPins = [[96, 160, TEAL], [188, 210, ORANGE], [258, 140, TEAL], [140, 262, TEAL]].map(function(p){
      var c = el('g', {}, g);
      var halo = el('circle', {r:20, fill:p[2], opacity:.2}, c);
      el('path', {d:'M0 18 C-6 6 -14 -2 -14 -10 a14 14 0 1 1 28 0 c0 8 -8 16 -14 28z', fill:p[2]}, c);
      el('circle', {cx:0, cy:-10, r:5, fill:'#fff'}, c);
      c.px = p[0]; c.py = p[1]; c.halo = halo; c.col = p[2]; return c;
    });
    box(g, 12, 318, 316, 380, {rx:26, sh:true, stroke:'none'});
    el('circle', {cx:36, cy:350, r:6, fill:TEAL}, g);
    tx(g, 52, 355, 'Disponible maintenant', {f:'Q', s:14.5});
    box(g, 266, 338, 44, 26, {rx:13, fill:GOLD, stroke:'none'}); el('circle', {cx:297, cy:351, r:10, fill:'#fff'}, g);
    tx(g, 28, 392, 'Demandes ouvertes autour de vous', {s:12.5, c:GREY}); tx(g, 312, 392, '3', {s:13, w:700, a:'end'});
    S.dCards = [['Ménage · appartement, 3 h', 'À 1,2 km · budget 60 à 80 €', true, 412], ['Repassage · 4 kg de linge', 'À 2,4 km · budget 25 €', false, 504]].map(function(q){
      var c = el('g', {}, g), y = q[3];
      box(c, 24, y, 292, 80, {rx:16, fill:'#fff', stroke: q[2] ? '#F3C3A8' : '#E7EDEB', sw:1.4});
      var x = 40;
      if (q[2]) { pill(c, 40, y + 14, 52, 20, 'Urgent', ORANGE, '#fff', 11); x = 100; }
      tx(c, x, y + 29, q[0], {f:'Q', s: q[2] ? 12.5 : 14});
      tx(c, 40, y + 58, q[1], {s:12, c:GREY});
      icon(c, 'chev', 296, y + 40, .62, '#9DB4BC', 2.4);
      c.y = y; return c;
    });
    S.dCards[1].remove = 0;
  })();

  // ---------- 3. chat : prix proposé puis validé ----------
  (function(){
    var g = $('sChat');
    el('rect', {x:12, y:12, width:316, height:656, fill:'#F6F9F8'}, g);
    header(g, 'Camille R.', 'Ménage');
    var b1 = el('g', {}, g); S.cb1 = b1;
    box(b1, 24, 108, 196, 44, {rx:14, fill:'#fff', stroke:'#E7EDEB'});
    tx(b1, 38, 127, 'Bonjour, je suis libre', {s:12}); tx(b1, 38, 143, 'samedi matin.', {s:12});
    var b2 = el('g', {}, g); S.cb2 = b2;
    box(b2, 140, 162, 176, 32, {rx:14, fill:TEAL, stroke:'none'}); tx(b2, 154, 183, 'Parfait, quel tarif ?', {s:12, c:'#fff', w:600});
    var oc = el('g', {}, g); S.cOffer = oc;
    box(oc, 24, 206, 292, 176, {rx:16, fill:'#fff', stroke:TEAL, sw:1.6});
    el('rect', {x:38, y:220, width:22, height:22, rx:7, fill:'rgba(18,179,156,.12)'}, oc); icon(oc, 'check', 49, 231, .5, '#0C8F7E', 2.6);
    tx(oc, 68, 236, 'DEVIS', {s:10.5, w:700, c:'#0C8F7E', ls:.6});
    tx(oc, 38, 270, 'Ménage, 3 h', {s:12, c:GREY});
    tx(oc, 302, 274, '70,00 €', {f:'Q', s:23, a:'end'});
    var bt = el('g', {}, oc); S.cBtns = bt;
    S.cRefaire = btn(bt, 108, 342, 148, 36, 'Refaire une proposition', {fill:'#fff', stroke:'#DCE5E3', c:GREY, s:11});
    S.cAccept = btn(bt, 244, 342, 112, 36, 'Accepter', {s:13});
    var ok = el('g', {}, oc); S.cOk = ok;
    icon(ok, 'check', 52, 340, .55, '#0C8F7E', 3); tx(ok, 66, 345, 'Accepté — appliqué à la mission', {s:12.5, w:700, c:'#0C8F7E'});
    var rd = el('g', {}, g); S.cRdv = rd;
    box(rd, 24, 394, 292, 196, {rx:18, sh:true, stroke:'#E2ECEA'});
    tx(rd, 40, 424, 'Fixez le rendez-vous', {f:'Q', s:16});
    box(rd, 40, 440, 260, 34, {rx:10, fill:'#F6F9F8', stroke:'#DCE5E3', sw:1.3}); icon(rd, 'pin', 58, 457, .62, GREY, 2); tx(rd, 74, 462, '12 rue de la Paix, Antibes', {s:12.5, w:500});
    box(rd, 40, 482, 260, 34, {rx:10, fill:'#F6F9F8', stroke:'#DCE5E3', sw:1.3}); icon(rd, 'cal', 58, 499, .62, GREY, 2); tx(rd, 74, 504, 'Samedi, 14 h', {s:12.5, w:500});
    S.cConfirm = btn(rd, 170, 556, 260, 38, 'Confirmer le rendez-vous', {s:13.5});
    box(g, 24, 618, 292, 36, {rx:18, fill:'#fff', stroke:'#DCE5E3'}); tx(g, 42, 641, 'Votre message', {s:12.5, c:'#9DB4BC'});
  })();

  // ---------- 4. agenda ----------
  (function(){
    var g = $('sAgenda'); header(g, 'Agenda');
    tx(g, 28, 120, 'À VENIR', {s:11, w:700, c:GREY, ls:.5});
    function ag(y, d1, d2, title, sub, lab, bg, fg, hi){
      var c = el('g', {}, g);
      box(c, 24, y, 292, 84, {rx:16, fill:'#fff', stroke: hi ? TEAL : '#E7EDEB', sw: hi ? 1.8 : 1.2});
      el('rect', {x:38, y:y + 14, width:52, height:56, rx:12, fill:'#E8F8F4'}, c);
      tx(c, 64, y + 34, d1, {s:11, w:700, c:'#0C8F7E', a:'middle'}); tx(c, 64, y + 61, d2, {f:'Q', s:22, a:'middle'});
      tx(c, 104, y + 34, title, {f:'Q', s:14.5}); tx(c, 104, y + 54, sub, {s:12, c:GREY});
      var w = lab.length*6.3 + 18; pill(c, 104, y + 60, w, 18, lab, bg, fg, 10.5);
      return c;
    }
    S.agNew = ag(134, 'SAM.', '14', 'Ménage · Camille R.', '14 h · Antibes', 'Confirmé', 'rgba(18,179,156,.12)', '#0C8F7E', true);
    S.agB = ag(230, 'MAR.', '17', 'Repassage · Julien B.', '9 h · Cannes', 'Confirmé', 'rgba(18,179,156,.12)', '#0C8F7E', false);
    tx(g, 28, 350, 'PASSÉS', {s:11, w:700, c:GREY, ls:.5});
    S.agC = ag(364, 'JEU.', '5', 'Nettoyage · Net Azur', '10 h · Antibes', 'Effectuée', 'rgba(18,179,156,.12)', '#0C8F7E', false);
  })();

  // ---------- 5. facture automatique ----------
  (function(){
    var g = $('sFact'); header(g, 'Facture', 'Ménage · Camille R.');
    var c = el('g', {}, g); S.fCard = c;
    box(c, 24, 110, 292, 232, {rx:18, sh:true, stroke:'#E2ECEA'});
    tx(c, 40, 140, 'Prestation', {f:'Q', s:16});
    S.fChip = pill(c, 214, 124, 88, 22, 'Automatique', '#DDF5F0', '#0C8F7E', 11);
    el('rect', {x:40, y:158, width:260, height:1, fill:'#E7EDEB'}, c);
    tx(c, 40, 188, 'Ménage, 3 h', {s:13, w:600}); tx(c, 300, 188, '70,00 €', {s:13, w:600, a:'end'});
    tx(c, 40, 210, 'Tarif validé dans le chat', {s:11.5, c:GREY});
    el('rect', {x:40, y:228, width:260, height:1, fill:'#E7EDEB'}, c);
    tx(c, 40, 262, 'Total', {f:'Q', s:17}); tx(c, 300, 262, '70,00 €', {f:'Q', s:24, a:'end'});
    S.fPdf = btn(c, 170, 308, 260, 38, 'Télécharger le PDF', {s:14});
    var c2 = el('g', {}, g); S.fFee = c2;
    box(c2, 24, 356, 292, 60, {rx:14, fill:'#fff', stroke:'#E7EDEB'});
    tx(c2, 40, 382, 'Frais de service PING', {s:12.5, w:600}); tx(c2, 40, 400, 'Relevé distinct, 8 %', {s:11.5, c:GREY}); tx(c2, 300, 392, '5,60 €', {s:13, w:700, a:'end'});
    var c3 = el('g', {}, g); S.fPay = c3;
    box(c3, 24, 430, 292, 74, {rx:14, fill:'#F1F7F6', stroke:'none'});
    icon(c3, 'bank', 50, 467, .85, '#0C8F7E', 1.8);
    tx(c3, 76, 459, 'Règlement par virement', {s:13, w:700}); tx(c3, 76, 478, 'directement au prestataire,', {s:11.5, c:GREY}); tx(c3, 76, 494, 'référence de la facture.', {s:11.5, c:GREY});
  })();

  // ---------- 6. ouvrir le lien : QR ----------
  (function(){
    var g = $('sQR');
    el('rect', {x:12, y:12, width:316, height:656, fill:'#0B1F27'}, g);
    tx(g, 40, 36, '9:41', {s:11.5, w:600, c:'#9DB4BC'});
    el('rect', {x:62, y:190, width:216, height:216, rx:22, fill:'#fff'}, g);
    el('use', {href:'#qrsrc', transform:'translate(78,206) scale('+(184/QRN).toFixed(4)+')'}, g);
    var sl = el('g', {}, g); S.scanline = sl;
    el('rect', {x:62, y:-3, width:216, height:6, fill:'#2FD06E', filter:'url(#glow)', opacity:.9}, sl);
    el('rect', {x:62, y:-1.2, width:216, height:2.4, fill:'#2FD06E'}, sl);
    el('g', {fill:'none', stroke:'#2FD06E', 'stroke-width':4.5, 'stroke-linecap':'round'}, g).innerHTML =
      '<path d="M50 218 V178 H90"/><path d="M250 178 H290 V218"/><path d="M290 378 V418 H250"/><path d="M90 418 H50 V378"/>';
    tx(g, 170, 468, 'Scannez le QR code', {f:'Q', s:19, c:'#fff', a:'middle'});
    tx(g, 170, 492, 'ou ouvrez le lien reçu', {s:13, c:'#9DB4BC', a:'middle'});
    var nb = el('g', {}, g); S.banner = nb;
    box(nb, 26, 48, 288, 62, {rx:18, fill:'#fff', stroke:'none'});
    el('circle', {cx:58, cy:79, r:18, fill:'#DDF5F0'}, nb); icon(nb, 'link', 58, 79, .78, '#0C8F7E', 2);
    tx(nb, 86, 74, 'nexto-eta.vercel.app', {s:13.5, w:700}); tx(nb, 86, 93, 'Ouvrir l’inscription PING', {s:12, c:GREY});
  })();

  // ---------- 7. créer son compte (2 étapes) ----------
  function signupFrame(g, step){
    bgNavy(g);
    el('circle', {cx:170, cy:60, r:16, fill:TEAL}, g); icon(g, 'pin', 170, 60, .72, '#fff', 2);
    var tg = el('g', {}, g);
    el('rect', {x:70, y:88, width:200, height:34, rx:17, fill:'#2B5160'}, tg);
    el('rect', {x:74, y:92, width:96, height:26, rx:13, fill:TEAL}, tg);
    tx(tg, 122, 109, 'Particulier', {f:'Q', s:13, c:'#fff', a:'middle'}); tx(tg, 220, 109, 'Professionnel', {f:'Q', s:13, c:'#9DB4BC', a:'middle'});
    box(g, 24, 128, 292, 504, {rx:24, stroke:'none'});
    if (step === 2) { el('circle', {cx:50, cy:152, r:13, fill:'#F3F6F5'}, g); icon(g, 'back', 50, 152, .62, INK, 2.6); }
    el('rect', {x:72, y:150, width:108, height:4, rx:2, fill:TEAL}, g);
    el('rect', {x:188, y:150, width:108, height:4, rx:2, fill: step === 2 ? TEAL : '#E7EDEB'}, g);
    tx(g, 42, 192, step === 1 ? 'Vos informations' : 'Finaliser', {f:'Q', s:20}); tx(g, 42, 212, 'Étape '+step+' sur 2', {s:11.5, w:700, c:GREY});
  }
  (function(){
    var g = $('sSign'), g1 = el('g', {}, g), g2 = el('g', {}, g); S.sg1 = g1; S.sg2 = g2;
    signupFrame(g1, 1);
    S.f1 = [input(g1, 42, 244, 118, 'Prénom', 'Sophie', {a:23.6, b:23.95}), input(g1, 172, 244, 124, 'Nom', 'Martin', {a:23.95, b:24.3}),
            input(g1, 42, 312, 254, 'Téléphone', '06 12 34 56 78', {a:24.3, b:24.45})];
    S.b1 = btn(g1, 170, 580, 252, 46, 'Continuer', {});
    signupFrame(g2, 2);
    S.f2 = [input(g2, 42, 244, 254, 'Email', 'sophie@exemple.fr', {a:24.9, b:25.4}), input(g2, 42, 312, 254, 'Mot de passe', '••••••••', {a:25.4, b:25.8})];
    box(g2, 42, 384, 254, 84, {rx:13, fill:'#E7F6F3', stroke:'none'});
    S.chk = box(g2, 54, 398, 18, 18, {rx:5, fill:'#fff', stroke:'#9FC9C1', sw:1.6}); S.chkMark = icon(g2, 'check', 63, 407, .5, '#fff', 3.4);
    ['J’accepte les Conditions Générales', 'et la Politique de confidentialité', 'de PING'].forEach(function(s, i){ tx(g2, 82, 410 + i*17, s, {s:11.5, w:600, c:'#0C8F7E'}); });
    S.b2 = btn(g2, 170, 580, 252, 46, 'Créer mon compte', {});
  })();

  // ---------- 8. carte : choisir le service, contacter / déposer une demande ----------
  (function(){ S.m2 = buildMap($('sMapT'), {}); })();

  // ---------- 9. Mon profil : devenir prestataire ----------
  (function(){
    var g = $('sProf'); header(g, 'Mon profil');
    box(g, 24, 106, 292, 70, {rx:18, sh:true, stroke:'#E2ECEA'});
    el('circle', {cx:60, cy:141, r:22, fill:INK}, g); tx(g, 60, 148, 'SM', {f:'Q', s:16, c:'#fff', a:'middle'});
    tx(g, 94, 136, 'Sophie Martin', {f:'Q', s:16}); tx(g, 94, 155, 'Particulier', {s:12, c:GREY});
    tx(g, 28, 204, 'MON ACTIVITÉ', {s:11, w:700, c:GREY, ls:.5});
    row(g, 214, 'Mes demandes'); row(g, 266, 'Mes favoris');
    tx(g, 28, 344, 'PLUS', {s:11, w:700, c:GREY, ls:.5});
    row(g, 354, 'Mon parrainage', 'Invitez vos proches'); row(g, 418, 'Support PING');
    S.pRow = row(g, 472, 'Proposer mes services', 'Devenir prestataire : inscription gratuite', {fill:'#EEF9F7', stroke:TEAL, sw:1.8, subc:'#0C8F7E'});
  })();

  // ---------- 10. tarifs : forfait / à l'heure / forfait + heures sup. ----------
  var SEGW = [64, 78, 116];
  function seg3(g, x, y){
    var o = [], xs = [0, 64, 142];
    box(g, x, y, 258, 34, {rx:17, fill:'#F3F6F5', stroke:'none'});
    var hl = el('rect', {x:x + 3, y:y + 3, width:SEGW[0] - 6, height:28, rx:14, fill:TEAL}, g);
    ['Forfait', 'À l’heure', 'Forfait + heures sup.'].forEach(function(s, i){ o.push(tx(g, x + xs[i] + SEGW[i]/2, y + 22, s, {s:10.5, w:700, c:'#4E6470', a:'middle'})); });
    return {hl:hl, labels:o, x:x, xs:xs};
  }
  function setSeg(s, i){ s.hl.setAttribute('x', s.x + s.xs[i] + 3); s.hl.setAttribute('width', SEGW[i] - 6); s.labels.forEach(function(l, k){ l.setAttribute('fill', k === i ? '#fff' : '#4E6470'); }); }
  function fld(p, x, y, w, label, val, unit){
    tx(p, x, y, label, {s:11, w:700, c:GREY}); box(p, x, y + 7, w, 36, {rx:10, fill:'#F6F9F8', stroke:'#DCE5E3', sw:1.3});
    tx(p, x + 12, y + 31, val, {s:14, w:600}); tx(p, x + w - 10, y + 31, unit, {s:12, c:GREY, a:'end'});
  }
  (function(){
    var g = $('sTar'); bgNavy(g);
    for (var i = 0; i < 7; i++) el('rect', {x:66 + i*(230 - 24)/7 + i*4, y:40, width:(230 - 24)/7, height:4, rx:2, fill: i < 2 ? TEAL : '#2B5160'}, g);
    el('circle', {cx:40, cy:46, r:14, fill:'#2B5160'}, g); icon(g, 'back', 40, 46, .62, '#fff', 2.6);
    tx(g, 66, 62, 'Étape 2 sur 7', {s:11, w:700, c:'#C9D8DD'});
    el('rect', {x:12, y:82, width:316, height:640, rx:24, fill:'#fff'}, g);
    tx(g, 34, 126, 'Vos tarifs', {f:'Q', s:19.5});
    tx(g, 34, 148, 'Un prix pour chaque service : forfait,', {s:12.5, c:GREY}); tx(g, 34, 166, 'à l’heure, ou forfait avec heures sup.', {s:12.5, c:GREY});
    var c = el('g', {}, g);
    box(c, 30, 190, 280, 290, {rx:18, fill:'#fff', stroke:'#E7EDEB'});
    tx(c, 46, 220, 'Ménage', {f:'Q', s:16});
    S.tSeg = seg3(c, 41, 234);
    S.tM = [0, 1, 2].map(function(){ return el('g', {}, c); });
    fld(S.tM[0], 46, 296, 248, 'Prix du forfait', '60', '€');
    tx(S.tM[0], 46, 372, 'Affiché aux clients : 60 € le forfait', {s:11.5, w:700, c:'#0C8F7E'});
    fld(S.tM[1], 46, 296, 248, 'Taux horaire', '22', '€/h');
    tx(S.tM[1], 46, 372, 'Affiché aux clients : 22 €/h', {s:11.5, w:700, c:'#0C8F7E'});
    fld(S.tM[2], 46, 296, 120, 'Forfait', '60', '€'); fld(S.tM[2], 174, 296, 120, 'Heures incluses', '3', 'h');
    fld(S.tM[2], 46, 356, 248, 'Au-delà, par heure', '20', '€/h');
    tx(S.tM[2], 46, 430, 'Affiché : 60 €, 3 h incluses, puis 20 €/h', {s:11.5, w:700, c:'#0C8F7E'});
    S.tBtn = btn(g, 170, 628, 272, 46, 'Continuer', {});
  })();

  // ---------- 11. disponibilités ----------
  var DCOL = [], DROW = [];
  (function(){
    var g = $('sDisp'); header(g, 'Mes disponibilités');
    ['L', 'M', 'M', 'J', 'V', 'S', 'D'].forEach(function(d, i){ tx(g, 56 + i*38, 120, d, {s:11, w:700, c:GREY, a:'middle'}); });
    S.dCells = [];
    for (var r = 0; r < 4; r++) for (var k = 0; k < 7; k++){
      var cx = 56 + k*38, cy = 136 + r*40;
      var rc = el('rect', {x:cx - 17, y:cy, width:34, height:34, rx:9, fill:'#fff', stroke:'#E7EDEB', 'stroke-width':1.2}, g);
      var n = tx(g, cx, cy + 22, String(r*7 + k + 2), {s:11.5, w:600, c:'#4E6470', a:'middle'});
      S.dCells.push({r:rc, n:n, cx:cx, cy:cy + 17, row:r, col:k});
    }
    el('rect', {x:30, y:301, width:12, height:12, rx:4, fill:'rgba(18,179,156,.35)'}, g); tx(g, 48, 311, 'Créneaux libres', {s:11.5, w:600, c:GREY});
    el('rect', {x:150, y:301, width:12, height:12, rx:4, fill:INK}, g); tx(g, 168, 311, 'Rendez-vous', {s:11.5, w:600, c:GREY});
    var sh = el('g', {}, g); S.dSheet = sh;
    box(sh, 12, 328, 316, 340, {rx:24, sh:true, stroke:'none'});
    tx(sh, 28, 360, 'APPLIQUER À', {s:11, w:700, c:GREY, ls:.5});
    S.dOpts = [['Ce jour seulement', 376], ['Toute la semaine, mêmes horaires', 424], ['Tous les samedis pendant 4 semaines', 472]].map(function(q){
      var c = el('g', {}, sh), r = box(c, 28, q[1], 284, 40, {rx:12, fill:'#fff', stroke:'#E7EDEB', sw:1.5});
      var dot = el('circle', {cx:48, cy:q[1] + 20, r:8, fill:'#fff', stroke:'#B8C9C5', 'stroke-width':2}, c);
      tx(c, 66, q[1] + 25, q[0], {s:12, w:600});
      c.r = r; c.dot = dot; return c;
    });
    S.dSave = btn(sh, 170, 560, 284, 42, 'Enregistrer', {s:14.5});
    tx(sh, 170, 600, 'Un créneau déjà réservé par un client', {s:11, c:'#6E8592', a:'middle'}); tx(sh, 170, 616, 'n’est jamais retiré.', {s:11, c:'#6E8592', a:'middle'});
  })();

  // ---------- 12. Disponible ----------
  (function(){
    var g = $('sOn');
    el('rect', {x:12, y:12, width:316, height:656, fill:'#E9F1EA'}, g);
    el('path', {d:'M200 360 C230 330 270 310 328 300 V360 Z', fill:'#CBE6EE'}, g);
    [['M12 200 L328 150', 9], ['M70 12 L110 400', 9], ['M12 300 L328 270', 7], ['M240 12 L230 400', 7]].forEach(function(r){
      el('path', {d:r[0], fill:'none', stroke:'#fff', 'stroke-width':r[1], 'stroke-linecap':'round'}, g); });
    S.onRings = [0, 1, 2].map(function(){ return el('circle', {cx:170, cy:210, r:0, fill:'none', stroke:TEAL, 'stroke-width':2.5, opacity:0}, g); });
    var pin = el('g', {transform:'translate(170,224)'}, g);
    el('path', {d:'M0 18 C-6 6 -14 -2 -14 -10 a14 14 0 1 1 28 0 c0 8 -8 16 -14 28z', fill:TEAL}, pin); el('circle', {cx:0, cy:-10, r:5, fill:'#fff'}, pin);
    S.onPin = pin;
    box(g, 12, 400, 316, 290, {rx:26, sh:true, stroke:'none'});
    S.onDot = el('circle', {cx:36, cy:438, r:6, fill:'#c0503a'}, g);
    S.onTit = tx(g, 52, 443, 'Hors ligne', {f:'Q', s:15.5});
    S.onSub = tx(g, 28, 470, 'Les clients ne vous voient plus sur la carte', {s:12, c:GREY});
    S.onTog = box(g, 266, 426, 44, 26, {rx:13, fill:'#cdd6d3', stroke:'none'}); S.onKnob = el('circle', {cx:279, cy:439, r:10, fill:'#fff'}, g);
    tx(g, 28, 520, 'Demandes ouvertes autour de vous', {s:12.5, c:GREY}); tx(g, 312, 520, '3', {s:13, w:700, a:'end'});
    el('rect', {x:28, y:536, width:284, height:1, fill:'#E7EDEB'}, g);
    tx(g, 28, 566, 'Votre annonce est visible dès', {s:12, c:GREY}); tx(g, 28, 584, 'que vous passez Disponible.', {s:12, c:GREY});
  })();

  // ordre et début de chaque écran du téléphone
  var SCREENS = [['sMap', 4.6], ['sDem', 7.8], ['sChat', 10.8], ['sAgenda', 14.8], ['sFact', 17.4], ['sQR', 20.7], ['sSign', 23.4], ['sMapT', 26.9], ['sProf', 31.0], ['sTar', 34.6], ['sDisp', 38.8], ['sOn', 41.0]];
  SCREENS.forEach(function(q){ var g = $(q[0]); g.insertBefore(el('rect', {x:12, y:12, width:316, height:656, fill:'#F6F9F8'}), g.firstChild); });

  // ---------- signature PING : le mot « ping », l'épingle en guise de i ----------
  function buildWord(g, size, y, cx){
    g.innerHTML = '';
    var p = el('text', {y:y, 'font-family':'Quicksand', 'font-weight':700, 'font-size':size, fill:'#fff'}, g); p.textContent = 'p';
    var ng = el('text', {y:y, 'font-family':'Quicksand', 'font-weight':700, 'font-size':size, fill:'#fff'}, g); ng.textContent = 'ng';
    var wp = p.getComputedTextLength(), wn = ng.getComputedTextLength();
    var ph = size*0.74, pw = ph*38/65, gap = size*0.06;
    var total = wp + gap + pw + gap + wn, x0 = cx - total/2;
    p.setAttribute('x', x0);
    var px = x0 + wp + gap, s = ph/65;
    var pin = el('g', {transform:'translate('+px+','+(y-ph)+') scale('+s+') translate(-71,-35)'}, g);
    el('path', {d:'M90 100 C84 84, 71 70, 71 54 a19 19 0 1 1 38 0 c0 16 -13 30 -19 46z', fill:'#fff'}, pin);
    el('circle', {cx:90, cy:53, r:8.6, fill:'#2FD06E'}, pin);
    ng.setAttribute('x', x0 + wp + gap + pw + gap);
    return {x: px + (90 - 71)*s, y: y - ph + (53 - 35)*s};
  }
  var introDot = {x:270, y:300}, endDot = {x:270, y:250};
  var introRings = [], endRings = [], bgRings = [], argRings = [];
  for (var i = 0; i < 3; i++){ introRings.push(el('circle', {r:0, 'stroke-width':2.5}, $('introRings'))); endRings.push(el('circle', {r:0, 'stroke-width':2.5}, $('endRings'))); }
  for (var j = 0; j < 4; j++) bgRings.push(el('circle', {cx:270, cy:520, r:120 + j*110, opacity:.07 - j*.012}, $('bgRings')));
  for (var q2 = 0; q2 < 3; q2++) argRings.push(el('circle', {cx:270, cy:300, r:0, 'stroke-width':2}, $('argRings')));

  // ---------- arguments : un écran chacun, formule en deux temps ----------
  var ARG0 = 43.2, ARGD = 3.0;
  var ARGS = [
    {i:'doc', l:[['Moins de factures à faire,'], ['plus de services.', 'g']], s:'La facture se génère à chaque mission.'},
    {i:'folder', l:[['Moins de paperasse,'], ['plus de travail.', 'g']], s:'Vos pièces sont déposées une seule fois.'},
    {i:'chart', l:[['Moins d’administratif,'], ['plus de productif.', 'g']], s:'Le prix est fixé avant la mission.'},
    {i:'qr', l:[['QR de sécurité à l’arrivée'], ['et au départ :'], ['l’heure fait foi.', 'g']], s:'Arrivée et fin sont pointées par QR code.'},
    {i:'star', l:[['Prestataires et clients'], ['se notent.', 'g']], s:'Un avis croisé après chaque mission.'},
    {i:'scales', l:[['Service litige :'], ['un dossier,'], ['un médiateur PING.', 'g']], s:'Chaque litige est suivi dans un dossier unique.'},
    {i:'lock', badge:true, l:[['Paiement sécurisé'], ['sous séquestre,'], ['versement sous 48 h.', 'y']], s:null}
  ];
  S.args = ARGS.map(function(A, n){
    var c = el('g', {}, $('args')), ic = el('g', {}, c);
    el('circle', {cx:270, cy:300, r:58, fill:'#1E4352', stroke: A.badge ? GOLD : 'none', 'stroke-width':2, 'stroke-dasharray': A.badge ? '6 6' : 'none'}, ic);
    icon(ic, A.i, 270, 300, 2.5, A.badge ? GOLD : '#2FD06E', 1.6);
    var y0 = A.badge ? 484 : 452;
    if (A.badge) {
      var bg = el('g', {}, c); A.bd = bg;
      el('rect', {x:180, y:372, width:180, height:44, rx:22, fill:GOLD}, bg);
      tx(bg, 270, 402, 'BIENTÔT', {f:'Q', s:23, c:'#123644', a:'middle', ls:2});
    }
    A.ln = A.l.map(function(L, k){ return tx(c, 270, y0 + k*46, L[0], {f:'Q', s:31, a:'middle', c: L[1] === 'g' ? '#2FD06E' : (L[1] === 'y' ? GOLD : '#fff')}); });
    if (A.s) tx(c, 270, 610, A.s, {s:15.5, c:'#9DB4BC', a:'middle'});
    else {
      el('rect', {x:60, y:644, width:420, height:78, rx:18, fill:'#1E4352', stroke:'#3F6677', 'stroke-width':1.5}, c);
      tx(c, 270, 676, 'En attendant : règlement par virement', {s:16, w:600, c:'#fff', a:'middle'});
      tx(c, 270, 702, 'sur facture, directement au prestataire.', {s:14, c:'#C9D8DD', a:'middle'});
    }
    for (var d = 0; d < ARGS.length; d++) el('circle', {cx:270 + (d - 3)*22, cy:830, r:4.5, fill: d === n ? '#2FD06E' : '#fff', opacity: d === n ? 1 : .3}, c);
    c.ic = ic; return c;
  });

  // ---------- touchers : [temps, x, y] (coordonnées du téléphone) ----------
  var TAPS = [
    [9.4, 170, 452], [12.95, 244, 342], [14.1, 170, 556], [19.4, 170, 308],
    [23.0, 170, 79], [24.5, 170, 580], [26.0, 63, 407], [26.55, 170, 580],
    [27.5, 57, 118], [29.55, 250, 616], [30.25, 170, 468],
    [33.4, 170, 500], [35.95, 144, 251], [37.25, 241, 251],
    [39.2, 56 + 5*38, 136 + 0*40 + 17], [39.5, 56 + 5*38, 136 + 1*40 + 17], [39.85, 170, 496], [40.4, 170, 560],
    [41.65, 288, 439]
  ];
  var tapEls = TAPS.map(function(){ return el('circle', {r:10, fill:'#12B39C', opacity:0}, $('taps')); });

  // ---------- scénario ----------
  var CAPS = [
    { a:4.7,  b:7.8,  lines:['Prestataires et demandes', 'autour de vous.'] },
    { a:7.8,  b:10.8, lines:['Côté pro : les demandes', 'à portée, urgentes en orange.'] },
    { a:10.8, b:14.8, lines:['Le prix est proposé,', 'puis validé dans le chat.'] },
    { a:14.8, b:17.4, lines:['Le rendez-vous s’ajoute', 'à l’agenda.'] },
    { a:17.4, b:20.2, lines:['Et la facture se fait', 'toute seule.'] },
    { a:21.6, b:23.4, lines:['Ouvrez le lien', 'ou scannez le QR code.'] },
    { a:23.4, b:26.9, lines:['Créez votre compte', 'en deux étapes.'] },
    { a:26.9, b:28.9, lines:['Choisissez le service', 'sur la carte.'] },
    { a:28.9, b:30.7, lines:['Contactez un prestataire', 'ou déposez une demande.'] },
    { a:32.1, b:34.6, lines:['Prestataire ? Touchez', '« Devenir prestataire ».'] },
    { a:34.6, b:38.8, lines:['Fixez vos tarifs :', 'forfait, heure ou les deux.'] },
    { a:38.8, b:41.0, lines:['Indiquez vos', 'disponibilités.'] },
    { a:41.0, b:43.2, lines:['Passez « Disponible » :', 'visible sur la carte.'] }
  ];
  var capLines = [tx($('capText'), 270, 87, '', {f:'Q', s:27, a:'middle'}), tx($('capText'), 270, 123, '', {f:'Q', s:27, a:'middle'})];

  // liste du lecteur (scènes cliquables)
  var UI = [
    { a:0,    title:'Accroche', d:"Logo PING et son écho radar : « Et si ce que vous cherchez se trouvait juste à côté ? »" },
    { a:4.6,  title:'La carte', d:"Prestataires disponibles près de chez soi (Contacter, Déposer une demande), puis côté prestataire « Demandes autour de moi » avec les demandes urgentes en orange." },
    { a:10.8, title:'Le chat et le prix', d:"Le prestataire propose un devis, le client l'accepte : le tarif est validé et appliqué à la mission. Puis « Fixez le rendez-vous »." },
    { a:14.8, title:'Agenda et facture', d:"Le rendez-vous confirmé s'ajoute à l'agenda. À la fin de la mission, la facture est générée automatiquement ; règlement par virement." },
    { a:20.2, title:'Je cherche un prestataire', d:"Ouvrir le lien (QR code), créer son compte en deux étapes, choisir le service sur la carte, puis Contacter ou Déposer une demande." },
    { a:30.8, title:'Je suis prestataire', d:"Mon profil > Devenir prestataire, tarifs (forfait, à l'heure, forfait + heures sup.), disponibilités, bouton Disponible." },
    { a:43.2, title:'Moins de factures, plus de services', d:"Argument 1 : une formule en deux temps." },
    { a:46.2, title:'Moins de paperasse, plus de travail', d:"Argument 2." },
    { a:49.2, title:'Moins d’administratif, plus de productif', d:"Argument 3." },
    { a:52.2, title:'QR de sécurité : l’heure fait foi', d:"QR code à l'arrivée et au départ." },
    { a:55.2, title:'Prestataires et clients se notent', d:"Avis croisés après chaque mission." },
    { a:58.2, title:'Service litige', d:"Un dossier, un médiateur PING." },
    { a:61.2, title:'Paiement sécurisé : bientôt', d:"Séquestre et versement sous 48 h : badge BIENTÔT, jamais présenté comme actif. En attendant : règlement par virement sur facture." },
    { a:64.2, title:'Final', d:"Logo PING, QR code d'inscription et deux boutons (page web seulement) : « Je cherche un prestataire » (/l/ins) et « Je suis prestataire » (/l/insp)." }
  ];

  function render(t){
    // accroche
    var io = 1 - seg(t, 4.1, 4.6); show($('intro'), io);
    var wk = back(seg(t, 0.2, 0.8)); tr($('introWord'), 'translate('+introDot.x+','+introDot.y+') scale('+wk.toFixed(3)+') translate('+(-introDot.x)+','+(-introDot.y)+')');
    introRings.forEach(function(c, i){ var k = mod(t - 0.7 - i*0.6, 1.8)/1.8; c.setAttribute('cx', introDot.x); c.setAttribute('cy', introDot.y); c.setAttribute('r', (12 + k*200).toFixed(1)); show(c, t > 0.7 + i*0.6 ? (1-k)*0.5 : 0); });
    [['in1',1.2],['in2',1.9],['in3',2.6]].forEach(function(q){ appear($(q[0]), t, q[1], 0.5, 16); });

    // téléphone
    var py = 980 - (980-176)*eout(seg(t, 4.0, 4.7));
    tr($('phone'), 'translate(100,'+py.toFixed(1)+')');
    SCREENS.forEach(function(q, i){
      var a = q[1], nx = i + 1 < SCREENS.length ? SCREENS[i+1][1] + 0.4 : 99, on = t >= a && t < nx;
      var n = $(q[0]); n.setAttribute('display', on || i === 0 ? 'inline' : 'none');
      if (i > 0) tr(n, 'translate('+(330*(1-eout(seg(t, a, a + 0.4)))).toFixed(1)+',0)');
    });
    $('partLbl').textContent = t < 20.2 ? 'PING · L’application' : (t < 30.8 ? 'PING · Je cherche un prestataire' : 'PING · Je suis prestataire');

    // 1. carte
    mapAnim(S.m1, t, 5.0, {});
    appear(S.m1.card, t, 5.7, 0.45, 60); show(S.m1.ask, eout(seg(t, 5.5, 5.9)));
    // 2. demandes pro
    S.dPins.forEach(function(c, i){ var a = 8.0 + i*0.15, k = back(seg(t, a, a + 0.5)); tr(c, 'translate('+c.px+','+c.py+') scale('+k.toFixed(3)+')'); show(c, seg(t, a, a + 0.2));
      var u = c.col === ORANGE ? 0.8 : 1.4, r = mod(t - a - i*0.3, u)/u; c.halo.setAttribute('r', (18 + 14*r).toFixed(1)); c.halo.setAttribute('opacity', (0.32*(1 - r)).toFixed(3)); });
    S.dCards.forEach(function(c, i){ appear(c, t, 8.6 + i*0.35, 0.45, 26); });
    press(S.dCards[0], seg(t, 9.4, 9.75), 170, 452);
    // 3. chat
    appear(S.cb1, t, 11.1, 0.35, 12); appear(S.cb2, t, 11.6, 0.35, 12); appear(S.cOffer, t, 12.1, 0.45, 20);
    var acc = t >= 13.0; show(S.cBtns, acc ? 0 : 1); show(S.cOk, acc ? 1 : 0);
    press(S.cAccept, seg(t, 12.95, 13.3), 244, 342);
    appear(S.cRdv, t, 13.4, 0.45, 40); press(S.cConfirm, seg(t, 14.1, 14.4), 170, 556);
    // 4. agenda
    appear(S.agNew, t, 15.1, 0.4, 22); appear(S.agB, t, 15.4, 0.4, 22); appear(S.agC, t, 15.7, 0.4, 22);
    sc(S.agNew, 1 + 0.03*Math.sin(Math.PI*seg(t, 15.6, 16.4)), 170, 176);
    // 5. facture
    appear(S.fCard, t, 17.7, 0.45, 26); show(S.fChip, seg(t, 18.0, 18.3)); appear(S.fFee, t, 18.5, 0.4, 18); appear(S.fPay, t, 18.9, 0.4, 18);
    press(S.fPdf, seg(t, 19.4, 19.75), 170, 308);

    // 6. QR
    tr(S.scanline, 'translate(0,'+(206 + 184*(0.5 - 0.5*Math.cos(Math.PI*2*seg(t, 21.55, 22.75)))).toFixed(1)+')');
    show(S.scanline, (1 - seg(t, 22.6, 22.9)));
    var nbk = eout(seg(t, 22.3, 22.7)); show(S.banner, nbk); tr(S.banner, 'translate(0,'+(-70*(1-nbk)).toFixed(1)+')');
    if (t > 22.9) sc(S.banner, 1 - 0.03*Math.sin(Math.PI*seg(t, 23.0, 23.3)), 170, 79);
    // 7. compte
    var s2 = t >= 24.75; S.sg1.setAttribute('display', s2 ? 'none' : 'inline'); S.sg2.setAttribute('display', s2 ? 'inline' : 'none');
    S.f1.forEach(function(f){ typing(f, t); }); press(S.b1, seg(t, 24.5, 24.8), 170, 580);
    S.f2.forEach(function(f){ typing(f, t); });
    var ck = t >= 26.0; S.chk.setAttribute('fill', ck ? TEAL : '#fff'); S.chk.setAttribute('stroke', ck ? TEAL : '#9FC9C1'); show(S.chkMark, ck ? 1 : 0);
    var cr = t >= 26.55; S.b2.t.textContent = cr ? 'Création…' : 'Créer mon compte'; S.b2.r.setAttribute('fill', cr ? '#7FD3C6' : TEAL);
    // 8. carte tuto
    mapAnim(S.m2, t, 27.7, {chipAt:27.5});
    show(S.m2.ask, eout(seg(t, 28.7, 29.1))); press(S.m2.ask, seg(t, 30.25, 30.6), 170, 468);
    appear(S.m2.card, t, 28.9, 0.45, 60); press(S.m2.contact, seg(t, 29.55, 29.9), 250, 616);
    // 9. profil
    appear(S.pRow, t, 32.3, 0.4, 10);
    if (t > 33.4) press(S.pRow, seg(t, 33.4, 33.75), 170, 500);
    // 10. tarifs
    var md = t < 36.05 ? 0 : (t < 37.3 ? 1 : 2);
    setSeg(S.tSeg, md); S.tM.forEach(function(g, i){ show(g, i === md ? eout(seg(t, [34.8, 36.05, 37.3][i], [34.8, 36.05, 37.3][i] + 0.3)) : 0); });
    press(S.tBtn, 0, 170, 628);
    // 11. disponibilités
    var sel = [[5, 0, 39.3], [5, 1, 39.6], [5, 2, 39.8], [5, 3, 39.9]];
    S.dCells.forEach(function(c){
      var on = false; sel.forEach(function(s){ if (s[0] === c.col && s[1] === c.row && t >= s[2]) on = true; });
      c.r.setAttribute('fill', on ? 'rgba(18,179,156,.35)' : '#fff'); c.r.setAttribute('stroke', on ? TEAL : '#E7EDEB');
    });
    appear(S.dSheet, t, 38.95, 0.45, 40);
    var o3 = t >= 39.85; S.dOpts.forEach(function(c, i){ var on = i === 2 && o3; c.r.setAttribute('stroke', on ? TEAL : '#E7EDEB'); c.r.setAttribute('fill', on ? '#EEF9F7' : '#fff'); c.dot.setAttribute('stroke', on ? TEAL : '#B8C9C5'); c.dot.setAttribute('fill', on ? TEAL : '#fff'); });
    press(S.dSave, seg(t, 40.4, 40.7), 170, 560);
    // 12. disponible
    var on = t >= 41.75;
    S.onDot.setAttribute('fill', on ? TEAL : '#c0503a'); S.onTit.textContent = on ? 'Disponible maintenant' : 'Hors ligne';
    S.onSub.textContent = on ? 'Visible sur la carte des clients autour de vous' : 'Les clients ne vous voient plus sur la carte';
    S.onSub.setAttribute('font-size', on ? 12 : 12);
    S.onTog.setAttribute('fill', on ? GOLD : '#cdd6d3'); S.onKnob.setAttribute('cx', on ? 299 : 279);
    S.onRings.forEach(function(c, i){ var k = mod(t - 41.8 - i*0.5, 1.5)/1.5; c.setAttribute('cy', 210); c.setAttribute('r', (16 + k*140).toFixed(1)); show(c, on && t > 41.8 + i*0.5 ? (1-k)*0.5 : 0); });

    // séparateurs
    var sp = Math.max(win(t, 20.0, 21.8, .35), win(t, 30.6, 32.3, .35)); show($('sep'), sp);
    var s1 = t < 26;
    $('sepA').textContent = s1 ? 'TUTO · QUELQUES CLICS' : 'TUTO · QUELQUES CLICS';
    $('sepB').textContent = s1 ? 'Je cherche' : 'Je suis';
    $('sepB2').textContent = s1 ? 'un prestataire' : 'prestataire';
    $('sepC').textContent = s1 ? 'Ouvrir le lien, créer son compte, contacter.' : 'Tarifs, disponibilités, et vous voilà visible.';

    // touchers
    TAPS.forEach(function(q, i){
      var k = seg(t, q[0], q[0] + 0.55), c = tapEls[i];
      c.setAttribute('cx', q[1]); c.setAttribute('cy', q[2]); c.setAttribute('r', (8 + k*24).toFixed(1));
      show(c, k > 0 && k < 1 ? 0.45*(1-k) : 0);
    });

    // légende
    var cur = null, co = 0;
    CAPS.forEach(function(C){ var o = win(t, C.a, C.b, .25); if (o > co) { co = o; cur = C; } });
    if (cur) { capLines[0].textContent = cur.lines[0]; capLines[1].textContent = cur.lines[1]; }
    tr($('capText'), 'translate(0,'+((1-co)*8).toFixed(1)+')');
    show($('capText'), co); show($('cap'), co * (1 - sp));
    show($('capText'), co * (1 - sp));
    $('prog').setAttribute('width', (540*t/DUR).toFixed(1));

    // arguments
    var ag = seg(t, 42.9, 43.3); show($('args'), ag);
    argRings.forEach(function(c, i){ var k = mod(t - 43.2 - i*0.7, 2.1)/2.1; c.setAttribute('r', (60 + k*220).toFixed(1)); show(c, t > 43.2 ? (1-k)*0.28 : 0); });
    S.args.forEach(function(c, n){
      var a = ARG0 + n*ARGD, b = a + ARGD, o = Math.min(seg(t, a, a + 0.3), 1 - seg(t, b - 0.3, b)); if (n === 0) o = Math.min(1, o + 0);
      c.setAttribute('display', o > 0 ? 'inline' : 'none'); show(c, o);
      var ik = back(seg(t, a + 0.05, a + 0.55)); sc(c.ic, ik, 270, 300);
      ARGS[n].ln.forEach(function(L, k){ appear(L, t, a + 0.35 + k*0.4, 0.45, 18); });
      if (ARGS[n].bd) { var bk = back(seg(t, a + 0.3, a + 0.8)); sc(ARGS[n].bd, bk * (1 + 0.03*Math.sin(t*5)), 270, 394); }
    });

    // fin
    show($('end'), seg(t, 64.2, 64.7));
    var ek = back(seg(t, 64.4, 65.0)); tr($('endWord'), 'translate('+endDot.x+','+endDot.y+') scale('+ek.toFixed(3)+') translate('+(-endDot.x)+','+(-endDot.y)+')');
    endRings.forEach(function(c, i){ var k = mod(t - 64.8 - i*0.6, 1.8)/1.8; c.setAttribute('cx', endDot.x); c.setAttribute('cy', endDot.y); c.setAttribute('r', (12 + k*130).toFixed(1)); show(c, t > 64.8 + i*0.6 ? (1-k)*0.5 : 0); });
    [['e1',65.0],['e2',65.3],['e3',65.6],['e4',66.0],['e5',66.3]].forEach(function(q){ appear($(q[0]), t, q[1], 0.45, 14); });
  }

%%PLAYER_JS%%
  var cta = $('cta');
  makePlayer({
    dur: DUR,
    scenes: UI.map(function(C, i){ return { a: C.a, go: C.a + (i ? 0.7 : 0.01), title: C.title, d: C.d }; }),
    init: function(){
      introDot = buildWord($('introWord'), 92, 330, 270);
      endDot = buildWord($('endWord'), 76, 300, 270);
    },
    paint: function(t){ render(t); cta.classList.toggle('on', t >= 64.6); }
  });
})();
</script>
