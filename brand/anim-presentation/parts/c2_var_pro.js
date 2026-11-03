  // ---------- variante : « PING pour les prestataires » (/animation-prestataire) ----------
  // Même principe que c2_var_client.js. Rien du côté client (carte des prestataires, chat/devis vu du client, agenda,
  // facture, QR d'ouverture du lien, création de compte particulier) ; le seul QR / « Je m'inscris » est l'écran final.
  // Arguments : les 7 (créneaux 43,2 + 3 s × n).
  var VAR = {
    label: function(t){ return t < 30.6 ? 'PING · Côté prestataire' : 'PING · Je suis prestataire'; },
    screens: [['sDem', 7.8], ['sProf', 31.0], ['sTar', 34.6], ['sDisp', 38.8], ['sOn', 41.0]],
    // Écrans d'argument ajoutés le 3/11 (avant « Moins de factures ») : pièces déposées, visibilité sur la carte.
    extra: [
      { i: 'shield', l: [['Ajoutez vos pièces'], ['pour apparaître.', 'g']], s: ['Assurance, diplôme : montrez vos qualités,', 'vos pièces fournies sont visibles', 'des clients sur votre profil.'] },
      { i: 'pin', l: [['Où que vous soyez,'], ['PING vous rend visible.', 'g']], s: ['Les clients autour de vous', 'vous voient sur la carte.'] }
    ],
    args: [7, 8, 1, 3, 4, 5, 6],         // créneaux 43,2 + 3 s × n (écrans « Moins de factures » et « Moins d'administratif » retirés, 03/11)
    end0: 64.2,                           // écran final : 43,2 + 7 écrans × 3 s
    caps: function(C){
      C.splice(0, 9, { a: 7.8, b: 10.6, lines: ['Les demandes autour de vous,', 'urgentes en orange.'] },
                     { a: 10.6, b: 12.8, lines: ['Touchez une demande :', 'budget, distance, détail.'] });
    },
    segs: [[0, 4.7, false], [34.6, 43.2, true], [7.8, 12.8, true], [43.2, 69.5, true]],   // accroche → tarifs, disponibilités → demandes urgentes (après le planning) → arguments
    intro: ['Et si vos prochains clients', 'se trouvaient juste', 'à côté ?'],
    end: { e1: 'PING, l’application de rencontre', e2: 'client-prestataire, en proximité · Côte d’Azur', e5: 'nexto-eta.vercel.app/l/insp' },
    ui: [
      { s: 0,    k: 0, title: 'Accroche', d: "Logo PING et son écho radar : « Et si vos prochains clients se trouvaient juste à côté ? »" },
      { s: 34.6, k: 1, title: 'Mes tarifs', d: "Un prix par service : forfait, à l'heure, ou forfait + heures supplémentaires." },
      { s: 38.8, k: 1, title: 'Mes disponibilités', d: "Créneaux libres (jour, semaine, répétition), puis bouton Disponible : visible sur la carte des clients." },
      { s: 7.8,  k: 2, title: 'Demandes autour de moi', d: "La carte des demandes ouvertes à proximité, les urgentes en orange ; un clic ouvre le détail (budget, distance, description)." },
      { s: 43.2, k: 3, title: 'Ajoutez vos pièces', d: "Assurance, diplôme : les pièces fournies apparaissent sur le profil, visibles des clients." },
      { s: 46.2, k: 3, title: 'PING vous rend visible', d: "Où que vous soyez, les clients autour de vous vous voient sur la carte." },
      { s: 49.2, k: 3, title: 'Facture automatisée, plus de productivité', d: "Argument : la facture se génère automatiquement à chaque mission." },
      { s: 52.2, k: 3, title: 'QR de sécurité : l’heure fait foi', d: "QR code à l'arrivée et au départ." },
      { s: 55.2, k: 3, title: 'Prestataires et clients se notent', d: "Avis croisés après chaque mission." },
      { s: 58.2, k: 3, title: 'Service litige', d: "Un dossier, un médiateur PING." },
      { s: 61.2, k: 3, title: 'Paiement sécurisé sous séquestre', d: "Vous êtes payé : le paiement reste sous séquestre jusqu'à la fin de la mission." },
      { s: 64.2, k: 3, title: 'Final', d: "Logo PING, QR code d'inscription prestataire (/l/insp) et bouton « Je m'inscris » (page web seulement)." }
    ]
  };
