  // ---------- variante : « PING pour les particuliers » (/animation-client) ----------
  // Scénario (Romain, 3/11) : 1 accroche · 2 la carte (les prestataires autour de vous) · 3 vous choisissez votre prestataire ·
  // 4 le chat : vous validez le prix et payez, paiement sous séquestre · 5 à son arrivée, QR de sécurité · 6 vous notez votre
  // prestataire · 7 final (QR /l/ins + « Je m'inscris »). Aucune nouvelle illustration : ce sont des tronçons du temps SOURCE de
  // d_scenes.js, rejoués dans cet ordre (segs, assemblés par e_split.js). Pas de tuto d'inscription, agenda, facture ni litige ici
  // (ils restent dans /animation-ping et /aide). Arguments : créneaux ARG0 + 3 s × n -> QR de sécurité (43,2) et avis (46,2).
  var VAR = {
    label: function(t){ return 'PING · L’application'; },
    screens: [['sMap', 4.6], ['sChat', 10.8], ['sMapT', 26.9]],
    args: [3, 4],
    argEdit: function(A){
      A[0].l = [['À son arrivée, vous scannez'], ['son QR code :'], ['l’heure fait foi.', 'g']];
      A[0].s = 'Arrivée et départ sont pointés par QR code.';
      A[1].l = [['Vous notez'], ['votre prestataire'], ['en quelques clics.', 'g']];
      A[1].s = 'Un avis croisé après chaque mission.';
    },
    caps: function(C){
      C.length = 0;
      C.push({ a: 4.7,  b: 7.8,  lines: ['Les prestataires disponibles', 'autour de vous.'] },
             { a: 27.6, b: 30.2, lines: ['Vous choisissez', 'votre prestataire.'] },
             { a: 10.9, b: 13.5, lines: ['Vous validez le prix et', 'payez directement dans le chat.'] },
             { a: 13.5, b: 14.75, lines: ['Votre paiement reste sous séquestre', 'jusqu’à la fin de la mission.'] });
    },
    // [début source, fin source, fondu au navy à la jonction, vitesse]
    segs: [[0, 7.8, false], [27.6, 30.2, true, 0.8], [10.9, 14.75, true, 0.6], [43.3, 49.2, true], [64.2, 69.5, true]],
    end: { e1: 'PING pour les particuliers.', e5: 'nexto-eta.vercel.app/l/ins' },
    ui: [   // k = rang du tronçon dans segs
      { k: 0, s: 0,    title: 'Accroche', d: "Logo PING et son écho radar : « Et si ce que vous cherchez se trouvait juste à côté ? »" },
      { k: 0, s: 4.6,  title: 'La carte', d: "Les prestataires disponibles autour de vous, sur la carte." },
      { k: 1, s: 27.6, title: 'Vous choisissez votre prestataire', d: "Le service choisi, la fiche du prestataire sur la carte, puis « Contacter »." },
      { k: 2, s: 10.9, title: 'Le chat, le prix et le paiement', d: "Vous validez le prix et payez directement dans le chat ; le paiement reste sous séquestre jusqu'à la fin de la mission." },
      { k: 3, s: 43.2, title: 'À son arrivée : le QR de sécurité', d: "Vous scannez son QR code : l'heure fait foi." },
      { k: 3, s: 46.2, title: 'Vous notez votre prestataire', d: "Un avis en quelques clics après la mission." },
      { k: 4, s: 64.2, title: 'Final', d: "Logo PING, QR code d'inscription (/l/ins) et bouton « Je m'inscris » (page web seulement)." }
    ]
  };
