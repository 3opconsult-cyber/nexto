  // ---------- variante : « PING pour les prestataires » (/animation-prestataire) ----------
  // Même principe que c2_var_client.js. Rien du côté client (carte des prestataires, chat/devis vu du client, agenda,
  // facture, QR d'ouverture du lien, création de compte particulier) ; le seul QR / « Je m'inscris » est l'écran final.
  // Arguments : les 7 (créneaux 43,2 + 3 s × n).
  var VAR = {
    label: function(t){ return t < 30.6 ? 'PING · Côté prestataire' : 'PING · Je suis prestataire'; },
    screens: [['sDem', 7.8], ['sProf', 31.0], ['sTar', 34.6], ['sDisp', 38.8], ['sOn', 41.0]],
    caps: function(C){
      C.splice(0, 9, { a: 7.8, b: 10.6, lines: ['Les demandes autour de vous,', 'urgentes en orange.'] },
                     { a: 10.6, b: 12.8, lines: ['Touchez une demande :', 'budget, distance, détail.'] });
    },
    segs: [[0, 4.7, false], [7.8, 12.8, false], [30.9, 69.5, true]],
    intro: ['Et si vos prochains clients', 'se trouvaient juste', 'à côté ?'],
    end: { e1: 'PING pour les prestataires.', e5: 'nexto-eta.vercel.app/l/insp' },
    ui: [
      { s: 0,    title: 'Accroche', d: "Logo PING et son écho radar : « Et si vos prochains clients se trouvaient juste à côté ? »" },
      { s: 7.8,  title: 'Demandes autour de moi', d: "La carte des demandes ouvertes à proximité, les urgentes en orange ; un clic ouvre le détail (budget, distance, description)." },
      { s: 30.6, title: 'Je suis prestataire', d: "Mon profil > Proposer mes services : devenir prestataire, inscription gratuite." },
      { s: 34.6, title: 'Mes tarifs', d: "Un prix par service : forfait, à l'heure, ou forfait + heures supplémentaires." },
      { s: 38.8, title: 'Mes disponibilités', d: "Créneaux libres (jour, semaine, répétition), puis bouton Disponible : visible sur la carte des clients." },
      { s: 43.2, title: 'Moins de factures, plus de services', d: "Argument 1 : la facture se génère à chaque mission." },
      { s: 46.2, title: 'Moins de paperasse, plus de travail', d: "Argument 2 : les pièces se déposent une seule fois." },
      { s: 49.2, title: 'Moins d’administratif, plus de productif', d: "Argument 3 : le prix est fixé avant la mission." },
      { s: 52.2, title: 'QR de sécurité : l’heure fait foi', d: "QR code à l'arrivée et au départ." },
      { s: 55.2, title: 'Prestataires et clients se notent', d: "Avis croisés après chaque mission." },
      { s: 58.2, title: 'Service litige', d: "Un dossier, un médiateur PING." },
      { s: 61.2, title: 'Paiement sécurisé sous séquestre', d: "Vous êtes payé : le paiement reste sous séquestre jusqu'à la fin de la mission." },
      { s: 64.2, title: 'Final', d: "Logo PING, QR code d'inscription prestataire (/l/insp) et bouton « Je m'inscris » (page web seulement)." }
    ]
  };
