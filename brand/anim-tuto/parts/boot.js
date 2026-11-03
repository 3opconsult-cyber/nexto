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

%%PLAYER_JS%%
  var PANEL = CFG.caps.map(function(C){ return { at: C.a, S: C }; }).concat([{ at: CFG.end, S: { title:'Signature', d: CFG.endDesc } }]);
  makePlayer({
    dur: CFG.dur,
    scenes: PANEL.map(function(P){ return { a: P.at, go: P.at + 0.01, title: P.S.title, d: P.S.d }; }),
    init: buildWord, still: CFG.still,
    paint: render
  });
