  // Tuto « Vous ne serez pas là ? » : 30 s. Même décor et même Marc que l'animation de référence.
  var CODE = '482716';
  var CFG = {
    dur: 30.4, end: 26.4, still: 5, V: 110, T1: 1.2, D: 2.2, paper: true, hx: 175,
    phone: [[3.4, 7.0], [10.2, 26.4]],
    tags: ['La position ne sert', "qu'à valider l'arrivée.", 'Aucun suivi en direct du prestataire.'],
    endDesc: "Logo ping, « La position ne sert qu'à valider l'arrivée. », QR vers l'inscription.",
    caps: [
      { a:0,    b:3.4,  title:'Vous ne serez pas là ?', l:['Vous ne serez pas là ?','Pas de souci.'], d:"Marc arrive à l'adresse de la mission, le client est absent." },
      { a:3.4,  b:7.2,  title:'Un QR unique', l:['Générez un QR unique','pour votre mission.'], d:"Dans l'application, le client génère le QR unique de sa mission." },
      { a:7.2,  b:10.2, title:'Laissé sur place', l:['Laissez-le sur place :','écran ou papier.'], d:"Le QR est laissé sur place, à l'écran ou imprimé, par exemple sur la porte." },
      { a:10.2, b:13.2, title:'Arrivée enregistrée', l:['Marc le scanne :',"l'arrivée est enregistrée."], d:"Marc scanne le QR : l'arrivée est horodatée." },
      { a:13.2, b:16.5, title:'Sans QR : la position', l:['Sans QR, Marc envoie','sa position, avec accord.'], d:"Si le QR n'est pas disponible, Marc envoie sa position après avoir donné son accord. Le GPS ne sert qu'à cela." },
      { a:16.5, b:19.5, title:"L'adresse est comparée", l:["L'adresse est comparée",'à celle de la demande.'], d:"La position envoyée est comparée à l'adresse de la demande." },
      { a:19.5, b:22.5, title:'Un code unique', l:['Un code unique arrive','chez le client, dans l\'appli.'], d:"Un code unique est envoyé au client dans l'application." },
      { a:22.5, b:26.4, title:'Le code est saisi', l:['Marc saisit le code :',"l'arrivée est enregistrée."], d:"Marc saisit le code : l'arrivée est enregistrée." }
    ],
    who: function(t){ return t < 3.4 ? null : t < 7.2 ? 'Téléphone de Sophie' : t < 19.5 ? 'Téléphone de Marc' : t < 22.5 ? 'Téléphone de Sophie' : 'Téléphone de Marc'; },
    init: function(){
      var g = $('typeBoxes');
      for (var i = 0; i < 6; i++) {
        el('rect', {x:20 + i*36, y:164, width:30, height:46, rx:10, fill:'#fff', stroke:'#DCE5E3', 'stroke-width':1.4}, g);
        var d = el('text', {id:'td'+i, x:35 + i*36, y:196, 'text-anchor':'middle', 'font-family':'Quicksand', 'font-weight':700, 'font-size':22, fill:'#123644', opacity:0}, g);
        d.textContent = CODE.charAt(i);
      }
    },
    draw: function(t){
      // 1. le client génère le QR
      S('gen', win(t, 3.6, 6.9, .25));
      var gp = 1 - 0.07*Math.sin(Math.PI*seg(t, 4.4, 4.8));
      tr($('genBtn'), 'translate(125,134) scale('+gp.toFixed(3)+')');
      var done = t >= 4.65;
      $('genBtnBg').setAttribute('fill', done ? '#2FD06E' : '#123644'); $('genBtnTx').textContent = done ? 'QR généré' : 'Générer mon QR unique';
      pulse('genTap', t, 4.4, 5.0);
      var gk = back(seg(t, 4.8, 5.3));
      S('genCard', seg(t, 4.8, 5.0)); tr($('genCard'), 'translate(125,229) scale('+gk.toFixed(3)+') translate(-125,-229)');
      // 2. laissé sur la porte
      S('paper', seg(t, 7.2, 7.7));
      // 3. scan du QR de la porte
      scanScreen(t, [[10.4, 12.3, 'Scan du QR de la mission']]);
      okScreen(t, [[12.1, 13.5, 'Arrivée enregistrée', '9:02', 'QR de la mission scanné'], [24.7, 26.5, 'Arrivée enregistrée', '9:02', 'code valide']]);
      // 4. sans QR : position, avec accord
      S('pos', win(t, 13.3, 16.6, .25));
      var pk = t >= 14.9;
      $('posBtnBg').setAttribute('fill', pk ? '#2FD06E' : '#12B39C'); $('posBtnTx').textContent = pk ? 'Position envoyée' : "J'autorise";
      tr($('posBtn'), 'translate(125,338) scale('+(1 - 0.07*Math.sin(Math.PI*seg(t, 14.6, 15.0))).toFixed(3)+')');
      pulse('posTap', t, 14.6, 15.2);
      // 5. comparaison avec l'adresse de la demande
      S('cmp', win(t, 16.4, 19.7, .25));
      S('cmpOk', seg(t, 17.7, 17.9)); tr($('cmpOk'), 'translate(125,310) scale('+back(seg(t, 17.7, 18.2)).toFixed(3)+')');
      S('cmpTx', seg(t, 18.0, 18.3));
      // 6. code unique chez le client
      S('code', win(t, 19.5, 22.7, .25));
      // 7. saisie du code
      S('type', win(t, 22.5, 24.9, .25));
      for (var i = 0; i < 6; i++) S('td'+i, seg(t, 22.9 + i*.2, 23.05 + i*.2));
      tr($('typeBtn'), 'translate(125,252) scale('+(1 - 0.07*Math.sin(Math.PI*seg(t, 24.0, 24.4))).toFixed(3)+')');
      pulse('typeTap', t, 24.0, 24.6);
    }
  };
