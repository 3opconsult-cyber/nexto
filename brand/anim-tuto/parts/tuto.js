  // Tuto « Après la commande » : 37 s. Scènes de Marc reprises de l'animation de référence.
  var HOUR_X = [66, 206, 346];
  var CFG = {
    dur: 37, end: 32.5, still: 12, V: 110, T1: 2.4, D: 2.6,
    phone: [[5.0, 20.9], [27.0, 32.6]],
    tags: ['Après la commande,', 'tout est tracé.', 'Particuliers et pros · inscription gratuite'],
    endDesc: "Logo ping, « Après la commande, tout est tracé. », QR vers l'inscription.",
    caps: [
      { a:0,    b:5.0,  title:'La commande est passée', l:['Votre commande est passée.','Marc est en route.'], d:"Marc, prestataire PING, se dirige vers l'adresse de la mission." },
      { a:5.0,  b:9.2,  title:'Le client présente son QR', l:['Sophie présente','son code QR.'], d:"À l'arrivée de Marc, Sophie affiche le code QR de sa mission sur son téléphone." },
      { a:9.2,  b:13.0, title:'Arrivée enregistrée', l:['Marc le scanne :',"l'arrivée est enregistrée."], d:"Marc scanne le code : l'arrivée est horodatée, c'est le début de la mission." },
      { a:13.0, b:16.8, title:'Intervention', l:['Le temps est compté','à partir de ce scan.'], d:"Le chronomètre tourne pendant l'intervention." },
      { a:16.8, b:20.9, title:'Départ enregistré', l:['Au départ, le même scan','enregistre la fin.'], d:'Second scan en fin de mission : la durée réelle est enregistrée.' },
      { a:20.9, b:27.0, title:'Heure entamée, heure due', l:['Heure entamée, heure due :','à partir de 10 minutes.'], d:"Au tarif horaire, une heure commencée est facturée dès 10 minutes (réglable). Forfait : jamais ajusté." },
      { a:27.0, b:32.5, title:'Facture, avis, pourboire', l:['Facture, avis, pourboire.','Tout est automatique.'], d:"Sophie note Marc, laisse un pourboire ; la facture est générée automatiquement." }
    ],
    who: function(t){ return t < 5.0 ? null : t < 9.2 ? 'Téléphone de Sophie' : t < 21 ? 'Téléphone de Marc' : 'Téléphone de Sophie'; },
    init: function(){
      var svg = $('svg'), g = el('g', {id:'hour', opacity:0}), r;
      svg.insertBefore(g, $('who'));
      el('rect', {x:30, y:196, width:480, height:528, rx:28, fill:'#fff', filter:'url(#sh)'}, g);
      var ti = el('text', {x:270, y:250, 'text-anchor':'middle', 'font-family':'Quicksand', 'font-weight':700, 'font-size':25, fill:'#123644'}, g); ti.textContent = 'Exemple, au tarif horaire';
      [[0, 'Intervention de 2 h 05', 5, '2 h facturées', false], [1, 'Intervention de 2 h 12', 12, '3 h facturées', true]].forEach(function(R){
        var y0 = 280 + R[0]*170, grp = el('g', {id:'hr'+R[0]}, g);
        var lb = el('text', {x:66, y:y0+22, 'font-family':'Inter', 'font-weight':600, 'font-size':16, fill:'#123644'}, grp); lb.textContent = R[1];
        HOUR_X.forEach(function(x, i){
          if (i < 2) { el('rect', {x:x, y:y0+40, width:128, height:46, rx:12, fill:'#12B39C'}, grp); var h = el('text', {x:x+64, y:y0+69, 'text-anchor':'middle', 'font-family':'Quicksand', 'font-weight':700, 'font-size':16, fill:'#fff'}, grp); h.textContent = (i+1)+' h'; }
          else {
            el('rect', {x:x, y:y0+40, width:128, height:46, rx:12, fill:'#fff', stroke:'#B8C9C5', 'stroke-width':1.6, 'stroke-dasharray':'5 5'}, grp);
            var sw = 128*R[2]/60;
            el('rect', {id:'hs'+R[0], x:x, y:y0+40, width:sw, height:46, rx:6, fill: R[4] ? '#12B39C' : '#B8C9C5'}, grp);
            var h3 = el('text', {id:'h3t'+R[0], x:x+64, y:y0+69, 'text-anchor':'middle', 'font-family':'Quicksand', 'font-weight':700, 'font-size':16, fill:'#fff', opacity:0}, grp); h3.textContent = '3 h';
          }
        });
        // seuil de 10 minutes sur la 3e heure
        var tx = HOUR_X[2] + 128*10/60;
        el('rect', {x:tx-1, y:y0+34, width:2.4, height:58, rx:1, fill:'#F2A93B'}, grp);
        var tl = el('text', {x:tx+6, y:y0+31, 'font-family':'Inter', 'font-weight':600, 'font-size':12, fill:'#8a6520'}, grp); tl.textContent = '10 min';
        var chip = el('g', {id:'hc'+R[0]}, grp);
        el('rect', {x:66, y:y0+104, width:150, height:34, rx:17, fill: R[4] ? '#12B39C' : '#EEF2F1'}, chip);
        var ct = el('text', {x:141, y:y0+127, 'text-anchor':'middle', 'font-family':'Quicksand', 'font-weight':700, 'font-size':16, fill: R[4] ? '#fff' : '#123644'}, chip); ct.textContent = R[3];
        var nt = el('text', {x:232, y:y0+127, 'font-family':'Inter', 'font-size':13, fill:'#5C7582'}, grp); nt.textContent = R[4] ? '12 min dépassent le seuil' : '5 min : sous le seuil';
      });
      var f = el('text', {x:270, y:660, 'text-anchor':'middle', 'font-family':'Inter', 'font-size':14, fill:'#5C7582'}, g); f.textContent = 'Tarif horaire : minimum 1 h.';
      var f2 = el('text', {x:270, y:684, 'text-anchor':'middle', 'font-family':'Inter', 'font-size':14, fill:'#5C7582'}, g); f2.textContent = 'Forfait : jamais ajusté.';
    },
    draw: function(t){
      S('qrShow', win(t, 5.2, 9.3, .25));
      scanScreen(t, [[9.1, 11.5, 'Scan du code client'], [16.7, 19.1, 'Scan de fin de mission']]);
      okScreen(t, [[11.3, 13.1, 'Arrivée enregistrée', '9:02', 'le décompte démarre'], [18.9, 20.9, 'Départ enregistré', '11:14', 'durée réelle : 2 h 12']]);
      S('clock', win(t, 12.9, 16.9, .2));
      var ck = eio(seg(t, 13.3, 16.0));
      $('clockArc').setAttribute('stroke-dashoffset', (364.4*(1-ck)).toFixed(1));
      $('clockTime').textContent = hhmm(9*60+2 + ck*132);
      // carte « heure entamée, heure due »
      S('hour', win(t, 20.9, 27.0, .35));
      S('hr0', seg(t, 21.4, 21.8)); S('hr1', seg(t, 23.2, 23.6));
      S('hc0', seg(t, 22.6, 22.9)); S('hc1', seg(t, 25.2, 25.5));
      var fk = eio(seg(t, 24.2, 25.0));
      $('hs1').setAttribute('width', (128*12/60 + (128 - 128*12/60)*fk).toFixed(1));
      S('h3t1', seg(t, 24.9, 25.1));
      // avis, pourboire, facture
      rateScreen(t, 27.3);
      if (t < 27.3 || t > 32.6) S('rate', 0);
    }
  };
