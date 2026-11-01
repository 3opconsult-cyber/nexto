
  var QRN = %%QR_N%%;
  IC.mail = 'M3 5h18v14H3z|M3 7l9 6 9-6';
  IC.search = 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14|M16.5 16.5L21 21';
  IC.link = 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1|M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1';
  IC.back = 'M15 6l-6 6 6 6';
  IC.eye = 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z|M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6';
  IC.user = 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8|M4 21c0-4 3.6-7 8-7s8 3 8 7';
  IC.spark = 'M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z';
  var NAVY = '#123644', TEAL = '#12B39C', INK = '#123644', GREY = '#4E6470';
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
  function arrowBtn(g, cx, cy, hidden){
    var c = el('g', {}, g);
    if (!hidden) { el('circle', {cx:cx, cy:cy, r:13, fill:'#F3F6F5'}, c); icon(c, 'back', cx, cy, .62, INK, 2.6); }
    return c;
  }

  // ---------- 0. ouverture du lien : on scanne le QR code ----------
  (function(){
    var g = $('sOpen');
    el('rect', {x:12, y:12, width:316, height:656, fill:'#0B1F27'}, g);
    tx(g, 40, 36, '9:41', {s:11.5, w:600, c:'#9DB4BC'});
    // plaque + QR (le vrai code /l/ins)
    el('rect', {x:62, y:190, width:216, height:216, rx:22, fill:'#fff'}, g);
    var u = el('use', {href:'#qrsrc', transform:'translate(78,206) scale('+(184/QRN).toFixed(4)+')'}, g);
    var sl = el('g', {}, g); S.scanline = sl;
    el('rect', {x:62, y:-3, width:216, height:6, fill:'#2FD06E', filter:'url(#glow)', opacity:.9}, sl);
    el('rect', {x:62, y:-1.2, width:216, height:2.4, fill:'#2FD06E'}, sl);
    el('g', {fill:'none', stroke:'#2FD06E', 'stroke-width':4.5, 'stroke-linecap':'round'}, g).innerHTML =
      '<path d="M50 218 V178 H90"/><path d="M250 178 H290 V218"/><path d="M290 378 V418 H250"/><path d="M90 418 H50 V378"/>';
    tx(g, 170, 468, 'Scannez le QR code', {f:'Q', s:19, c:'#fff', a:'middle'});
    tx(g, 170, 492, 'ou ouvrez le lien reçu', {s:13, c:'#9DB4BC', a:'middle'});
    // notification caméra
    var nb = el('g', {}, g); S.banner = nb;
    box(nb, 26, 48, 288, 62, {rx:18, fill:'#fff', stroke:'none'});
    el('circle', {cx:58, cy:79, r:18, fill:'#DDF5F0'}, nb); icon(nb, 'link', 58, 79, .78, '#0C8F7E', 2);
    tx(nb, 86, 74, 'nexto-eta.vercel.app', {s:13.5, w:700});
    tx(nb, 86, 93, 'Ouvrir l’inscription PING', {s:12, c:GREY});
  })();

  // ---------- 1 et 2. inscription en 2 étapes ----------
  function signupFrame(g, step){
    bgNavy(g);
    el('circle', {cx:170, cy:60, r:16, fill:TEAL}, g); icon(g, 'pin', 170, 60, .72, '#fff', 2);
    var tg = el('g', {}, g);
    el('rect', {x:70, y:88, width:200, height:34, rx:17, fill:'#2B5160'}, tg);
    el('rect', {x:74, y:92, width:96, height:26, rx:13, fill:TEAL}, tg);
    tx(tg, 122, 109, 'Particulier', {f:'Q', s:13, c:'#fff', a:'middle'});
    tx(tg, 220, 109, 'Professionnel', {f:'Q', s:13, c:'#9DB4BC', a:'middle'});
    box(g, 24, 128, 292, 504, {rx:24, stroke:'none'});
    arrowBtn(g, 50, 152, step === 1);
    el('rect', {x:72, y:150, width:108, height:4, rx:2, fill:TEAL}, g);
    el('rect', {x:188, y:150, width:108, height:4, rx:2, fill: step === 2 ? TEAL : '#E7EDEB'}, g);
    tx(g, 42, 192, step === 1 ? 'Vos informations' : 'Finaliser', {f:'Q', s:20});
    tx(g, 42, 212, 'Étape '+step+' sur 2', {s:11.5, w:700, c:GREY});
    tx(g, 170, 654, 'Déjà un compte ? Se connecter', {s:11.5, w:600, c:'#9DB4BC', a:'middle'});
  }
  (function(){
    var g = $('sS1'); signupFrame(g, 1);
    S.f1 = [
      input(g, 42, 244, 118, 'Prénom', 'Sophie', {a:5.2, b:5.7}),
      input(g, 172, 244, 124, 'Nom', 'Martin', {a:5.8, b:6.3}),
      input(g, 42, 312, 254, 'Téléphone', '06 12 34 56 78', {a:6.4, b:7.0}),
      input(g, 42, 380, 254, 'Adresse', 'Antibes', {a:7.0, b:7.4})
    ];
    tx(g, 42, 458, 'Date de naissance : facultatif', {s:11, c:GREY});
    S.b1 = btn(g, 170, 580, 252, 46, 'Continuer', {});
  })();
  (function(){
    var g = $('sS2'); signupFrame(g, 2);
    S.f2 = [
      input(g, 42, 244, 254, 'Email', 'sophie@exemple.fr', {a:8.0, b:8.7}),
      input(g, 42, 312, 254, 'Mot de passe', '••••••••', {a:8.8, b:9.3})
    ];
    icon(g, 'eye', 274, 349, .6, '#9DB4BC', 2);
    box(g, 42, 384, 254, 84, {rx:13, fill:'#E7F6F3', stroke:'none'});
    S.chk = box(g, 54, 398, 18, 18, {rx:5, fill:'#fff', stroke:'#9FC9C1', sw:1.6});
    S.chkMark = icon(g, 'check', 63, 407, .5, '#fff', 3.4);
    ['J’accepte les Conditions Générales', 'et la Politique de confidentialité', 'de PING'].forEach(function(s, i){ tx(g, 82, 410 + i*17, s, {s:11.5, w:600, c:'#0C8F7E'}); });
    S.b2 = btn(g, 170, 580, 252, 46, 'Créer mon compte', {});
  })();

  // ---------- 3. e-mail de confirmation ----------
  (function(){
    var g = $('sMail'); bgNavy(g);
    box(g, 24, 170, 292, 330, {rx:24, stroke:'none'});
    S.mIcon = el('rect', {x:142, y:198, width:56, height:56, rx:16, fill:'#E1F4F0'}, g);
    S.mMail = icon(g, 'mail', 170, 226, 1.15, '#0C8F7E', 2);
    S.mOk = icon(g, 'check', 170, 226, 1.4, '#fff', 3);
    tx(g, 170, 292, 'Vérifiez votre boîte mail', {f:'Q', s:20, a:'middle'});
    ['Un lien de confirmation vient d’être', 'envoyé à sophie@exemple.fr.', 'Cliquez dessus pour activer votre', 'compte, puis connectez-vous.'].forEach(function(s, i){ tx(g, 170, 322 + i*20, s, {s:12.5, c:GREY, a:'middle'}); });
    S.mBtn = btn(g, 170, 452, 252, 44, 'Aller à la connexion', {s:14});
    // notification de message
    var nb = el('g', {}, g); S.mNote = nb;
    box(nb, 26, 40, 288, 64, {rx:18, fill:'#fff', stroke:'none'});
    el('circle', {cx:58, cy:72, r:18, fill:'#DDF5F0'}, nb); icon(nb, 'mail', 58, 72, .75, '#0C8F7E', 2);
    tx(nb, 86, 67, 'PING', {s:13.5, w:700});
    tx(nb, 86, 86, 'Confirmez votre adresse e-mail', {s:12, c:GREY});
    S.mChip = chip(g, 100, 520, 'Compte activé', {w:140, h:26, s:12.5, fill:'#2FD06E', c:'#fff'});
  })();

  // ---------- 4. accueil (3 écrans) ----------
  (function(){
    var g = $('sWel'); bgNavy(g);
    tx(g, 306, 54, 'Passer', {f:'Q', s:14, c:'#C9D8DD', a:'end'});
    var SL = [
      {i:'cal', a:['Dites ce dont', 'vous avez besoin'], b:['Ménage, repassage, nettoyage :', 'décrivez votre besoin, ou choisissez', 'un prestataire sur la carte.']},
      {i:'chev', a:['Comparez les propositions', 'et fixez le prix'], b:['Les prestataires proches répondent.', 'Discutez dans la messagerie, puis', 'validez le tarif : il ne change plus.']},
      {i:'doc', a:['Réglez après l’intervention,', 'facture automatique'], b:['Vous pointez l’arrivée et la fin avec', 'un QR code. La facture est générée', 'toute seule, et un avis est possible.']}
    ];
    IC.chat = 'M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z|M8 9h8M8 13h5';
    IC.scales = 'M12 3v18M5 7h14|M5 7l-3 7a3.2 3.2 0 0 0 6 0L5 7z|M19 7l-3 7a3.2 3.2 0 0 0 6 0l-3-7z';
    SL[0].i = 'chat'; SL[1].i = 'scales';
    S.wSlides = SL.map(function(s){
      var c = el('g', {}, g);
      box(c, 32, 150, 276, 270, {rx:24, stroke:'none'});
      el('rect', {x:128, y:176, width:84, height:84, rx:24, fill:'#E1F4F0'}, c);
      icon(c, s.i, 170, 218, 1.7, TEAL, 1.6);
      s.a.forEach(function(l, k){ tx(c, 170, 296 + k*25, l, {f:'Q', s:19, a:'middle'}); });
      s.b.forEach(function(l, k){ tx(c, 170, 350 + k*19, l, {s:12, c:GREY, a:'middle'}); });
      return c;
    });
    S.wDots = [0, 1, 2].map(function(i){ return el('rect', {x:0, y:512, width:8, height:8, rx:4, fill:'#fff', opacity:.3}, g); });
    S.wBtn = btn(g, 170, 580, 270, 46, 'Suivant', {});
  })();

  // ---------- 5. la carte : demande ou contact ----------
  (function(){
    var g = $('sMap');
    el('rect', {x:12, y:12, width:316, height:656, fill:'#E9F1EA'}, g);
    el('path', {d:'M200 668 C230 560 270 520 328 500 V668 Z', fill:'#CBE6EE'}, g);
    [['M12 210 L328 150', 9], ['M60 12 L130 668', 9], ['M12 400 L328 360', 7], ['M230 12 L200 668', 7], ['M12 560 L200 520', 6]].forEach(function(r){
      el('path', {d:r[0], fill:'none', stroke:'#fff', 'stroke-width':r[1], 'stroke-linecap':'round'}, g); });
    box(g, 24, 50, 292, 44, {rx:22, sh:true, stroke:'none'});
    icon(g, 'search', 50, 72, .75, GREY, 2); tx(g, 70, 77, 'Que cherchez-vous ?', {s:13.5, c:'#6E8592'});
    S.mChips = [['Ménage', 24], ['Repassage', 100], ['Nettoyage', 192]].map(function(q){ return chip(g, q[1], 104, q[0], {w: q[0].length*7 + 24, h:28, s:12.5, fill:'#fff', c:INK}); });
    S.mPins = [[88, 250], [190, 300], [262, 210], [140, 420]].map(function(p, i){
      var c = el('g', {}, g);
      el('circle', {r:22, fill:TEAL, opacity:.2}, c);
      el('path', {d:'M0 18 C-6 6 -14 -2 -14 -10 a14 14 0 1 1 28 0 c0 8 -8 16 -14 28z', fill: i === 1 ? '#0C8F7E' : TEAL}, c);
      el('circle', {cx:0, cy:-10, r:5, fill:'#fff'}, c);
      c.px = p[0]; c.py = p[1]; return c;
    });
    S.mAsk = btn(g, 170, 468, 232, 44, '+ Déposer une demande', {s:14.5});
    var pc = el('g', {}, g); S.mCard = pc;
    box(pc, 24, 524, 292, 124, {rx:20, sh:true, stroke:'none'});
    el('circle', {cx:58, cy:560, r:20, fill:INK}, pc); tx(pc, 58, 567, 'C', {f:'Q', s:19, c:'#fff', a:'middle'});
    tx(pc, 88, 556, 'Camille R.', {f:'Q', s:16}); tx(pc, 88, 575, 'Ménage · 60 € le forfait · 400 m', {s:11.5, c:GREY});
    chip(pc, 40, 592, 'Disponible', {w:84, h:22, s:11, fill:'#DDF5F0', c:'#0C8F7E'});
    S.mContact = btn(pc, 250, 616, 112, 36, 'Contacter', {s:14});
    tx(pc, 142, 608, '4,9 ★', {s:11.5, w:600, c:GREY});
  })();

  // ---------- 6. onboarding prestataire : cadre commun ----------
  function obFrame(g, n, title, sub, cta, back, total){
    total = total || 7;
    bgNavy(g);
    if (back) { el('circle', {cx:40, cy:46, r:14, fill:'#2B5160'}, g); icon(g, 'back', 40, 46, .62, '#fff', 2.6); }
    var w = (230 - (total-1)*4)/total;
    for (var i = 0; i < total; i++) el('rect', {x:66 + i*(w+4), y:40, width:w, height:4, rx:2, fill: i < n ? TEAL : '#2B5160'}, g);
    tx(g, 66, 62, 'Étape '+n+' sur '+total, {s:11, w:700, c:'#C9D8DD'});
    el('rect', {x:12, y:82, width:316, height:640, rx:24, fill:'#fff'}, g);
    var tl = [].concat(title);
    tl.forEach(function(l, k){ tx(g, 34, 126 + k*25, l, {f:'Q', s:19.5}); });
    sub.forEach(function(l, k){ tx(g, 34, 148 + (tl.length-1)*25 + k*18, l, {s:12.5, c:GREY}); });
    var b = btn(g, 170, 628, 272, 46, cta || 'Continuer', {});
    return b;
  }
  function choice(g, y, label, hint){
    var c = el('g', {});
    g.appendChild(c);
    c.r = box(c, 34, y, 272, hint ? 66 : 54, {rx:16, fill:'#fff', stroke:'#DCE5E3', sw:1.6});
    tx(c, 54, y + (hint ? 28 : 33), label, {f:'Q', s:16.5});
    if (hint) tx(c, 54, y + 49, hint, {s:11.5, c:GREY});
    c.ck = el('g', {}, c); el('circle', {cx:282, cy:y + (hint ? 33 : 27), r:11, fill:TEAL}, c.ck); icon(c.ck, 'check', 282, y + (hint ? 33 : 27), .5, '#fff', 3.6);
    c.y = y; return c;
  }
  (function(){
    var g = $('sSvc'); S.svcB = obFrame(g, 1, 'Quel service proposez-vous ?', ['Vous pourrez en ajouter d’autres plus tard.'], 'Continuer', false);
    S.svc = [choice(g, 190, 'Ménage'), choice(g, 256, 'Repassage'), choice(g, 322, 'Nettoyage')];
  })();
  var SEGW = [64, 78, 116];
  function seg3(g, x, y){
    var o = [], xs = [0, 64, 142];
    box(g, x, y, 258, 34, {rx:17, fill:'#F3F6F5', stroke:'none'});
    var hl = el('rect', {x:x + 3, y:y + 3, width:SEGW[0] - 6, height:28, rx:14, fill:TEAL}, g);
    ['Forfait', '\u00c0 l\u2019heure', 'Forfait + heures sup.'].forEach(function(s, i){ o.push(tx(g, x + xs[i] + SEGW[i]/2, y + 22, s, {s:10.5, w:700, c:'#4E6470', a:'middle'})); });
    return {hl:hl, labels:o, x:x, xs:xs};
  }
  function setSeg(s, i){ s.hl.setAttribute('x', s.x + s.xs[i] + 3); s.hl.setAttribute('width', SEGW[i] - 6); s.labels.forEach(function(l, k){ l.setAttribute('fill', k === i ? '#fff' : '#4E6470'); }); }
  (function(){
    var g = $('sTar'); S.tarB = obFrame(g, 2, 'Vos tarifs', ['Un prix pour chaque service : forfait,', 'à l’heure, ou forfait avec heures sup.'], 'Continuer', true);
    S.tCards = [['Ménage', 0, '60', 'Prix du forfait', '€'], ['Repassage', 1, '22', 'Taux horaire', '€/h']].map(function(q, i){
      var y = 196 + i*196, c = el('g', {}, g);
      box(c, 30, y, 280, 180, {rx:18, fill:'#fff', stroke:'#E7EDEB'});
      tx(c, 46, y + 30, q[0], {f:'Q', s:16});
      var sg = seg3(c, 41, y + 44); setSeg(sg, q[1]);
      tx(c, 46, y + 106, q[3], {s:11.5, w:700, c:GREY});
      box(c, 46, y + 114, 248, 38, {rx:10, fill:'#F6F9F8', stroke:'#DCE5E3', sw:1.3});
      var v = tx(c, 58, y + 139, '', {s:14, w:600});
      tx(c, 282, y + 139, q[4], {s:12.5, c:GREY, a:'end'});
      tx(c, 46, y + 170, 'Affiché aux clients : ' + q[2] + ' ' + (i ? '€/h' : '€ le forfait'), {s:11.5, w:700, c:'#0C8F7E'});
      c.v = v; c.val = q[2]; return c;
    });
  })();
  (function(){
    var g = $('sEnt'); S.entB = obFrame(g, 4, 'Votre entreprise', ['Tapez son nom, on retrouve le SIRET', 'et l’adresse pour vous.'], 'Continuer', true);
    S.eIn = input(g, 34, 190, 272, 'Nom de l’entreprise', 'Net Azur Services', {a:23.8, b:24.5});
    var rc = el('g', {}, g); S.eRes = rc;
    box(rc, 34, 246, 272, 66, {rx:12, fill:'#fff', stroke:'#DCE5E3'});
    tx(rc, 48, 272, 'Net Azur Services', {s:13.5, w:700});
    tx(rc, 48, 292, 'SIRET 812 345 678 00019 · Antibes', {s:11.5, c:GREY});
    S.eSel = el('rect', {x:34, y:246, width:272, height:66, rx:12, fill:'none', stroke:TEAL, 'stroke-width':2, opacity:0}, g);
    var zc = el('g', {}, g); S.eZone = zc;
    tx(zc, 34, 372, 'Où intervenez-vous ?', {f:'Q', s:16});
    tx(zc, 34, 392, 'Pour apparaître au bon endroit sur la carte.', {s:11.5, c:GREY});
    box(zc, 34, 408, 272, 44, {rx:12, fill:'rgba(18,179,156,.1)', stroke:'none'});
    icon(zc, 'pin', 58, 430, .72, '#0C8F7E', 2); tx(zc, 76, 435, 'Position enregistrée · Antibes', {s:13, w:700, c:'#0C8F7E'});
  })();
  (function(){
    var g = $('sCgv'); S.cgvB = obFrame(g, 7, 'Un mot pour vous présenter', ['Une phrase suffit. Vous pourrez la modifier.'], 'Terminer', true);
    box(g, 34, 180, 272, 92, {rx:12, fill:'#F6F9F8', stroke:'#DCE5E3', sw:1.3});
    tx(g, 48, 206, 'M\u00e9nage soigneux \u00e0 Antibes et alentours,', {s:12.5}); tx(g, 48, 225, 'avec mon propre mat\u00e9riel.', {s:12.5});
    S.cgvBox = box(g, 34, 296, 272, 120, {rx:12, fill:'#fff', stroke:'#DCE5E3', sw:1.6});
    S.cgvChk = box(g, 48, 312, 20, 20, {rx:5, fill:'#fff', stroke:'#9FC9C1', sw:1.6});
    S.cgvMark = icon(g, 'check', 58, 322, .55, '#fff', 3.4);
    ['J’accepte les CGV prestataires et le', 'contrat de commission : commission', 'PING retenue sur mes versements,', 'prélèvement SEPA des commissions non', 'retenues, suspension en cas d’impayé.'].forEach(function(s, i){ tx(g, 78, 326 + i*19, s, {s:11.5, c:INK}); });
  })();
  (function(){
    var g = $('sDoc'); S.docB = obFrame(g, 1, ['Avez-vous une pièce d’identité', 'à télécharger ?'], ['PDF, JPG ou PNG, 10 Mo maximum. Facultatif', 'pour apparaître sur la carte.'], 'Continuer', false, 4);
    S.dYes = choice(g, 214, 'Oui, la télécharger');
    S.dNo = choice(g, 316, 'Pas maintenant');
    var f = el('g', {}, g); S.dFile = f;
    box(f, 34, 394, 272, 58, {rx:14, fill:'#F6F9F8', stroke:'#DCE5E3'});
    icon(f, 'doc', 62, 423, .85, '#0C8F7E', 2); tx(f, 86, 418, 'identite.jpg', {s:13, w:700}); tx(f, 86, 437, 'Pièce fournie', {s:11.5, w:700, c:'#0C8F7E'});
    el('circle', {cx:282, cy:423, r:11, fill:TEAL}, f); icon(f, 'check', 282, 423, .5, '#fff', 3.6);
  })();
  (function(){
    var g = $('sAtt'); bgNavy(g);
    tx(g, 170, 130, 'Dossier enregistré', {f:'Q', s:24, c:'#fff', a:'middle'});
    ['Vous êtes joignable par les clients', 'à proximité dès que votre annonce est en ligne.'].forEach(function(s, i){ tx(g, 170, 158 + i*19, s, {s:12.5, c:'#D6E2E6', a:'middle'}); });
    box(g, 28, 214, 284, 150, {rx:16, fill:'#1E4352', stroke:'none'});
    tx(g, 46, 242, 'DOCUMENTS', {s:11, w:700, c:'#C9D8DD', ls:.5});
    [["Pièce d’identité", 'Fourni', 1], ['Assurance RC Pro', 'Non fourni', 0], ['Justificatif de statut', 'Non fourni', 0]].forEach(function(r, i){
      var y = 270 + i*30;
      el('circle', {cx:56, cy:y, r:9, fill: r[2] ? TEAL : '#33596A'}, g); if (r[2]) icon(g, 'check', 56, y, .42, '#fff', 3.6);
      tx(g, 74, y + 4.5, r[0], {s:12.5, w:600, c: r[2] ? '#fff' : '#8FA6AF'});
      tx(g, 298, y + 4, r[1], {s:11, w:600, c:'#C9D8DD', a:'end'});
    });
    btn(g, 170, 424, 270, 44, 'Compléter mes documents', {fill:'#1E4352', stroke:'#3F6677', s:14});
    S.attBtn = btn(g, 170, 482, 270, 46, 'Voir et lancer mon annonce', {s:14.5});
    tx(g, 170, 556, 'Accéder à Mon entreprise', {f:'Q', s:13.5, c:'#D6E2E6', a:'middle'});
  })();
  (function(){
    var g = $('sAnn'); header(g, 'Mon annonce', 'Ce que voient les clients');
    var st = el('g', {}, g); S.aSt = st;
    box(st, 24, 108, 292, 136, {rx:18, sh:true, stroke:'#E2ECEA'});
    S.aDot = el('circle', {cx:46, cy:138, r:7, fill:'#A5B3B9'}, st);
    S.aTit = tx(st, 62, 143, 'En pause', {f:'Q', s:17});
    S.aSub1 = tx(st, 42, 168, 'Votre annonce n’apparaît pas sur la carte.', {s:12, c:GREY});
    S.aBtn = btn(st, 170, 212, 252, 40, 'Mettre mon annonce en ligne', {s:14});
    var gz = el('g', {}, g);
    box(gz, 24, 258, 292, 150, {rx:18, sh:true, stroke:'#E2ECEA'});
    tx(gz, 42, 288, 'Annonce complète à 70 %', {f:'Q', s:15});
    el('rect', {x:42, y:300, width:256, height:8, rx:4, fill:'#EEF3F2'}, gz); el('rect', {x:42, y:300, width:179, height:8, rx:4, fill:TEAL}, gz);
    [['Un tarif', 1], ['Votre position', 1], ['Une photo de couverture', 0]].forEach(function(r, i){
      var y = 336 + i*26; el('circle', {cx:50, cy:y, r:8, fill: r[1] ? TEAL : '#fff', stroke: r[1] ? TEAL : '#C9D5D2', 'stroke-width':1.5}, gz); if (r[1]) icon(gz, 'check', 50, y, .38, '#fff', 3.8);
      tx(gz, 66, y + 4.5, r[0], {s:12.5, w:700});
    });
    var fx = el('g', {}, g); S.aFx = fx;
    box(fx, 24, 424, 292, 70, {rx:18, fill:'#E8F8F4', stroke:'#12B39C', sw:1.6});
    icon(fx, 'doc', 54, 459, .85, '#0C8F7E', 2);
    tx(fx, 78, 453, 'Facture automatique', {s:13.5, w:700, c:'#0C8F7E'}); tx(fx, 78, 472, 'à votre nom, à chaque mission', {s:12, c:GREY});
  })();

  // ordre et début de chaque écran du téléphone
  var SCREENS = [['sOpen', 0], ['sS1', 4.8], ['sS2', 7.8], ['sMail', 10.2], ['sWel', 12.2], ['sMap', 15.0], ['sSvc', 19.2], ['sTar', 21.2], ['sEnt', 23.4], ['sCgv', 25.8], ['sDoc', 27.8], ['sAtt', 29.8], ['sAnn', 32.2]];
  SCREENS.forEach(function(q){ var g = $(q[0]); g.insertBefore(el('rect', {x:12, y:12, width:316, height:656, fill:'#F6F9F8'}), g.firstChild); });

  // ---------- signature PING ----------
  function device(g){
    var d = el('g', {transform:'translate(-60,-95)'}, g);
    el('path', {d:'M24 56 C24 26, 46 12, 68 18 C92 25, 100 50, 82 68 C70 80, 64 86, 64 98', fill:'none', stroke:'#fff', 'stroke-width':14, 'stroke-linecap':'round', 'stroke-linejoin':'round'}, d);
    el('circle', {cx:64, cy:148, r:30, fill:'none', stroke:'#12B39C', 'stroke-width':2, opacity:.35}, d);
    el('circle', {cx:64, cy:148, r:19.8, fill:'none', stroke:'#12B39C', 'stroke-width':2.9, opacity:.7}, d);
    el('circle', {cx:64, cy:148, r:7.7, fill:'#2FD06E'}, d);
  }
  device($('introDevice')); device($('endDevice'));
  var introRings = [], endRings = [], bgRings = [];
  for (var i = 0; i < 3; i++){ introRings.push(el('circle', {r:0, 'stroke-width':2.5}, $('introRings'))); endRings.push(el('circle', {r:0, 'stroke-width':2.5}, $('endRings'))); }
  for (var j = 0; j < 4; j++) bgRings.push(el('circle', {cx:270, cy:520, r:120 + j*110, opacity:.07 - j*.012}, $('bgRings')));

  function buildWord(){
    var g = $('word'); g.innerHTML = '';
    var size = 76, y = 330;
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

  // ---------- touchers : [temps, x, y] (coordonnées du téléphone) ----------
  var TAPS = [
    [4.3, 170, 80], [7.35, 170, 580], [8.45, 63, 407], [9.55, 170, 580], [11.25, 170, 452],
    [13.05, 170, 580], [13.95, 170, 580], [14.75, 170, 580], [16.2, 170, 468], [17.25, 250, 616],
    [19.8, 170, 217], [20.25, 170, 283], [20.85, 170, 628], [22.9, 170, 628],
    [24.45, 170, 279], [25.4, 170, 628], [26.7, 58, 322], [27.35, 170, 628],
    [28.4, 170, 283], [29.5, 170, 628], [31.6, 170, 482], [33.0, 170, 212]
  ];
  var tapEls = TAPS.map(function(){ return el('circle', {r:10, fill:'#12B39C', opacity:0}, $('taps')); });

  // ---------- scénario ----------
  var CAPS = [
    { a:0,    b:2.6,  title:'Accroche', lines:null, d:"« Rejoindre PING en 2 minutes. Particulier ou prestataire, pas à pas. » Signature PING et son écho radar." },
    { a:2.6,  b:4.8,  title:'Ouvrir le lien', lines:['Scannez le QR code :', "l'inscription s'ouvre."], d:"Le QR code (ou le lien reçu) ouvre l'inscription PING. Le code /l/ins permet de savoir combien d'inscrits viennent de cette vidéo." },
    { a:4.8,  b:7.8,  title:'Vos informations', lines:['Quelques infos, en 2 étapes :', 'zéro paperasse.'], d:"Étape 1 sur 2 : prénom, nom, téléphone, adresse. La date de naissance est facultative." },
    { a:7.8,  b:10.2, title:'Finaliser', lines:['Votre e-mail, un mot de passe,', 'et votre compte est créé.'], d:"Étape 2 sur 2 : e-mail, mot de passe, acceptation des Conditions Générales et de la Politique de confidentialité, « Créer mon compte »." },
    { a:10.2, b:12.2, title:'Confirmer son e-mail', lines:['Un e-mail de confirmation :', 'un clic sur le lien.'], d:"« Vérifiez votre boîte mail » : un lien de confirmation est envoyé. Un clic dessus active le compte (penser aux spams)." },
    { a:12.2, b:15.0, title:'Bienvenue', lines:['Trois écrans pour comprendre,', 'puis vous voilà sur la carte.'], d:"L'accueil : dites votre besoin, comparez et fixez le prix, réglez après l'intervention avec une facture automatique." },
    { a:15.0, b:17.9, title:'Première demande', lines:['Déposez une demande', 'ou contactez un prestataire.'], d:"Sur la carte : « Déposer une demande », ou « Contacter » un prestataire disponible près de chez soi." },
    { a:19.2, b:21.2, title:'Prestataire : votre métier', lines:['Prestataire ? Choisissez', 'vos services.'], d:"Devenir prestataire : ménage, repassage, nettoyage. On peut en ajouter d'autres plus tard." },
    { a:21.2, b:23.4, title:'Vos tarifs', lines:['Fixez vos tarifs : le prix', 'est validé avant la mission.'], d:"Forfait, à l'heure ou forfait avec heures supplémentaires. Le prix est fixé avant la mission : pas de renégociation ensuite." },
    { a:23.4, b:25.8, title:'Entreprise et zone', lines:['Votre zone, votre entreprise :', 'le SIRET se retrouve seul.'], d:"On tape le nom de l'entreprise, le SIRET et l'adresse sont retrouvés ; la position est enregistrée pour apparaître au bon endroit sur la carte." },
    { a:25.8, b:27.8, title:'Accepter les CGV', lines:['Un mot de présentation,', 'les CGV acceptées : terminé.'], d:"Une phrase de présentation, puis l'acceptation des CGV prestataires et du contrat de commission (case obligatoire), « Terminer »." },
    { a:27.8, b:29.8, title:'Vos pièces', lines:['Vos pièces en quelques clics,', 'sans courrier ni papier.'], d:"« Avez-vous une pièce d'identité à télécharger ? » : la pièce est enregistrée comme fournie. Facultatif pour apparaître sur la carte." },
    { a:29.8, b:32.2, title:'Dossier enregistré', lines:['Dossier enregistré :', 'voir et lancer mon annonce.'], d:"Récapitulatif des documents, puis « Voir et lancer mon annonce »." },
    { a:32.2, b:34.8, title:'En ligne', lines:['Mettez votre annonce en ligne :', 'factures faites toutes seules.'], d:"Mon annonce passe de « En pause » à « En ligne · visible sur la carte ». Ensuite, chaque mission produit sa facture automatiquement." },
    { a:34.8, b:40,   title:'Rejoindre PING', lines:null, d:"Logo PING, « Inscription gratuite », trois bénéfices, grand QR code vers /l/ins et l'adresse nexto-eta.vercel.app/l/ins." }
  ];
  var capLines = [tx($('capText'), 270, 87, '', {f:'Q', s:27, a:'middle'}), tx($('capText'), 270, 123, '', {f:'Q', s:27, a:'middle'})];

  function render(t){
    // ouverture
    var io = 1 - seg(t, 2.3, 2.8); show($('intro'), io);
    var dk = back(seg(t, 0.15, 0.7)); tr($('introDevice'), 'translate(270,300) scale('+(1.25*dk).toFixed(3)+')');
    var ix = 270 + 4*1.25, iy = 300 + 53*1.25;
    introRings.forEach(function(c, i){ var k = mod(t - 0.6 - i*0.55, 1.65)/1.65; c.setAttribute('cx', ix); c.setAttribute('cy', iy); c.setAttribute('r', (14 + k*190).toFixed(1)); show(c, t > 0.6 + i*0.55 ? (1-k)*0.5 : 0); });
    [['in0',0.5],['in1',0.8],['in2',1.1],['in3',1.5]].forEach(function(q){ var k = eout(seg(t, q[1], q[1]+0.45)); show($(q[0]), k); tr($(q[0]), 'translate(0,'+(14*(1-k)).toFixed(1)+')'); });

    // téléphone
    var py = 980 - (980-176)*eout(seg(t, 2.3, 3.0));
    tr($('phone'), 'translate(100,'+py.toFixed(1)+')');
    SCREENS.forEach(function(q, i){
      var a = q[1], nx = i + 1 < SCREENS.length ? SCREENS[i+1][1] + 0.4 : 99, on = t >= a && t < nx;
      var n = $(q[0]); n.setAttribute('display', on || i === 0 ? 'inline' : 'none');
      if (i > 0) tr(n, 'translate('+(330*(1-eout(seg(t, a, a + 0.4)))).toFixed(1)+',0)');
    });
    $('partLbl').textContent = t < 18.6 ? 'PING · Partie 1 · Particulier' : 'PING · Partie 2 · Prestataire';

    // 0. scan du QR
    tr(S.scanline, 'translate(0,'+(206 + 184*(0.5 - 0.5*Math.cos(Math.PI*2*seg(t, 3.0, 4.2)))).toFixed(1)+')');
    show(S.scanline, 1 - seg(t, 4.1, 4.4));
    var nbk = eout(seg(t, 3.6, 4.0)); show(S.banner, nbk); tr(S.banner, 'translate(0,'+(-70*(1-nbk)).toFixed(1)+')');
    if (t > 4.2) sc(S.banner, 1 - 0.03*Math.sin(Math.PI*seg(t, 4.25, 4.5)), 170, 79);

    // 1. étape 1
    S.f1.forEach(function(f){ typing(f, t); });
    var p1 = 1 - 0.05*Math.sin(Math.PI*seg(t, 7.3, 7.6)); sc(S.b1, p1, 170, 580);
    // 2. étape 2
    S.f2.forEach(function(f){ typing(f, t); });
    var ck = t >= 8.45;
    S.chk.setAttribute('fill', ck ? TEAL : '#fff'); S.chk.setAttribute('stroke', ck ? TEAL : '#9FC9C1'); show(S.chkMark, ck ? 1 : 0);
    var cr = t >= 9.6; S.b2.t.textContent = cr ? 'Création…' : 'Créer mon compte'; S.b2.r.setAttribute('fill', cr ? '#7FD3C6' : TEAL);
    // 3. mail
    var nm = eout(seg(t, 10.4, 10.8)) * (1 - seg(t, 11.6, 11.9)); show(S.mNote, nm); tr(S.mNote, 'translate(0,'+(-70*(1-eout(seg(t, 10.4, 10.8)))).toFixed(1)+')');
    var okm = t >= 11.5; S.mIcon.setAttribute('fill', okm ? '#2FD06E' : '#E1F4F0'); show(S.mMail, okm ? 0 : 1); show(S.mOk, okm ? 1 : 0);
    show(S.mChip, seg(t, 11.55, 11.8));
    sc(S.mBtn, 1 - 0.05*Math.sin(Math.PI*seg(t, 11.2, 11.5)), 170, 452);
    // 4. accueil
    var pos = eio(seg(t, 13.0, 13.45)) + eio(seg(t, 13.9, 14.35));
    S.wSlides.forEach(function(c, i){ tr(c, 'translate('+((i - pos)*300).toFixed(1)+',0)'); });
    var dx0 = 143; S.wDots.forEach(function(d, i){ var on = Math.abs(i - pos) < .5; d.setAttribute('width', on ? 22 : 8); d.setAttribute('x', dx0); dx0 += (on ? 22 : 8) + 8; d.setAttribute('opacity', on ? 1 : .3); d.setAttribute('fill', on ? TEAL : '#fff'); });
    S.wBtn.t.textContent = pos > 1.5 ? 'Découvrir la carte' : 'Suivant';
    // 5. carte
    S.mPins.forEach(function(c, i){ var a = back(seg(t, 15.2 + i*0.18, 15.7 + i*0.18)); tr(c, 'translate('+c.px+','+c.py+') scale('+a.toFixed(3)+')'); show(c, seg(t, 15.2 + i*0.18, 15.4 + i*0.18)); });
    var ca = eout(seg(t, 15.5, 15.95)); show(S.mCard, ca); tr(S.mCard, 'translate(0,'+(60*(1-ca)).toFixed(1)+')');
    var aa = eout(seg(t, 15.4, 15.8)); show(S.mAsk, aa);
    sc(S.mAsk, 1 - 0.05*Math.sin(Math.PI*seg(t, 16.15, 16.5)), 170, 468);
    sc(S.mContact, 1 - 0.07*Math.sin(Math.PI*seg(t, 17.2, 17.55)), 250, 616);
    S.mChips.forEach(function(c, i){ var on = i === 0; c.r.setAttribute('fill', on ? TEAL : '#fff'); c.t.setAttribute('fill', on ? '#fff' : INK); });

    // 7. métier
    var sel = [19.8, 20.25, 99];
    S.svc.forEach(function(c, i){ var on = t >= sel[i]; c.r.setAttribute('stroke', on ? TEAL : '#DCE5E3'); c.r.setAttribute('fill', on ? '#EEF9F7' : '#fff'); show(c.ck, on ? 1 : 0); });
    var s1 = t >= 19.8; S.svcB.r.setAttribute('fill', s1 ? TEAL : '#DCE5E3');
    // 8. tarifs
    S.tCards.forEach(function(c, i){ var a = eout(seg(t, 21.35 + i*0.3, 21.8 + i*0.3)); show(c, a); tr(c, 'translate(0,'+(20*(1-a)).toFixed(1)+')');
      var k = seg(t, 21.9 + i*0.5, 22.4 + i*0.5); c.v.textContent = c.val.slice(0, Math.floor(c.val.length*k + .0001)); });
    // 9. entreprise
    typing(S.eIn, t);
    var er = eout(seg(t, 24.2, 24.5)); show(S.eRes, er);
    S.eSel.setAttribute('opacity', t >= 24.5 ? 1 : 0);
    var ez = eout(seg(t, 24.8, 25.2)); show(S.eZone, ez); tr(S.eZone, 'translate(0,'+(14*(1-ez)).toFixed(1)+')');
    // 10. CGV
    var cg = t >= 26.65; S.cgvChk.setAttribute('fill', cg ? TEAL : '#fff'); S.cgvChk.setAttribute('stroke', cg ? TEAL : '#9FC9C1'); show(S.cgvMark, cg ? 1 : 0);
    S.cgvBox.setAttribute('stroke', cg ? TEAL : '#DCE5E3'); S.cgvB.r.setAttribute('fill', cg ? TEAL : '#DCE5E3');
    // 11. pièces
    var dy = t >= 28.35; S.dYes.r.setAttribute('stroke', dy ? TEAL : '#DCE5E3'); S.dYes.r.setAttribute('fill', dy ? '#EEF9F7' : '#fff'); show(S.dYes.ck, dy ? 1 : 0);
    show(S.dNo.ck, 0); var df = eout(seg(t, 28.7, 29.1)); show(S.dFile, df); tr(S.dFile, 'translate(0,'+(12*(1-df)).toFixed(1)+')');
    S.docB.r.setAttribute('fill', dy ? TEAL : '#DCE5E3');
    // 12. dossier
    sc(S.attBtn, 1 - 0.05*Math.sin(Math.PI*seg(t, 31.55, 31.9)), 170, 482);
    // 13. annonce
    var on = t >= 33.1;
    S.aDot.setAttribute('fill', on ? TEAL : '#A5B3B9'); S.aTit.textContent = on ? 'En ligne · visible sur la carte' : 'En pause';
    S.aSub1.textContent = on ? 'Les clients proches vous voient.' : 'Votre annonce n’apparaît pas sur la carte.';
    S.aBtn.t.textContent = on ? 'Mettre en pause' : 'Mettre mon annonce en ligne';
    S.aBtn.r.setAttribute('fill', on ? '#fff' : TEAL); S.aBtn.r.setAttribute('stroke', on ? TEAL : 'none'); S.aBtn.r.setAttribute('stroke-width', 1.6); S.aBtn.t.setAttribute('fill', on ? '#0C8F7E' : '#fff');
    var fa = eout(seg(t, 33.6, 34.1)); show(S.aFx, fa); tr(S.aFx, 'translate(0,'+(14*(1-fa)).toFixed(1)+')');

    // partie 2 : séparateur
    var p2 = Math.min(seg(t, 17.7, 18.1), 1 - seg(t, 19.0, 19.4)); show($('part2'), p2);

    // touchers
    TAPS.forEach(function(q, i){
      var k = seg(t, q[0], q[0] + 0.55), c = tapEls[i];
      c.setAttribute('cx', q[1]); c.setAttribute('cy', q[2]); c.setAttribute('r', (8 + k*24).toFixed(1));
      show(c, k > 0 && k < 1 ? 0.45*(1-k) : 0);
    });

    // légende
    var cur = null, co = 0;
    for (var i = 1; i < CAPS.length - 1; i++){ var C = CAPS[i]; var o = win(t, C.a, C.b, .3); if (i === 1) o = Math.min(seg(t, 2.6, 3.0), 1 - seg(t, C.b - .3, C.b)); if (o > co) { co = o; cur = C; } }
    if (cur) { capLines[0].textContent = cur.lines[0]; capLines[1].textContent = cur.lines[1]; }
    tr($('capText'), 'translate(0,'+((1-co)*8).toFixed(1)+')');
    show($('capText'), co);
    show($('cap'), seg(t, 2.5, 2.9) * (1 - seg(t, 34.6, 35.0)) * (1 - p2));
    $('prog').setAttribute('width', (540*t/DUR).toFixed(1));

    // fin
    show($('end'), seg(t, 34.8, 35.25));
    var ek = back(seg(t, 35.1, 35.6)); tr($('endDevice'), 'translate(270,132) scale('+(.9*ek).toFixed(3)+')');
    var ex = 270 + 4*.9, ey = 132 + 53*.9;
    endRings.forEach(function(c, i){ var k = mod(t - 35.4 - i*0.6, 1.8)/1.8; c.setAttribute('cx', ex); c.setAttribute('cy', ey); c.setAttribute('r', (14 + k*130).toFixed(1)); show(c, t > 35.4 + i*0.6 ? (1-k)*0.5 : 0); });
    [['word',35.5],['e1',35.9],['e2',36.3],['e3',36.8],['e4',37.2],['e5',37.5]].forEach(function(q){ var k = eout(seg(t, q[1], q[1]+0.45)); show($(q[0]), k); tr($(q[0]), 'translate(0,'+(14*(1-k)).toFixed(1)+')'); });
  }

  // ---------- lecteur ----------
  var list = $('scenes'), sceneBtns = [];
  CAPS.forEach(function(C, i){
    var li = document.createElement('li'), b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = '<span class="tc">'+C.a.toFixed(1).replace('.',',')+' s</span><span><b></b><span class="d"></span></span>';
    b.querySelector('b').textContent = (i+1)+'. '+C.title; b.querySelector('.d').textContent = C.d;
    b.addEventListener('click', function(){ seek(C.a + (i ? 0.35 : 0.01)); playing = true; sync(); });
    li.appendChild(b); list.appendChild(li); sceneBtns.push(b);
  });

  var t = 0, playing = !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches), last = null;
  var rec = location.hash === '#record';
  if (rec) { document.body.classList.add('rec'); playing = false; }
  function seek(x){ t = clamp(x, 0, DUR); paint(); }
  function paint(){
    render(t);
    $('scrub').value = t; $('tc').textContent = t.toFixed(1).replace('.',',')+' s';
    sceneBtns.forEach(function(b, i){ b.classList.toggle('on', t >= CAPS[i].a && t < CAPS[i].b); });
  }
  function sync(){ $('play').textContent = playing ? 'Pause' : 'Lecture'; }
  function loop(now){
    if (playing) { if (last != null) { t += (now-last)/1000; if (t >= DUR) t = 0; } paint(); }
    last = now; requestAnimationFrame(loop);
  }
  $('play').addEventListener('click', function(){ playing = !playing; sync(); });
  $('replay').addEventListener('click', function(){ seek(0); playing = true; sync(); });
  $('scrub').addEventListener('input', function(e){ playing = false; sync(); seek(parseFloat(e.target.value)); });

  $('scrub').max = DUR;
  window.PING_ANIM = { duration: DUR, seek: function(x){ seek(x); } };
  var start = function(){
    buildWord(); paint(); sync();
    // ?part=pro : démarre à la partie prestataire (scène 8)
    if (!rec && /[?&]part=pro\b/.test(location.search)) { seek(19.3); }
    if (!rec) requestAnimationFrame(loop);
    window.PING_ANIM.ready = true;
  };
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(start); else start();
})();
</script>
