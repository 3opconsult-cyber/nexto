"use client"
import React from 'react'

// Vues du prototype portees en React (markup verbatim d'app.html, transforme).
// v_map et v_search sont les versions reelles (branchees Supabase) dans DemoShell.
type Props = {
  view: string
  go: (v: string) => void
  back: (v?: string) => void
  H: (expr: string, e: React.SyntheticEvent) => void
}
export default function ProtoClientViews({ view, go, back, H }: Props) {
  return (
    <>
<section className={`view ${view === 'v_provider' ? 'on' : ''}`} id="v_provider" data-tab="map">
      <div className="appbar"><div className="ic" onClick={()=>back('v_map')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2"><path d="M15 6l-6 6 6 6"/></svg></div><b>Profil du pro</b></div>
      <div className="body nopad" style={{ bottom: '132px' }}>
        <div className="hero"><div className="big">S</div><h2>Sofia M.</h2><div className="meta">Sofia Services · 4,9 (214 avis) · à 350 m</div><div className="dispo" style={{ color: '#fff', marginTop: '6px' }}><span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#fff', display: 'inline-block' }}></span> Disponible maintenant</div></div>
        <div style={{ padding: '14px 16px' }}>
          <div className="h2" style={{ marginTop: '0' }}><span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2.4"><path d="M12 2l8 4v5c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z"/><path d="M9 12l2 2 4-4"/></svg> Informations déclarées par le pro</span></div>
          <div className="vrow ok"><div className="vi"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--tealD)" strokeWidth="2"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="12" r="2.4"/></svg></div><div className="vt"><b>Pièce d'identité fournie</b><small>Déposée sur PING par le pro</small></div><div className="vs"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#12B39C" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg> Fournie</div></div>
          <div className="vrow ok"><div className="vi"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--tealD)" strokeWidth="2"><path d="M12 3l8 4v5c0 5-3.5 8-8 10-4.5-2-8-5-8-10V7z"/></svg></div><div className="vt"><b>Assurance resp. civile</b><small>Renseignée par le pro (casse/dommage)</small></div><div className="vs"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#12B39C" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg> Renseignée</div></div>
          <div className="vrow ok"><div className="vi"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--tealD)" strokeWidth="2"><path d="M4 6h16v13H4z"/><path d="M8 11h8M8 15h5"/></svg></div><div className="vt"><b>Attestation crédit d'impôt</b><small>Peut établir la déclaration fiscale</small></div><div className="vs"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#12B39C" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg> Possible</div></div>
          <p className="sub" style={{ fontSize: '10.5px', color: '#9aa6a3', marginTop: '2px' }}>Place de marché : informations déclarées par le prestataire et collectées par PING, sans garantie.</p><div className="h2">Compétences</div><div className="chipset"><span className="sk">Ménage complet</span><span className="sk">Repassage</span><span className="sk">Vitres</span><span className="sk">Sols</span><span className="sk">Cuisine &amp; salle de bain</span></div>
          <div className="h2">Avis <span className="badge teal">après prestation</span></div>
          <div className="rev"><div className="t"><span className="n">Julie <span className="ver"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#12B39C" strokeWidth="2.4"><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></svg></span></span><span className="stars">★★★★★</span></div><p>Impeccable, tout était nickel en repartant. Très soigneuse.</p></div>
          <div className="rev"><div className="t"><span className="n">Karim <span className="ver"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#12B39C" strokeWidth="2.4"><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></svg></span></span><span className="stars">★★★★★</span></div><p>Ponctuel, clair sur le prix, aucune surprise.</p></div>
        </div>
      </div>
      <div className="foot"><div style={{ display: 'flex', gap: '10px' }}><div className="btn ghost" style={{ flex: '1' }} onClick={()=>go('v_chat')}>Contacter</div><div className="btn" style={{ flex: '1.4' }} onClick={()=>go('v_booking')}>Réserver · 90 €</div></div></div>
    </section>

<section className={`view ${view === 'v_chat' ? 'on' : ''}`} id="v_chat" data-tab="messages">
      <div className="appbar"><div className="ic" onClick={()=>back('v_provider')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2"><path d="M15 6l-6 6 6 6"/></svg></div><b>Sofia M.</b><span style={{ fontSize: '11px', color: 'var(--teal)', marginLeft: '6px' }}>● en ligne · identité masquée</span><span className="sp"><span className="ic" onClick={()=>go('v_signaler_conv')} title="Signaler cet échange"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="var(--slate)" strokeWidth="2"><path d="M5 3v18"/><path d="M5 4h11l-1.5 4L16 12H5"/></svg></span></span></div>
      <div className="msgs noscroll" style={{ top: '48px' }}>
        <div className="notice">Coordonnées protégées jusqu'au QR de fin</div>
        <div className="msg me">Bonjour, j'aurais besoin d'un ménage complet pour un T3. Vous seriez dispo cette semaine ?</div>
        <div className="msg them">Oui, bien sûr. Vous auriez une photo du logement ?</div>
        <div className="msg them">Parfait. Votre logement est accessible facilement ?</div>
        <div className="msg me">Oui, c'est de 3 pièces.</div>
        <div className="msg them">Très bien, voici mon devis.</div>
        <div className="offer"><div className="k">Devis</div><div className="p"><span style={{ color: 'var(--slate)', fontSize: '12px' }}>Ménage complet · 90 € + 15 € déplacement</span><span className="big">105 €</span></div><div className="btn" style={{ marginTop: '10px' }} onClick={()=>go('v_booking')}>Choisir un créneau</div></div>
      </div>
      <div className="inputbar"><div className="f">Écrire un message…</div><div className="snd"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/></svg></div></div>
    </section>

<section className={`view ${view === 'v_signaler_conv' ? 'on' : ''}`} id="v_signaler_conv" data-tab="messages">
      <div className="appbar"><div className="ic" onClick={()=>back('v_chat')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2"><path d="M15 6l-6 6 6 6"/></svg></div><b>Signaler cet échange</b></div>
      <div className="body">
        <div className="h1">Que se passe-t-il&nbsp;?</div>
        <p className="sub">PING n'assure pas de surveillance continue des échanges. Ce signalement transmet l'historique de <b>cette conversation</b> à PING pour examen.</p>

        <div className="h2">Motif</div>
        <div className="statut on" onClick={(e)=>H('pickStatut(this)', e)}><b>Propos déplacés ou insultants</b><small>Langage irrespectueux, menaçant ou grossier</small></div>
        <div className="statut" onClick={(e)=>H('pickStatut(this)', e)}><b>Sollicitation suspecte</b><small>Demande de paiement ou de contact en dehors de PING</small></div>
        <div className="statut" onClick={(e)=>H('pickStatut(this)', e)}><b>Comportement inapproprié</b><small>Propos ou attitude à caractère déplacé</small></div>
        <div className="statut" onClick={(e)=>H('pickStatut(this)', e)}><b>Autre</b><small>Un autre motif, à préciser ci-dessous</small></div>

        <div className="h2">Votre description <span style={{ color: 'var(--slate)', fontWeight: '500' }}>· facultatif</span></div>
        <div className="field2"><div className="l">Précisions</div><div className="v" style={{ color: 'var(--slate)', lineHeight: '1.5' }}>Ajoutez tout élément utile à l'examen du signalement…</div></div>

        <div className="card" style={{ borderColor: '#F5D9A6', background: '#FFFBF2' }}>
          <div style={{ fontFamily: 'var(--fh)', fontWeight: '700', color: 'var(--ink)', fontSize: '13px', marginBottom: '6px' }}>Ce qui se passe ensuite</div>
          <div className="lrow"><span className="s">1. L'historique de cet échange est transmis à PING</span><span className="v">immédiat</span></div>
          <div className="lrow"><span className="s">2. Examen du fil par PING</span><span className="v">sous quelques jours</span></div>
          <div className="lrow"><span className="s">3. Mesure proportionnée si nécessaire</span><span className="v">avertissement, suspension</span></div>
          <div className="note2" style={{ marginTop: '8px' }}>PING n'exerce pas de modération éditoriale préalable des échanges et n'intervient que sur signalement. Pour un problème lié à une prestation déjà payée, utilisez plutôt « Signaler un problème » depuis la réservation concernée — le paiement y reste sous séquestre.</div>
        </div>
      </div>
      <div className="foot"><div className="btn" onClick={()=>go('v_signaler_conv_ok')}>Envoyer le signalement</div></div>
    </section>

<section className={`view ${view === 'v_signaler_conv_ok' ? 'on' : ''}`} id="v_signaler_conv_ok" data-tab="messages">
      <div className="appbar"><div className="ic" onClick={()=>back('v_chat')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2"><path d="M15 6l-6 6 6 6"/></svg></div><b>Signalement envoyé</b></div>
      <div className="body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', paddingTop: '44px' }}>
        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(18,179,156,.12)', display: 'grid', placeItems: 'center', marginBottom: '16px' }}><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#12B39C" strokeWidth="2.6"><path d="M20 6L9 17l-5-5"/></svg></div>
        <div className="h1" style={{ marginTop: '0' }}>C'est transmis</div>
        <p className="sub">L'historique de cette conversation a été transmis à PING pour examen. Vous pouvez continuer à échanger normalement en attendant.</p>
        <div className="btn ghost" style={{ marginTop: '20px', width: '100%' }} onClick={()=>go('v_chat')}>Retour à la conversation</div>
      </div>
    </section>

<section className={`view ${view === 'v_booking' ? 'on' : ''}`} id="v_booking" data-tab="map">
      <div className="appbar"><div className="ic" onClick={()=>back('v_provider')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2"><path d="M15 6l-6 6 6 6"/></svg></div><b>Choisir un créneau</b></div>
      <div className="body">
        <div className="days"><div className="day on"><small>Auj.</small><b>14</b></div><div className="day"><small>Mer</small><b>15</b></div><div className="day"><small>Jeu</small><b>16</b></div><div className="day"><small>Ven</small><b>17</b></div><div className="day"><small>Sam</small><b>18</b></div></div>
        <div className="sub" style={{ marginTop: '12px' }}>Disponibilités synchronisées avec l'agenda du pro</div>
        <div className="slots">
          <div className="slot taken">9h00</div><div className="slot" onClick={(e)=>H('pickSlot(this)', e)}>10h30</div><div className="slot taken">11h30</div>
          <div className="slot" onClick={(e)=>H('pickSlot(this)', e)}>14h00</div><div className="slot on" onClick={(e)=>H('pickSlot(this)', e)}>15h00</div><div className="slot taken">16h30</div>
        </div>
      </div>
      <div className="foot"><div className="btn" onClick={()=>go('v_pay')}>Confirmer · 15h00</div></div>
    </section>

<section className={`view ${view === 'v_pay' ? 'on' : ''}`} id="v_pay" data-tab="map">
      <div className="appbar"><div className="ic" onClick={()=>back('v_booking')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2"><path d="M15 6l-6 6 6 6"/></svg></div><b>Paiement sécurisé</b></div>
      <div className="body">
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'var(--fh)', fontWeight: '700', color: 'var(--ink)', fontSize: '15px' }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg> Séquestre PING</div>
          <p className="sub">Fonds bloqués, libérés après le QR de fin. Remboursé si litige sous 48 h.</p>
          <div style={{ marginTop: '12px' }}><div className="lrow"><span className="s">Intervention · ménage 85 m²</span><span className="v">90,00 €</span></div><div className="lrow"><span className="s">Déplacement (proximité)</span><span className="v">15,00 €</span></div><div className="lrow"><span className="s">Frais de service (5 %)</span><span className="v">5,25 €</span></div></div>
          <div className="tot"><span style={{ fontWeight: '700', color: 'var(--ink)' }}>Total</span><span className="big">110,25 €</span></div>
        </div>
      </div>
      <div className="foot"><div className="btn dark" onClick={()=>go('v_track')}>Payer 110,25 € en séquestre</div></div>
    </section>

<section className={`view ${view === 'v_track' ? 'on' : ''}`} id="v_track" data-tab="agenda">
      <div className="appbar"><b>Rendez-vous confirmé</b></div>
      <div className="body">
        <div className="minimap"><svg viewBox="0 0 100 60" preserveAspectRatio="none" style={{ position: 'absolute', inset: '0', width: '100%', height: '100%' }}><rect width="100" height="60" fill="var(--land)"/><g stroke="var(--roadcase)" strokeWidth="5"><line x1="0" y1="20" x2="100" y2="20"/><line x1="20" y1="0" x2="20" y2="60"/><line x1="62" y1="0" x2="62" y2="60"/></g><g stroke="#fff" strokeWidth="3"><line x1="0" y1="20" x2="100" y2="20"/><line x1="20" y1="0" x2="20" y2="60"/><line x1="62" y1="0" x2="62" y2="60"/></g></svg>
          <div style={{ position: 'absolute', left: '20%', top: '70%', transform: 'translate(-50%,-50%)' }}><div className="mk" style={{ width: '28px', height: '28px' }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><circle cx="12" cy="9" r="3"/><path d="M6 20a6 6 0 0 1 12 0"/></svg></div></div>
          <div style={{ position: 'absolute', left: '62%', top: '40%', transform: 'translate(-50%,-100%)' }}><div className="mk" style={{ background: 'var(--coral)', width: '28px', height: '28px' }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4"><path d="M3 11l9-8 9 8"/><path d="M5 10v9h14v-9"/></svg></div></div>
        </div>
        <div className="card" style={{ marginTop: '14px' }}><div style={{ display: 'flex', alignItems: 'center', gap: '9px', fontFamily: 'var(--fh)', fontWeight: '700', color: 'var(--ink)', fontSize: '14px' }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2.4"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg> Marc arrive à 15h00</div><p className="sub">Vous serez notifié à son arrivée. Pièce d'identité fournie, assurance renseignée.</p></div>
      </div>
      <div className="foot"><div className="btn" onClick={()=>go('v_qr')}>Il est arrivé · valider</div></div>
    </section>

<section className={`view ${view === 'v_qr' ? 'on' : ''}`} id="v_qr" data-tab="agenda">
      <div className="appbar"><div className="ic" onClick={()=>back('v_track')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2"><path d="M15 6l-6 6 6 6"/></svg></div><b>Valider l'arrivée</b></div>
      <div className="body center">
        <div className="h1" style={{ textAlign: 'center' }}>Scannez le QR de Marc</div><p className="sub" style={{ textAlign: 'center' }}>Étape 1 sur 2 &mdash; enregistre l'heure d'arrivée. Le paiement reste sous séquestre.</p>
        <div className="qr"><div className="g" id="qrg"></div></div>
        <div className="card" style={{ marginTop: '14px', width: '100%' }}>
          <div className="lrow"><span className="s">Arrivée</span><span className="v" style={{ color: 'var(--slate)' }}>en attente de scan</span></div>
          <div className="lrow"><span className="s">Départ</span><span className="v" style={{ color: 'var(--slate)' }}>—</span></div>
        </div>
      </div>
      <div className="foot"><div className="btn" onClick={()=>go('v_qr_depart')}>Confirmer l'arrivée</div></div>
    </section>

<section className={`view ${view === 'v_qr_depart' ? 'on' : ''}`} id="v_qr_depart" data-tab="agenda">
      <div className="appbar"><div className="ic" onClick={()=>back('v_qr')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2"><path d="M15 6l-6 6 6 6"/></svg></div><b>Valider le départ</b></div>
      <div className="body center">
        <div className="h1" style={{ textAlign: 'center' }}>Prestation terminée&nbsp;?</div>
        <p className="sub" style={{ textAlign: 'center' }}>Étape 2 sur 2 &mdash; scannez à nouveau le QR au moment du départ. C'est cette validation qui libère le paiement.</p>
        <div className="qr"><div className="g" id="qrg4"></div></div>
        <div className="card" style={{ marginTop: '14px', width: '100%' }}>
          <div className="lrow"><span className="s">Arrivée</span><span className="v" style={{ color: 'var(--tealD)', fontWeight: '700' }}>validée · 9h02</span></div>
          <div className="lrow"><span className="s">Départ</span><span className="v" style={{ color: 'var(--slate)' }}>en attente de scan</span></div>
          <div className="lrow"><span className="s">Durée sur place</span><span className="v">3 h 04</span></div>
        </div>
        <div className="note2" style={{ marginTop: '10px' }}>Un problème&nbsp;? <span className="edit" onClick={()=>go('v_litige')}>Signaler avant de valider</span> &mdash; le paiement reste alors bloqué.</div>
      </div>
      <div className="foot"><div className="btn" onClick={()=>go('v_receipt')}>Valider et libérer le paiement</div></div>
    </section>

<section className={`view ${view === 'v_receipt' ? 'on' : ''}`} id="v_receipt" data-tab="agenda">
      <div className="appbar"><b>Prestation terminée</b></div>
      <div className="body center">
        <div className="success"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2.4"><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></svg></div>
        <div className="h1" style={{ textAlign: 'center' }}>Fuite réglée. Tout est ok.</div>
        <div className="card" style={{ textAlign: 'left', marginTop: '14px' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontFamily: 'var(--fh)', fontWeight: '700', color: 'var(--ink)' }}>Reçu · PING</span><span className="badge teal">PAYÉ</span></div><div style={{ marginTop: '10px' }}><div className="lrow"><span className="s">Intervention + déplacement</span><span className="v">105,00 €</span></div><div className="lrow"><span className="s">Frais de service</span><span className="v">5,25 €</span></div></div><div className="tot"><span style={{ fontWeight: '700', color: 'var(--ink)' }}>Total réglé</span><span className="big">110,25 €</span></div></div>
        <p className="sub">Reçu envoyé par e-mail · facture émise automatiquement pour Marc.</p>
      </div>
      <div className="foot"><div className="btn" onClick={()=>go('v_review')}>Laisser un avis</div></div>
    </section>

<section className={`view ${view === 'v_review' ? 'on' : ''}`} id="v_review" data-tab="agenda">
      <div className="appbar"><div className="ic" onClick={()=>back('v_receipt')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2"><path d="M15 6l-6 6 6 6"/></svg></div><b>Laisser un avis</b></div>
      <div className="body">
        <div className="h1 center">Votre expérience avec Marc ?</div>
        <div className="ratewrap" id="rate"></div>
        <div className="commentbox">Rapide et efficace, appartement impeccable en moins d'une heure. Je recommande.</div>
        <div style={{ fontFamily: 'var(--fh)', fontWeight: '700', color: 'var(--ink)', fontSize: '13px', margin: '14px 0 4px', display: 'flex', alignItems: 'center', gap: '6px' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2.2"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M9 10h4.5a2 2 0 0 1 0 4H9"/></svg> Ajouter un pourboire</div>
        <div className="tips"><div className="tipb" onClick={(e)=>H('pickTip(this)', e)}>Aucun</div><div className="tipb" onClick={(e)=>H('pickTip(this)', e)}>2 €</div><div className="tipb on" onClick={(e)=>H('pickTip(this)', e)}>5 €</div><div className="tipb" onClick={(e)=>H('pickTip(this)', e)}>10 €</div></div>
      </div>
      <div className="foot"><div className="btn dark" onClick={()=>go('v_map')}>Publier l'avis</div></div>
    </section>

<section className={`view ${view === 'v_messages' ? 'on' : ''}`} id="v_messages" data-tab="messages">
      <div className="appbar"><b>Messages</b></div>
      <div className="body">
        <div className="row" onClick={()=>go('v_chat')}><div className="av">M</div><div className="m"><div className="nm">Sofia M.</div><div className="ds">Très bien, voici mon devis.</div></div><div className="rt">14:02</div></div>
        <div className="row" onClick={()=>go('v_chat')}><div className="av g">S</div><div className="m"><div className="nm">Sofia L. · Ménage</div><div className="ds">Parfait, à jeudi 9h alors !</div></div><div className="rt">hier</div></div>
        <div className="row" onClick={()=>go('v_chat')}><div className="av gold">E</div><div className="m"><div className="nm">Nadia B. · Blanchisserie</div><div className="ds">Je vous envoie le devis ce soir.</div></div><div className="rt">lun.</div></div>
      </div>
    </section>

<section className={`view ${view === 'v_agenda' ? 'on' : ''}`} id="v_agenda" data-tab="agenda">
      <div className="appbar"><b>Mes réservations</b></div>
      <div className="body">
        <div className="card" onClick={()=>go('v_litige_suivi')} style={{ cursor: 'pointer', borderColor: '#F5D9A6', background: '#FFFBF2' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="av g" style={{ width: '38px', height: '38px', background: 'linear-gradient(160deg,#F2A93B,#d98a1f)' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17h.01"/></svg></div>
            <div style={{ flex: '1' }}><div style={{ fontFamily: 'var(--fh)', fontWeight: '700', color: 'var(--ink)', fontSize: '14px' }}>Litige en cours &middot; LT-114</div><div className="ds" style={{ fontSize: '11px', color: 'var(--slate)' }}>Yanis Services &middot; 36,75 &euro; bloqu&eacute;s &middot; une proposition vous attend</div></div>
            <span style={{ color: 'var(--slate)' }}>&rsaquo;</span>
          </div>
        </div>

        <div className="h2" style={{ marginTop: '0' }}>À venir</div>
        <div className="row" onClick={()=>go('v_track')}><div className="av">M</div><div className="m"><div className="nm">Sofia M. · Ménage</div><div className="ds">Aujourd'hui · 15h00 · ménage 85 m²</div></div><span className="badge teal">Confirmé</span></div>
        <div className="row" onClick={()=>go('v_track')}><div className="av g">S</div><div className="m"><div className="nm">Sofia L. · Ménage</div><div className="ds">Jeudi · 9h00 · T3</div></div><span className="badge gold">À venir</span></div>
        <div className="h2">Terminées</div>
        <div className="row" onClick={()=>go('v_receipt')}><div className="av gold">E</div><div className="m"><div className="nm">Nadia B. · Blanchisserie</div><div className="ds">12 juil. · salon · 294 €</div></div><span className="badge ink">Reçu</span></div>
      </div>
    </section>

<section className={`view ${view === 'v_profile' ? 'on' : ''}`} id="v_profile" data-tab="profile">
      <div className="appbar"><b>Mon profil</b></div>
      <div className="body">
        <div className="card" style={{ padding: '14px' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'var(--coral)', display: 'grid', placeItems: 'center', color: '#fff', fontFamily: 'var(--fh)', fontWeight: '700', fontSize: '19px', flex: '0 0 auto' }}>J</div>
            <div style={{ flex: '1' }}><div className="nm" style={{ fontSize: '15px', display: 'flex', alignItems: 'center', gap: '6px' }}>Julie Robert <span className="ver"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#12B39C" strokeWidth="2.4"><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></svg></span></div><div className="ds">Particulier · Grasse</div></div>
            <span className="edit" style={{ color: 'var(--teal)', fontSize: '12px', fontWeight: '700' }}>Modifier</span>
          </div>
          <div style={{ marginTop: '12px', borderTop: '1px solid var(--line)', paddingTop: '8px' }}>
            <div className="lrow"><span className="s">Adresse</span><span className="v" style={{ fontWeight: '600', textAlign: 'right', maxWidth: '62%' }}>14 rue des Oliviers, 06130 Grasse</span></div>
            <div className="lrow"><span className="s">Téléphone</span><span className="v">06 12 •• •• 45 ✓</span></div>
            <div className="lrow"><span className="s">E-mail</span><span className="v">julie.r@mail.fr ✓</span></div>
          </div>
        </div>
        <div className="h2">Identité &amp; sécurité</div>
        <div className="vrow ok"><div className="vi"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--tealD)" strokeWidth="2"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="12" r="2.4"/></svg></div><div className="vt"><b>Pièce d'identité fournie</b><small>Déposée sur PING · authenticité non garantie</small></div><div className="vs"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#12B39C" strokeWidth="2.4"><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></svg> Fournie</div></div>
        <div className="row" onClick={()=>go('v_kyc')}><div className="av g" style={{ width: '40px', height: '40px', fontSize: '15px' }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="12" r="2.4"/></svg></div><div className="m"><div className="nm" style={{ fontSize: '13px' }}>Mes documents &amp; identité</div><div className="ds">Pièce d'identité · chiffré &amp; masqué</div></div><span style={{ color: 'var(--slate)' }}>›</span></div>
        <div className="row" onClick={()=>go('v_privacy')}><div className="m"><div className="nm" style={{ fontSize: '13px' }}>Coordonnées &amp; confidentialité</div><div className="ds">Masquées jusqu'au QR · protégées</div></div><span style={{ color: 'var(--slate)' }}>›</span></div>
        <div className="row" onClick={()=>go('v_paymethods')}><div className="m"><div className="nm" style={{ fontSize: '13px' }}>Moyens de paiement</div></div><span style={{ color: 'var(--slate)' }}>›</span></div>
        <div className="h2">Mon activité</div>
        <div className="row" onClick={()=>go('v_revenus')}><div className="av gold" style={{ background: 'linear-gradient(160deg,#f2a93b,#d98a1f)', width: '40px', height: '40px', fontSize: '15px' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M4 19V5M4 19h16M8 15l3-4 3 3 4-6"/></svg></div><div className="m"><div className="nm">Mes revenus &amp; déclaration</div><div className="ds">Récapitulatif annuel · obligations fiscales</div></div><span style={{ color: 'var(--slate)' }}>›</span></div>
        <div className="row" onClick={()=>go('v_myreviews')}><div className="m"><div className="nm" style={{ fontSize: '13px' }}>Avis publiés</div></div><span style={{ color: 'var(--slate)' }}>›</span></div>
        <div className="h2">Vous proposez vos services ?</div>
        <div className="card"><div style={{ fontFamily: 'var(--fh)', fontWeight: '700', color: 'var(--ink)', fontSize: '14px' }}>Devenez professionnel sur PING</div><p className="sub">Choisissez votre statut juridique — inscription gratuite, immédiate et non bloquante.</p><div className="btn gold sm" style={{ marginTop: '10px' }} onClick={()=>go('v_join_pro')}>Saisir mon statut &amp; devenir pro</div></div>
      </div>
    </section>

<section className={`view ${view === 'v_join_pro' ? 'on' : ''}`} id="v_join_pro" data-tab="profile">
      <div className="appbar"><div className="ic" onClick={()=>back('v_profile')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2"><path d="M15 6l-6 6 6 6"/></svg></div><b>Devenir professionnel</b></div>
      <div className="body">
        <div className="h1">Choisissez votre statut juridique</div>
        <p className="sub">Gratuit et immédiat. Vous compléterez vos justificatifs plus tard — sans blocage.</p>
        <div className="h2">Statuts</div>
        <div className="statut on" onClick={(e)=>H('pickStatut(this)', e)}><b>Particulier</b><small>Sans structure &middot; petits services ponctuels &middot; vous déclarez vos revenus vous-même</small></div><div className="statut" onClick={(e)=>H('pickStatut(this)', e)}><b>Auto-entrepreneur (micro-entreprise)</b><small>Le plus simple &middot; abattement forfaitaire &middot; franchise TVA possible</small></div><div className="statut" onClick={(e)=>H('pickStatut(this)', e)}><b>Entreprise individuelle (EI)</b><small>Patrimoine pro séparé · régime réel possible</small></div><div className="statut" onClick={(e)=>H('pickStatut(this)', e)}><b>EURL</b><small>SARL à associé unique · responsabilité limitée</small></div><div className="statut" onClick={(e)=>H('pickStatut(this)', e)}><b>SARL</b><small>Société à plusieurs associés</small></div><div className="statut" onClick={(e)=>H('pickStatut(this)', e)}><b>SASU</b><small>Société par actions unipersonnelle · président assimilé salarié</small></div><div className="statut" onClick={(e)=>H('pickStatut(this)', e)}><b>SAS</b><small>Société par actions à plusieurs associés</small></div><div className="statut" onClick={(e)=>H('pickStatut(this)', e)}><b>Profession libérale</b><small>Activité libérale réglementée ou non</small></div><div className="statut" onClick={(e)=>H('pickStatut(this)', e)}><b>Association</b><small>Structure à but non lucratif</small></div>
      </div>
      <div className="foot"><div className="btn" onClick={()=>go('v_pro_form')}>Continuer</div></div>
    </section>

<section className={`view ${view === 'v_pro_form' ? 'on' : ''}`} id="v_pro_form" data-tab="profile">
      <div className="appbar"><div className="ic" onClick={()=>back('v_join_pro')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2"><path d="M15 6l-6 6 6 6"/></svg></div><b>Informations entreprise</b></div>
      <div className="body">
        <div className="field2"><div className="l">Statut sélectionné</div><div className="v">Auto-entrepreneur (micro-entreprise) <span className="edit">changer</span></div></div>
        <div className="field2"><div className="l">Dénomination / nom commercial</div><div className="v">Sofia Services <span className="edit">modifier</span></div></div>
        <div className="field2"><div className="l">Métier</div><div className="v">Ménage · repassage · vitres</div></div>
        <div className="field2" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: '7px' }}>
          <div className="l">SIREN / SIRET <span style={{ fontWeight: '400', color: 'var(--slate)' }}>— facultatif, ou plus tard</span></div>
          <input id="siretInput" placeholder="14 chiffres" inputMode="numeric" maxLength={14} onInput={(e)=>H('checkSiret(this.value)', e)} style={{ width: '100%', border: '1px solid var(--line)', borderRadius: '9px', padding: '9px 11px', fontFamily: 'var(--fb)', fontSize: '13px', color: 'var(--ink)', background: 'var(--paper)' }} />
          <div id="siretResult" style={{ width: '100%' }}></div>
        </div>
        <div className="field2"><div className="l">Adresse du siège</div><div className="v">14 rue des Oliviers, 06130 Grasse</div></div>
        <div className="field2"><div className="l">Régime de TVA</div><div className="v">Franchise en base — art. 293 B du CGI</div></div>
        <div className="field2"><div className="l">Assurances (artisan)</div><div className="v" style={{ color: 'var(--slate)' }}>RC Pro · complémentaire <span className="edit">ajouter</span></div></div>
        <div className="card" style={{ marginTop: '4px' }}><div style={{ fontFamily: 'var(--fh)', fontWeight: '700', color: 'var(--ink)', fontSize: '13px' }}>Bon à savoir · 2026</div>
          <div className="lawlist">
            <div className="li"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0C8F7E" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg><span>Plafond micro <b>services : 83 600 €/an</b> (période 2026-2028).</span></div>
            <div className="li"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0C8F7E" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg><span>Franchise TVA <b>travaux immobiliers (plomberie) : 25 000 € / 27 500 €</b>. Au-delà, TVA à facturer.</span></div>
            <div className="li"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0C8F7E" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg><span>Autres prestations de services : franchise TVA <b>37 500 € / 41 250 €</b>.</span></div>
          </div>
        </div>
        <p className="note2">Informations indicatives (droit français en vigueur, 2026). Elles ne remplacent pas l'avis d'un expert-comptable. PING transmet vos revenus à l'administration fiscale (dispositif DAC7).</p>
      </div>
      <div className="foot"><div className="btn dark" onClick={(e)=>H('setMode(\'pro\')', e)}>Enregistrer &amp; passer en mode pro</div></div>
    </section>

<section className={`view ${view === 'v_revenus' ? 'on' : ''}`} id="v_revenus" data-tab="profile">
      <div className="appbar"><div className="ic" onClick={()=>back('v_profile')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2"><path d="M15 6l-6 6 6 6"/></svg></div><b>Mes revenus &amp; déclaration</b></div>
      <div className="body">
        <div className="h1">Vos revenus perçus via PING</div>
        <div className="statgrid" style={{ marginTop: '12px' }}><div className="stat"><div className="v">240 €</div><div className="l">Ce mois</div></div><div className="stat"><div className="v">1 180 €</div><div className="l">Depuis janvier</div></div><div className="stat"><div className="v">9</div><div className="l">Opérations (an)</div></div><div className="stat"><div className="v">Vente + services</div><div className="l">Type d'activité</div></div></div>
        <div className="card" style={{ marginTop: '12px' }}><div style={{ fontFamily: 'var(--fh)', fontWeight: '700', color: 'var(--ink)', fontSize: '13.5px' }}>Récapitulatif annuel (DAC7)</div><p className="sub">Conformément à la loi (art. 1649 ter D du CGI), PING vous transmet chaque année le total net perçu et le nombre d'opérations, et le déclare à l'administration fiscale avant le 31 janvier.</p><div className="btn ghost sm" style={{ marginTop: '10px' }}>Télécharger mon récapitulatif</div></div>
        <div className="h2">Dois-je déclarer ?</div>
        <div className="card"><div className="lawlist">
          <div className="li"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--tealD)" strokeWidth="2.4"><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></svg><span><b>Vente occasionnelle</b> de vos biens personnels → en général <b>non imposable</b>.</span></div>
          <div className="li"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--amber)" strokeWidth="2.4"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg><span><b>Prestations de services</b> ou activité régulière → revenus <b>imposables</b>, à déclarer (formulaire 2042 C PRO).</span></div>
          <div className="li"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--slate)" strokeWidth="2.4"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg><span>Seuil de signalement (vente de biens) : au-delà de <b>30 opérations ou 2 000 €/an</b>, vos ventes sont signalées à l'administration.</span></div>
        </div></div>
        <div className="card" style={{ background: 'linear-gradient(135deg,rgba(242,169,59,.12),rgba(18,179,156,.08))', borderColor: 'rgba(242,169,59,.3)' }}><div style={{ fontFamily: 'var(--fh)', fontWeight: '700', color: 'var(--ink)', fontSize: '13.5px' }}>Votre activité devient régulière ?</div><p className="sub">Créez un statut pour être en règle et facturer proprement.</p><div className="btn gold sm" style={{ marginTop: '10px' }} onClick={()=>go('v_join_pro')}>Devenir professionnel</div></div>
        <p className="note2">Informations indicatives (droit français en vigueur, 2026). Elles ne constituent pas un conseil fiscal personnalisé.</p>
      </div>
    </section>

<section className={`view ${view === 'v_kyc' ? 'on' : ''}`} id="v_kyc" data-tab="profile">
      <div className="appbar"><div className="ic" onClick={()=>back('v_profile')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2"><path d="M15 6l-6 6 6 6"/></svg></div><b>Mes documents &amp; identité</b></div>
      <div className="body">
        <div className="h1">Vos pièces</div>
        <p className="sub">Nécessaires à la confiance entre membres. Fichiers chiffrés, masqués, jamais publics.</p>
        <div className="kyc ok" style={{ marginTop: '12px', cursor: 'pointer' }} onClick={(e)=>H('openDoc(\'id\')', e)}><div className="ki"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="12" r="2.4"/></svg></div><div className="kt"><b>Pièce d'identité (CNI ou passeport)</b><small>Fournie · chiffrée &amp; masquée</small></div><div className="ka done">Remplacer</div></div>
        <div className="kyc" id="kyc_domicile"><div className="ki"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2h9l3 3v17H6z"/></svg></div><div className="kt"><b>Justificatif de domicile</b><small>Optionnel</small></div><div className="ka" onClick={(e)=>H('openUpload(\'kyc_domicile\',\'Justificatif de domicile\')', e)}>+ Ajouter</div></div>
        <div className="card" style={{ marginTop: '6px' }}><div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'var(--fh)', fontWeight: '700', color: 'var(--ink)', fontSize: '12.5px' }}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--tealD)" strokeWidth="2"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg> Stockage sécurisé</div><p className="sub" style={{ marginTop: '5px' }}>Documents chiffrés au repos, accès restreint, supprimables sur demande (RGPD). Aucune donnée bancaire n'est stockée par PING.</p></div>
      </div>
    </section>

<section className={`view ${view === 'v_paymethods' ? 'on' : ''}`} id="v_paymethods" data-tab="profile">
      <div className="appbar"><div className="ic" onClick={()=>back('v_profile')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2"><path d="M15 6l-6 6 6 6"/></svg></div><b>Moyens de paiement</b></div>
      <div className="body">
        <div className="h1">Vos cartes</div>
        <p className="sub">Gérées par notre prestataire de paiement (Stripe) — PING n'a jamais accès au numéro complet ni ne stocke vos coordonnées bancaires (PCI-DSS).</p>
        <div id="cardsList" style={{ marginTop: '12px' }}>
          <div className="kyc ok"><div className="ki"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18"/></svg></div><div className="kt"><b>Visa •••• 4242</b><small>Expire 08/28 · par défaut</small></div><div className="ka done">Par défaut</div></div>
        </div>
        <div className="btn ghost" style={{ marginTop: '6px' }} onClick={(e)=>H('openCardSheet()', e)}>+ Ajouter une carte</div>
        <div className="card" style={{ marginTop: '14px' }}><div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'var(--fh)', fontWeight: '700', color: 'var(--ink)', fontSize: '12.5px' }}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--tealD)" strokeWidth="2"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg> Paiement sécurisé sous séquestre</div><p className="sub" style={{ marginTop: '5px' }}>Vos fonds sont bloqués à la réservation et libérés au prestataire après le QR de fin d'intervention.</p></div>
      </div>
    </section>

<section className={`view ${view === 'v_privacy' ? 'on' : ''}`} id="v_privacy" data-tab="profile">
      <div className="appbar"><div className="ic" onClick={()=>back('v_profile')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2"><path d="M15 6l-6 6 6 6"/></svg></div><b>Coordonnées &amp; confidentialité</b></div>
      <div className="body">
        <div className="h1">Ce que voient les prestataires</div>
        <p className="sub">Votre nom, votre quartier approximatif et vos avis sont visibles. Le reste ne l'est pas.</p>
        <div className="vrow ok" style={{ marginTop: '10px' }}><div className="vi"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--tealD)" strokeWidth="2"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="3"/></svg></div><div className="vt"><b>Prénom &amp; quartier</b><small>Visibles dès le premier contact</small></div></div>
        <div className="vrow" style={{ marginTop: '7px' }}><div className="vi" style={{ background: 'var(--paper)', color: 'var(--slate)' }}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z"/><path d="M4 4l16 16"/></svg></div><div className="vt"><b>Adresse exacte</b><small>Masquée jusqu'à la réservation confirmée</small></div></div>
        <div className="vrow" style={{ marginTop: '7px' }}><div className="vi" style={{ background: 'var(--paper)', color: 'var(--slate)' }}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z"/><path d="M4 4l16 16"/></svg></div><div className="vt"><b>Téléphone &amp; e-mail</b><small>Jamais partagés — la messagerie PING suffit</small></div></div>
        <div className="card" style={{ marginTop: '14px' }}><p className="sub" style={{ marginTop: '0' }}>Vous pouvez demander la suppression de vos données à tout moment (RGPD) depuis « Mes documents &amp; identité ».</p></div>
      </div>
    </section>

<section className={`view ${view === 'v_myreviews' ? 'on' : ''}`} id="v_myreviews" data-tab="profile">
      <div className="appbar"><div className="ic" onClick={()=>back('v_profile')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2"><path d="M15 6l-6 6 6 6"/></svg></div><b>Avis publiés</b></div>
      <div className="body">
        <div className="h1">Vos 2 avis</div>
        <div className="card" style={{ marginTop: '10px' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><div style={{ fontFamily: 'var(--fh)', fontWeight: '700', color: 'var(--ink)', fontSize: '13.5px' }}>Sofia Services</div><small style={{ color: 'var(--slate)' }}>14 juil. 2026</small></div><div style={{ marginTop: '6px' }}>★★★★★</div><p className="sub" style={{ marginTop: '6px' }}>Ponctuelle, très soigneuse. Je recommande.</p></div>
        <div className="card" style={{ marginTop: '10px' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><div style={{ fontFamily: 'var(--fh)', fontWeight: '700', color: 'var(--ink)', fontSize: '13.5px' }}>Nadia Repassage</div><small style={{ color: 'var(--slate)' }}>13 juil. 2026</small></div><div style={{ marginTop: '6px' }}>★★★★☆</div><p className="sub" style={{ marginTop: '6px' }}>Bon travail, léger retard à l'arrivée.</p></div>
      </div>
    </section>

<section className={`view ${view === 'v_offres' ? 'on' : ''}`} id="v_offres" data-tab="offres">
      <div className="appbar"><b>Mes demandes</b></div>
      <div className="body">
        <div className="h1">Publiez votre demande</div>
        <p className="sub">Personne de disponible autour de vous&nbsp;? Décrivez ce dont vous avez besoin&nbsp;: les personnes à proximité vous font une proposition chiffrée.</p>
        <div className="btn" style={{ marginTop: '12px' }} onClick={()=>go('v_offre_new')}>+ Publier une demande</div>

        <div className="h2">En cours</div>
        <div className="card" onClick={()=>go('v_offre_detail')} style={{ cursor: 'pointer' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <div style={{ flex: '1' }}>
              <div style={{ fontFamily: 'var(--fh)', fontWeight: '700', color: 'var(--ink)', fontSize: '14px' }}>Ménage complet · 85 m²</div>
              <div className="ds" style={{ fontSize: '11.5px', color: 'var(--slate)', marginTop: '2px' }}>Quartier Saint-Jacques · samedi matin · ponctuel</div>
            </div>
            <span className="vchip ok" style={{ whiteSpace: 'nowrap' }}>3 propositions</span>
          </div>
          <div className="lrow" style={{ marginTop: '9px' }}><span className="s">Budget indicatif</span><span className="v">80 – 120 &euro;</span></div>
          <div className="lrow"><span className="s">Publiée</span><span className="v">il y a 2 h · expire dans 14 j</span></div>
        </div>

        <div className="card" style={{ opacity: '.72' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <div style={{ flex: '1' }}>
              <div style={{ fontFamily: 'var(--fh)', fontWeight: '700', color: 'var(--ink)', fontSize: '14px' }}>Repassage · 2 h par semaine</div>
              <div className="ds" style={{ fontSize: '11.5px', color: 'var(--slate)', marginTop: '2px' }}>Quartier Centre · mardi après-midi · hebdomadaire</div>
            </div>
            <span className="vchip" style={{ whiteSpace: 'nowrap' }}>En attente</span>
          </div>
          <div className="lrow" style={{ marginTop: '9px' }}><span className="s">Budget indicatif</span><span className="v">25 &euro;/h</span></div>
        </div>

        <div className="note2" style={{ marginTop: '14px' }}>Votre adresse exacte reste masquée tant que vous n'avez pas accepté une proposition et que le paiement n'est pas placé sous séquestre.</div>
      </div>
    </section>

<section className={`view ${view === 'v_offre_new' ? 'on' : ''}`} id="v_offre_new" data-tab="offres">
      <div className="appbar"><div className="ic" onClick={()=>back('v_offres')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2"><path d="M15 6l-6 6 6 6"/></svg></div><b>Nouvelle demande</b></div>
      <div className="body">
        <div className="h2" style={{ marginTop: '0' }}>Quel service&nbsp;?</div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
          <div className="chip on" onClick={(e)=>H('mapChip(this)', e)}>Ménage</div><div className="chip" onClick={(e)=>H('mapChip(this)', e)}>Repassage</div><div className="chip" onClick={(e)=>H('mapChip(this)', e)}>Nettoyage</div><div className="chip" onClick={(e)=>H('mapChip(this)', e)}>Remise en état</div><div className="chip" onClick={(e)=>H('mapChip(this)', e)}>Vitres</div>
        </div>

        <div className="h2">Décrivez le besoin</div>
        <div className="field2"><div className="l">Titre</div><div className="v">Ménage complet · 85 m²</div></div>
        <div className="field2"><div className="l">Détail</div><div className="v" style={{ color: 'var(--slate)', lineHeight: '1.5' }}>Appartement 3 pièces, cuisine + 2 salles d'eau. Produits fournis.</div></div>
        <div className="g2" style={{ display: 'flex', gap: '8px' }}>
          <div className="field2" style={{ flex: '1' }}><div className="l">Surface</div><div className="v">85 m²</div></div>
          <div className="field2" style={{ flex: '1' }}><div className="l">Durée estimée</div><div className="v">3 h</div></div>
        </div>

        <div className="h2">Quand&nbsp;?</div>
        <div className="g2" style={{ display: 'flex', gap: '8px' }}>
          <div className="field2" style={{ flex: '1' }}><div className="l">Date souhaitée</div><div className="v">Samedi 8 août</div></div>
          <div className="field2" style={{ flex: '1' }}><div className="l">Créneau</div><div className="v">Matin</div></div>
        </div>
        <div className="seg" style={{ marginTop: '8px' }}><div className="on" onClick={(e)=>H('segPick(this)', e)}>Ponctuel</div><div onClick={(e)=>H('segPick(this)', e)}>Hebdomadaire</div><div onClick={(e)=>H('segPick(this)', e)}>Mensuel</div></div>

        <div className="h2">Budget indicatif</div>
        <div className="g2" style={{ display: 'flex', gap: '8px' }}>
          <div className="field2" style={{ flex: '1' }}><div className="l">Minimum</div><div className="v">80 &euro;</div></div>
          <div className="field2" style={{ flex: '1' }}><div className="l">Maximum</div><div className="v">120 &euro;</div></div>
        </div>
        <p className="sub">Indicatif seulement. Les propositions reçues peuvent être différentes&nbsp;; vous restez libre de refuser.</p>

        <div className="h2">Localisation</div>
        <div className="field2"><div className="l">Quartier affiché publiquement</div><div className="v">Saint-Jacques, Grasse</div></div>
        <div className="note2">Votre adresse exacte n'est transmise qu'à la personne dont vous acceptez la proposition, après mise sous séquestre du paiement.</div>
      </div>
      <div className="foot"><div className="btn" onClick={()=>go('v_offre_detail')}>Publier ma demande</div></div>
    </section>

<section className={`view ${view === 'v_offre_detail' ? 'on' : ''}`} id="v_offre_detail" data-tab="offres">
      <div className="appbar"><div className="ic" onClick={()=>back('v_offres')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2"><path d="M15 6l-6 6 6 6"/></svg></div><b>Ménage complet · 85 m²</b></div>
      <div className="body">
        <div className="card" style={{ padding: '12px' }}>
          <div className="lrow"><span className="s">Quartier</span><span className="v">Saint-Jacques, Grasse</span></div>
          <div className="lrow"><span className="s">Date</span><span className="v">Samedi 8 août · matin</span></div>
          <div className="lrow"><span className="s">Budget indicatif</span><span className="v">80 – 120 &euro;</span></div>
          <div className="lrow"><span className="s">Statut</span><span className="v" style={{ color: 'var(--tealD)', fontWeight: '700' }}>Publiée · 3 propositions</span></div>
        </div>

        <div className="h2">Propositions reçues</div>

        <div className="card" style={{ padding: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
            <div className="pvav" style={{ width: '36px', height: '36px', borderRadius: '11px', display: 'grid', placeItems: 'center', background: 'linear-gradient(160deg,#12B39C,#0C8F7E)', color: '#fff', fontFamily: 'var(--fh)', fontWeight: '700' }}>S</div>
            <div style={{ flex: '1' }}>
              <div style={{ fontFamily: 'var(--fh)', fontWeight: '700', color: 'var(--ink)', fontSize: '13.5px' }}>Sofia M.</div>
              <div className="ds" style={{ fontSize: '11px', color: 'var(--slate)' }}>4,9 (86 avis) · à 600 m · répond en ~10 min</div>
            </div>
            <div style={{ fontFamily: 'var(--fh)', fontWeight: '700', color: 'var(--ink)', fontSize: '17px' }}>95 &euro;</div>
          </div>
          <div className="chipset" style={{ marginTop: '8px' }}><span className="vchip ok"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#0C8F7E" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg> Pièce d'identité fournie</span><span className="vchip ok"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#0C8F7E" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg> Assurance RC renseignée</span></div>
          <p className="sub" style={{ marginTop: '8px', fontSize: '12px' }}>&laquo;&nbsp;Bonjour, je peux intervenir samedi à 9 h. 3 h de ménage complet, produits à votre charge comme indiqué.&nbsp;&raquo;</p>
          <div style={{ display: 'flex', gap: '8px', marginTop: '9px' }}><div className="btn ghost" style={{ flex: '1' }} onClick={()=>go('v_chat')}>Échanger</div><div className="btn" style={{ flex: '1.3' }} onClick={()=>go('v_booking')}>Accepter · 95 &euro;</div></div>
        </div>

        <div className="card" style={{ padding: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
            <div className="pvav" style={{ width: '36px', height: '36px', borderRadius: '11px', display: 'grid', placeItems: 'center', background: 'linear-gradient(160deg,#F2A93B,#d98a1f)', color: '#fff', fontFamily: 'var(--fh)', fontWeight: '700' }}>L</div>
            <div style={{ flex: '1' }}>
              <div style={{ fontFamily: 'var(--fh)', fontWeight: '700', color: 'var(--ink)', fontSize: '13.5px' }}>Léa T.</div>
              <div className="ds" style={{ fontSize: '11px', color: 'var(--slate)' }}>4,7 (23 avis) · à 1,2 km · étudiante</div>
            </div>
            <div style={{ fontFamily: 'var(--fh)', fontWeight: '700', color: 'var(--ink)', fontSize: '17px' }}>78 &euro;</div>
          </div>
          <div className="chipset" style={{ marginTop: '8px' }}><span className="vchip ok"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#0C8F7E" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg> Pièce d'identité fournie</span></div>
          <p className="sub" style={{ marginTop: '8px', fontSize: '12px' }}>&laquo;&nbsp;Disponible samedi matin, j'habite le quartier. J'ai déjà fait plusieurs ménages sur PING.&nbsp;&raquo;</p>
          <div style={{ display: 'flex', gap: '8px', marginTop: '9px' }}><div className="btn ghost" style={{ flex: '1' }} onClick={()=>go('v_chat')}>Échanger</div><div className="btn" style={{ flex: '1.3' }} onClick={()=>go('v_booking')}>Accepter · 78 &euro;</div></div>
        </div>

        <div className="note2">En acceptant une proposition, le paiement est placé sous séquestre. Il n'est libéré qu'après votre validation de fin de prestation.</div>
      </div>
    </section>

<section className={`view ${view === 'v_litige' ? 'on' : ''}`} id="v_litige" data-tab="agenda">
      <div className="appbar"><div className="ic" onClick={()=>back('v_agenda')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2"><path d="M15 6l-6 6 6 6"/></svg></div><b>Signaler un problème</b></div>
      <div className="body">
        <div className="h1">Que s'est-il passé&nbsp;?</div>
        <p className="sub">Tant qu'un signalement est ouvert, le paiement reste sous séquestre&nbsp;: il n'est pas libéré automatiquement.</p>

        <div className="h2">Motif</div>
        <div className="statut on" onClick={(e)=>H('pickStatut(this)', e)}><b>Prestation non réalisée</b><small>La personne n'est pas venue, ou est repartie sans faire le travail</small></div>
        <div className="statut" onClick={(e)=>H('pickStatut(this)', e)}><b>Travail incomplet ou non conforme</b><small>La prestation ne correspond pas à ce qui était convenu</small></div>
        <div className="statut" onClick={(e)=>H('pickStatut(this)', e)}><b>Casse ou dégradation</b><small>Un bien a été endommagé pendant l'intervention</small></div>
        <div className="statut" onClick={(e)=>H('pickStatut(this)', e)}><b>Vol suspecté</b><small>Un objet a disparu à la suite de l'intervention</small></div>
        <div className="statut" onClick={(e)=>H('pickStatut(this)', e)}><b>Comportement inapproprié</b><small>Propos ou attitude problématiques</small></div>

        <div className="h2">Photos <span style={{ color: 'var(--coral)' }}>· obligatoire</span></div>
        <p className="sub" style={{ marginTop: '0' }}>Au moins une photo est requise pour ouvrir le dossier. Elle est horodatée et transmise à l'arbitrage.</p>
        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
          <div style={{ flex: '1', aspectRatio: '1', border: '1.5px dashed var(--line)', borderRadius: '12px', display: 'grid', placeItems: 'center', color: 'var(--slate)' }}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="6" width="18" height="14" rx="2"/><circle cx="12" cy="13" r="3.5"/><path d="M8 6l1.5-2h5L16 6"/></svg></div>
          <div style={{ flex: '1', aspectRatio: '1', border: '1.5px dashed var(--line)', borderRadius: '12px', display: 'grid', placeItems: 'center', color: 'var(--slate)' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 5v14M5 12h14"/></svg></div>
          <div style={{ flex: '1', aspectRatio: '1', border: '1.5px dashed var(--line)', borderRadius: '12px', display: 'grid', placeItems: 'center', color: 'var(--slate)' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 5v14M5 12h14"/></svg></div>
        </div>

        <div className="h2">Votre description</div>
        <div className="field2"><div className="l">Ce que vous constatez</div><div className="v" style={{ color: 'var(--slate)', lineHeight: '1.5' }}>Décrivez précisément&nbsp;: pièces concernées, heure, ce qui était convenu&hellip;</div></div>

        <div className="card" style={{ borderColor: '#F5D9A6', background: '#FFFBF2' }}>
          <div style={{ fontFamily: 'var(--fh)', fontWeight: '700', color: 'var(--ink)', fontSize: '13px', marginBottom: '6px' }}>Ce qui se passe ensuite</div>
          <div className="lrow"><span className="s">1. Le paiement reste bloqué</span><span className="v">immédiat</span></div>
          <div className="lrow"><span className="s">2. La personne est invitée à répondre</span><span className="v">sous 48 h</span></div>
          <div className="lrow"><span className="s">3. Arbitrage sur pièces</span><span className="v">sous 5 j</span></div>
          <div className="note2" style={{ marginTop: '8px' }}>En cas de casse, vol ou dégradation, PING vous transmet les coordonnées de l'assurance responsabilité civile renseignée par la personne. PING n'indemnise pas et n'est pas partie au contrat de prestation.</div>
        </div>
      </div>
      <div className="foot"><div className="btn" onClick={()=>go('v_litige_suivi')}>Envoyer le signalement</div></div>
    </section>

<section className={`view ${view === 'v_docview' ? 'on' : ''}`} id="v_docview" data-tab="proprofile">
      <div className="appbar"><div className="ic" onClick={()=>back('p_kyc')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2"><path d="M15 6l-6 6 6 6"/></svg></div><b id="dvTitle">Document</b></div>
      <div className="body">
        <p className="sub" style={{ marginTop: '0' }} id="dvSub"></p>
        <div className="docview" style={{ marginTop: '12px' }} id="dvBody"></div>
        <div className="card" style={{ marginTop: '12px' }}>
          <div className="lrow"><span className="s">Fichier</span><span className="v" id="dvFile"></span></div>
          <div className="lrow"><span className="s">Horodatage</span><span className="v" id="dvDate"></span></div>
          <div className="lrow"><span className="s">Conservation</span><span className="v">RGPD &middot; durée limitée</span></div>
        </div>
        <div className="note2">Vous seul et l'équipe de qualification PING pouvez consulter ce document. Il n'est jamais visible par les clients.</div>
      </div>
      <div className="foot"><div className="btn" id="dvDl" onClick={(e)=>H('alert(\'Téléchargement du document (simulation prototype)\')', e)}>Télécharger le document</div></div>
    </section>

<section className={`view ${view === 'v_litige_suivi' ? 'on' : ''}`} id="v_litige_suivi" data-tab="agenda">
      <div className="appbar"><div className="ic" onClick={()=>back('v_agenda')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2"><path d="M15 6l-6 6 6 6"/></svg></div><b>Litige LT-114</b></div>
      <div className="body">
        <div className="lgel">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F2A93B" strokeWidth="2"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
          <div style={{ flex: '1' }}><div className="n">36,75 &euro; bloqu&eacute;s</div><div className="s">Le paiement ne sera pas lib&eacute;r&eacute; tant que le litige est ouvert</div></div>
        </div>

        <div className="lstat">
          <div><b id="cl_moi">20,00 &euro;</b><span>Ma demande</span></div>
          <div><b id="cl_lui">7,00 &euro;</b><span>Sa proposition</span></div>
          <div><b id="cl_ecart">13,00 &euro;</b><span>&Eacute;cart</span></div>
        </div>

        <div className="h2">O&ugrave; en est le dossier</div>
        <div className="lfil" id="cl_fil"></div>

        <div className="h2">R&eacute;pondre</div>
        <div className="card" style={{ padding: '12px' }}>
          <div style={{ fontSize: '12px', color: 'var(--slate)', lineHeight: '1.5' }}>Vous pouvez accepter la proposition de Yanis, ou faire une contre-proposition.</div>
          <div className="btn" style={{ marginTop: '10px' }} onClick={(e)=>H('clAccept()', e)}>Accepter 7,00 &euro; et cl&ocirc;turer</div>
          <div className="offin"><input type="number" id="cl_off" placeholder="Montant" step="0.5" value="14" /><div className="btn ghost" style={{ flex: '0 0 auto', padding: '11px 16px' }} onClick={(e)=>H('clOffre()', e)}>Proposer</div></div>
          <div className="note2" style={{ marginTop: '10px' }}>Sans accord sous 48 h, PING rendra une d&eacute;cision motiv&eacute;e. Accepter ne vous prive d'aucun recours (m&eacute;diateur, assurance, juridictions).</div>
        </div>

        <div className="h2">En cas de dommage</div>
        <div className="doc" onClick={()=>go('v_assur')} style={{ cursor: 'pointer' }}>
          <div className="dt fac" style={{ background: 'linear-gradient(160deg,#6E8592,#4c6472)', color: '#fff' }}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M12 3l7 3v6c0 5-3.5 7.5-7 9-3.5-1.5-7-4-7-9V6l7-3z"/></svg></div>
          <div className="m"><div className="nm">Assurance du prestataire</div><div className="ds">Casse ou vol &middot; PING transmet les coordonn&eacute;es</div></div>
          <span style={{ color: 'var(--slate)' }}>&rsaquo;</span>
        </div>
      </div>
    </section>

<section className={`view ${view === 'v_assur' ? 'on' : ''}`} id="v_assur" data-tab="agenda">
      <div className="appbar"><div className="ic" onClick={()=>back('v_litige_suivi')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2"><path d="M15 6l-6 6 6 6"/></svg></div><b>Assurance du prestataire</b></div>
      <div className="body">
        <div className="h1">Pour un dommage mat&eacute;riel</div>
        <p className="sub">PING ne prend pas en charge les dommages. Voici les informations d&eacute;clar&eacute;es par le prestataire pour votre d&eacute;marche.</p>
        <div className="card">
          <div className="lrow"><span className="s">Assur&eacute;</span><span className="v">Yanis Services</span></div>
          <div className="lrow"><span className="s">Compagnie</span><span className="v">AXA</span></div>
          <div className="lrow"><span className="s">N&deg; de police</span><span className="v">10442213</span></div>
          <div className="lrow"><span className="s">Validit&eacute; d&eacute;clar&eacute;e</span><span className="v">31/12/2026</span></div>
          <div className="lrow"><span className="s">SIRET</span><span className="v">511 902 334 00027</span></div>
        </div>
        <div className="note2">Informations renseign&eacute;es par le prestataire. PING n'en v&eacute;rifie pas l'authenticit&eacute; et n'est pas assureur. En cas de vol, un d&eacute;p&ocirc;t de plainte est n&eacute;cessaire.</div>
        <div className="btn ghost" style={{ marginTop: '12px' }} onClick={(e)=>H('alert(\'Fiche envoy\u00e9e par e-mail (simulation)\')', e)}>Recevoir par e-mail</div>
      </div>
    </section>
    </>
  )
}
