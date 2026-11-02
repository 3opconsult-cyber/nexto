  // Écrans du téléphone repris tels quels de l'animation de référence (viseur, coche, chrono, avis).
  // P = liste de phases [début, fin, ...] ; la phase courante est la dernière commencée.
  function phaseOf(t, P){ var cur = P[0]; P.forEach(function(p){ if (t >= p[0] - .01) cur = p; }); return cur; }
  function anyWin(t, P, f){ var o = 0; P.forEach(function(p){ o = Math.max(o, win(t, p[0], p[1], f)); }); return o; }
  function scanScreen(t, P){
    var p = phaseOf(t, P);
    S('scan', anyWin(t, P, .2));
    var sl = seg(t, p[0] + .3, p[1] - .6);
    tr($('scanline'), 'translate(0,'+(134 + 126*Math.sin(sl*Math.PI)).toFixed(1)+')');
    $('scanLabel').textContent = p[2];
  }
  function okScreen(t, P){
    var p = phaseOf(t, P);
    S('ok', anyWin(t, P, .2));
    tr($('okDisc'), 'translate(125,190) scale('+back(seg(t, p[0], p[0] + .4)).toFixed(3)+')');
    $('okTitle').textContent = p[2]; $('okTime').textContent = p[3]; $('okSub').textContent = p[4];
  }
  function rateScreen(t, a){
    S('rate', seg(t, a, a + .3));
    stars.forEach(function(sp, i){ sp.setAttribute('transform', 'scale('+back(seg(t, a + .3 + i*.2, a + .6 + i*.2)).toFixed(3)+')'); });
    S('quote', seg(t, a + 1.4, a + 1.7));
    tr($('tip'), 'translate(125,240) scale('+back(seg(t, a + 1.9, a + 2.3)).toFixed(3)+')');
    tr($('total'), 'translate(125,330) scale('+back(seg(t, a + 2.6, a + 3.0)).toFixed(3)+')');
  }
