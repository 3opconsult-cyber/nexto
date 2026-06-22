"use client"
import { useState } from 'react'
import Link from 'next/link'

export default function Presentation() {
  const [view, setView] = useState<'client'|'pro'>('client')

  return (
    <div className="min-h-screen" style={{background:'var(--navy)'}}>
      {/* HERO */}
      <div className="px-6 pt-16 pb-12 text-center">
        <div className="inline-block px-4 py-1.5 rounded-full text-xs font-black mb-6 animate-pulse" style={{background:'var(--accent)',color:'white'}}>
          ✨ La nouvelle façon de trouver un pro
        </div>
        <h1 className="font-fredoka text-4xl text-white leading-tight mb-4">
          Et si ce que vous cherchez<br/>se trouvait <span style={{color:'var(--accent)'}}>juste à côté</span> ?
        </h1>
        <p className="text-base font-bold max-w-sm mx-auto mb-8" style={{color:'rgba(255,255,255,0.6)'}}>
          Plombier, ménage, baby-sitter… Un pro vérifié près de chez vous, réservé et payé en quelques clics. Aussi simple qu'un Airbnb.
        </p>

        {/* Switch vue */}
        <div className="inline-flex gap-1 p-1 rounded-full mb-2" style={{background:'rgba(255,255,255,0.1)'}}>
          <button onClick={()=>setView('client')} className="px-5 py-2 rounded-full text-sm font-black transition-all"
            style={view==='client'?{background:'var(--accent)',color:'white'}:{color:'rgba(255,255,255,0.6)'}}>👤 Je cherche</button>
          <button onClick={()=>setView('pro')} className="px-5 py-2 rounded-full text-sm font-black transition-all"
            style={view==='pro'?{background:'var(--accent)',color:'white'}:{color:'rgba(255,255,255,0.6)'}}>🔧 Je suis pro</button>
        </div>
      </div>

      {/* PARCOURS EN 3 ÉTAPES */}
      <div className="bg-white rounded-t-3xl px-6 py-10">
        {view==='client' ? (
          <>
            <h2 className="font-fredoka text-2xl text-navy text-center mb-8">3 clics, c'est réglé.</h2>
            {[
              {n:'1',e:'📍',t:'Je trouve',d:'La carte affiche les pros disponibles autour de moi, triés par distance et note. Je filtre par service.'},
              {n:'2',e:'💬',t:'Je réserve',d:'Je décris mon besoin, je discute dans un chat sécurisé, je valide le devis. Mon paiement est bloqué en séquestre.'},
              {n:'3',e:'✅',t:'Je valide',d:'Le pro arrive (QR code), fait le travail (QR code de fin). Le paiement se libère automatiquement. Facture émise.'},
            ].map((s,i)=>(
              <div key={i} className="flex gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0" style={{background:'var(--accent-l)'}}>{s.e}</div>
                <div>
                  <div className="font-fredoka text-lg text-navy">{s.t}</div>
                  <div className="text-sm font-bold text-gray-500">{s.d}</div>
                </div>
              </div>
            ))}
          </>
        ) : (
          <>
            <h2 className="font-fredoka text-2xl text-navy text-center mb-8">Décuplez votre présence terrain.</h2>
            {[
              {n:'1',e:'📡',t:'Je suis visible',d:'Dès mon profil validé, j\'apparais sur la carte de tous les clients autour de moi. Géolocalisé, en temps réel.'},
              {n:'2',e:'🔔',t:'Je reçois (Ping)',d:'Une demande arrive ? Je reçois un Ping. J\'accepte, je discute, j\'envoie mon devis. 15 min pour répondre, sinon ça passe au suivant.'},
              {n:'3',e:'💶',t:'Je suis payé',d:'Travail validé par QR code = virement automatique J+2. Plus d\'impayés. Commission transparente déduite.'},
            ].map((s,i)=>(
              <div key={i} className="flex gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0" style={{background:'var(--accent-l)'}}>{s.e}</div>
                <div>
                  <div className="font-fredoka text-lg text-navy">{s.t}</div>
                  <div className="text-sm font-bold text-gray-500">{s.d}</div>
                </div>
              </div>
            ))}
          </>
        )}

        {/* LES GARANTIES */}
        <div className="mt-8 mb-4">
          <h3 className="font-fredoka text-xl text-navy text-center mb-5">Pourquoi Nexto vous protège</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              {e:'🔒',t:'Paiement séquestre',d:'Votre argent bloqué jusqu\'à validation. Type Airbnb.'},
              {e:'📍',t:'Proximité réelle',d:'Géolocalisation. Le pro le plus proche, pas le plus cher en pub.'},
              {e:'⭐',t:'Avis vérifiés',d:'Notes internes app, impossibles à truquer.'},
              {e:'🛡️',t:'Assurances',d:'RC Pro, décennale : documents stockés et accessibles.'},
              {e:'⚖️',t:'Litiges gérés',d:'Un problème ? Paiement gelé, médiation Nexto.'},
              {e:'🚫',t:'Anti-arnaque',d:'Échange hors-app bloqué. Tout reste protégé.'},
            ].map((g,i)=>(
              <div key={i} className="p-4 rounded-2xl" style={{background:'var(--cream)'}}>
                <div className="text-2xl mb-1">{g.e}</div>
                <div className="font-black text-sm text-navy">{g.t}</div>
                <div className="text-xs font-bold text-gray-400 mt-0.5">{g.d}</div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="mt-8 space-y-3">
          <Link href="/demo" className="block w-full py-4 rounded-full text-white font-fredoka text-lg text-center" style={{background:'var(--accent)'}}>
            ▶️ Voir la démo interactive
          </Link>
          <Link href={view==='client'?'/auth/signup?role=client':'/auth/signup?role=pro'}
            className="block w-full py-4 rounded-full font-fredoka text-lg text-center border-2"
            style={{borderColor:'var(--accent)',color:'var(--accent)'}}>
            {view==='client'?'Trouver un pro maintenant':'Devenir pro Nexto'}
          </Link>
        </div>
      </div>
    </div>
  )
}
