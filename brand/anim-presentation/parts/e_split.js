%%PLAYER_JS%%
  // ---------- animation à tronçons (client / prestataire) : temps de LECTURE T -> temps SOURCE t ----------
  // VAR.segs = [[début source, fin source, fondu, vitesse (facultatif, 1 par défaut ; < 1 = ralenti)]] joués bout à bout,
  // dans n'importe quel ordre du temps source ; seek(T) reste déterministe (pur calcul).
  // À une jonction avec fondu, un voile navy monte puis redescend (±0,25 s) : la coupure se fait au plus sombre.
  var SEGS = [], TOTAL = 0;
  VAR.segs.forEach(function(g){ var r = g[3] || 1, d = (g[1] - g[0]) / r; SEGS.push({ s0: g[0], s1: g[1], r: r, t0: TOTAL, t1: TOTAL + d, dip: g[2] }); TOTAL += d; });
  function srcOf(T){
    for (var i = 0; i < SEGS.length; i++) if (T < SEGS[i].t1 || i === SEGS.length - 1) return Math.min(SEGS[i].s1, SEGS[i].s0 + Math.max(0, T - SEGS[i].t0) * SEGS[i].r);
  }
  function toT(s, k){   // début de rubrique (temps source, tronçon k si donné) -> temps de lecture ; un trou se rabat sur le tronçon suivant
    if (k != null) { var g = SEGS[k]; return s <= g.s0 ? g.t0 : Math.min(g.t1, g.t0 + (s - g.s0) / g.r); }
    for (var i = 0; i < SEGS.length; i++) {
      if (s < SEGS[i].s0) return SEGS[i].t0;
      if (s < SEGS[i].s1) return SEGS[i].t0 + (s - SEGS[i].s0) / SEGS[i].r;
    }
    return TOTAL;
  }
  var dip = el('rect', { x: 0, y: 0, width: 540, height: 960, fill: '#123644', opacity: 0 });
  $('svg').insertBefore(dip, $('prog'));
  var cta = $('cta');
  makePlayer({
    dur: TOTAL,
    scenes: VAR.ui.map(function(C, i){ var a = toT(C.s, C.k); return { a: a, go: a + (i ? 0.7 : 0.01), title: C.title, d: C.d }; }),
    init: function(){
      introDot = buildWord($('introWord'), 92, 330, 270);
      endDot = buildWord($('endWord'), 76, 300, 270);
      if (VAR.intro) ['in1', 'in2', 'in3'].forEach(function(id, i){ $(id).textContent = VAR.intro[i]; });
      if (VAR.end) for (var k in VAR.end) $(k).textContent = VAR.end[k];
    },
    paint: function(T){
      var t = srcOf(T);
      render(t);
      $('prog').setAttribute('width', (540*T/TOTAL).toFixed(1));
      var d = 0;
      for (var i = 1; i < SEGS.length; i++) if (SEGS[i].dip) d = Math.max(d, 1 - Math.abs(T - SEGS[i].t0)/0.25);
      show(dip, d);
      cta.classList.toggle('on', t >= 64.6);
    }
  });
})();
</script>
