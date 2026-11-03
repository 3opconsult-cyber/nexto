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
