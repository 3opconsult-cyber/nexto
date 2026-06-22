"use client"
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { fetchDemoPros, fetchDemoPro, DemoPro, DemoReview } from '@/lib/demo'
import { ServiceType, SERVICE_LABELS, LEGAL_FORM_LABELS } from '@/types'

type Step = 'map' | 'profile' | 'request' | 'chat' | 'payment' | 'tracking' | 'done'

export default function DemoPage() {
  const [step, setStep] = useState<Step>('map')
  const [activeService, setActiveService] = useState<ServiceType | null>(null)
  const [pros, setPros] = useState<DemoPro[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<DemoPro | null>(null)
  const [reviews, setReviews] = useState<DemoReview[]>([])
  const [tab, setTab] = useState<'apropos'|'avis'|'galerie'>('apropos')
  const [chatMsgs, setChatMsgs] = useState<{me:boolean;txt:string}[]>([])
  const [chatInput, setChatInput] = useState('')

  useEffect(() => {
    setLoading(true)
    fetchDemoPros(activeService ?? undefined).then(setPros).finally(()=>setLoading(false))
  }, [activeService])

  async function openProfile(pro: DemoPro) {
    const { reviews } = await fetchDemoPro(pro.id)
    setSelected(pro); setReviews(reviews); setTab('apropos'); setStep('profile')
  }

  const services = Object.entries(SERVICE_LABELS) as [ServiceType,{label:string;emoji:string}][]

  // Bandeau démo
  const DemoBanner = () => (
    <div className="fixed top-0 left-0 right-0 z-50 px-4 py-2 text-center text-xs font-black"
      style={{ background: 'var(--accent)', color: 'white' }}>
      🎬 MODE DÉMO — Parcours complet sans inscription ·{' '}
      <Link href="/" className="underline">Quitter</Link>
    </div>
  )

  // ───────────── MAP ─────────────
  if (step === 'map') return (
    <div className="min-h-screen pt-9" style={{ background: 'var(--cream)' }}>
      <DemoBanner />
      <div className="px-4 pt-4 pb-2" style={{ background: 'var(--navy)' }}>
        <div className="font-fredoka text-2xl text-white mb-1">Nexto</div>
        <div className="text-xs font-bold mb-3" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Trouvez un pro autour de vous — Grasse (06)
        </div>
        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
          <button onClick={()=>setActiveService(null)}
            className="px-4 py-2 rounded-full text-sm font-black whitespace-nowrap flex-shrink-0"
            style={activeService===null?{background:'var(--accent)',color:'white'}:{background:'rgba(255,255,255,0.15)',color:'white'}}>Tous</button>
          {services.map(([k,{label,emoji}])=>(
            <button key={k} onClick={()=>setActiveService(k)}
              className="px-4 py-2 rounded-full text-sm font-black whitespace-nowrap flex-shrink-0"
              style={activeService===k?{background:'var(--accent)',color:'white'}:{background:'rgba(255,255,255,0.15)',color:'white'}}>
              {emoji} {label}</button>
          ))}
        </div>
      </div>

      <div className="relative" style={{ height: '60vh', background:'linear-gradient(135deg,#E8E4F0,#F0EDE8)' }}>
        <svg className="absolute inset-0 w-full h-full opacity-30">
          <defs><pattern id="g" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#7C5CFC" strokeWidth="0.5" opacity="0.3"/>
          </pattern></defs><rect width="100%" height="100%" fill="url(#g)"/>
        </svg>
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
          <div className="w-5 h-5 rounded-full border-4 border-white shadow-lg" style={{background:'var(--accent)'}}/>
          <div className="absolute inset-0 rounded-full animate-ping" style={{background:'var(--accent)',opacity:0.3}}/>
        </div>
        {pros.map((pro,i)=>{
          const angle=(i/Math.max(pros.length,1))*2*Math.PI
          const r=70+(i%3)*45
          const x=50+Math.cos(angle)*(r/6), y=50+Math.sin(angle)*(r/9)
          const ini=pro.company_name.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase()
          return (
            <button key={pro.id} onClick={()=>setSelected(pro)}
              className="absolute z-10 hover:scale-110 transition-transform"
              style={{left:`${x}%`,top:`${y}%`,transform:'translate(-50%,-50%)'}}>
              <div className="relative">
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center font-fredoka text-sm text-white shadow-lg border-2 border-white"
                  style={{background:pro.is_premium?'#F59E0B':'var(--accent)'}}>{ini}</div>
                {pro.is_premium && <div className="absolute -top-1 -right-1 text-xs">⭐</div>}
              </div>
            </button>
          )
        })}
      </div>

      <div className="px-4 py-3">
        <div className="text-sm font-black text-gray-400 mb-2">
          {pros.length} pro{pros.length>1?'s':''} {activeService?SERVICE_LABELS[activeService].label.toLowerCase():'disponibles'}
        </div>
        <div className="space-y-2">
          {pros.map(pro=>{
            const ini=pro.company_name.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase()
            return (
              <button key={pro.id} onClick={()=>openProfile(pro)}
                className="w-full flex items-center gap-3 p-3 bg-white rounded-2xl text-left hover:shadow-md transition-shadow">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-fredoka text-white flex-shrink-0"
                  style={{background:pro.is_premium?'#F59E0B':'var(--accent)'}}>{ini}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-black text-sm text-navy flex items-center gap-1">
                    {pro.company_name} {pro.is_premium && <span className="text-xs">⭐</span>}
                  </div>
                  <div className="text-xs font-bold text-gray-400">
                    {pro.services.map(s=>SERVICE_LABELS[s]?.label).join(', ')} · ⭐{pro.rating_avg} ({pro.rating_count})
                  </div>
                  <div className="text-xs font-black mt-0.5" style={{color:'var(--accent)'}}>
                    {pro.hourly_rate}€/h · Dépl. {pro.travel_fee}€
                  </div>
                </div>
                <span className="text-accent font-black flex-shrink-0">→</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Preview pin sélectionné */}
      {selected && step==='map' && (
        <div className="fixed inset-0 z-40" onClick={()=>setSelected(null)}>
          <div className="absolute inset-0" style={{background:'rgba(0,0,0,0.2)'}}/>
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl p-5 pb-8" onClick={e=>e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4"/>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center font-fredoka text-lg text-white"
                style={{background:selected.is_premium?'#F59E0B':'var(--accent)'}}>
                {selected.company_name.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase()}</div>
              <div className="flex-1">
                <div className="font-fredoka text-lg text-navy">{selected.company_name}</div>
                <div className="text-sm font-bold text-gray-400">⭐ {selected.rating_avg} ({selected.rating_count})</div>
              </div>
            </div>
            <button onClick={()=>openProfile(selected)}
              className="w-full py-4 rounded-full text-white font-fredoka text-lg" style={{background:'var(--accent)'}}>
              Voir la fiche →</button>
          </div>
        </div>
      )}
    </div>
  )

  // ───────────── PROFILE ─────────────
  if (step==='profile' && selected) {
    const ini=selected.company_name.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase()
    return (
      <div className="min-h-screen pt-9" style={{background:'var(--cream)'}}>
        <DemoBanner/>
        <div className="px-5 pt-5 pb-8" style={{background:'var(--navy)'}}>
          <button onClick={()=>{setSelected(null);setStep('map')}} className="text-white mb-4 text-sm font-black">← Carte</button>
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-3xl flex items-center justify-center font-fredoka text-2xl text-white border-4 border-white/10"
              style={{background:selected.is_premium?'#F59E0B':'var(--accent)'}}>{ini}</div>
            <div className="flex-1">
              <h1 className="font-fredoka text-2xl text-white flex items-center gap-2">{selected.company_name} {selected.is_premium&&<span className="text-base">⭐</span>}</h1>
              <div className="text-sm font-bold mt-1" style={{color:'rgba(255,255,255,0.6)'}}>
                ⭐ {selected.rating_avg} · {selected.rating_count} avis · {selected.mission_count} missions</div>
              {selected.is_available && <span className="inline-block mt-2 px-2 py-0.5 rounded-full text-xs font-black" style={{background:'#DCFCE7',color:'#15803D'}}>● Disponible</span>}
            </div>
          </div>
        </div>
        <div className="bg-white rounded-t-3xl -mt-4 px-5 py-5">
          <div className="flex gap-2 mb-5">
            <div className="flex-1 p-3 rounded-2xl text-center" style={{background:'var(--cream)'}}>
              <div className="font-fredoka text-xl" style={{color:'var(--accent)'}}>{selected.hourly_rate}€</div>
              <div className="text-xs font-black text-gray-400">/heure</div></div>
            <div className="flex-1 p-3 rounded-2xl text-center" style={{background:'var(--cream)'}}>
              <div className="font-fredoka text-xl" style={{color:'var(--accent)'}}>{selected.travel_fee}€</div>
              <div className="text-xs font-black text-gray-400">déplacement</div></div>
            <div className="flex-1 p-3 rounded-2xl text-center" style={{background:'var(--cream)'}}>
              <div className="font-fredoka text-xl" style={{color:'var(--accent)'}}>{selected.radius_km}km</div>
              <div className="text-xs font-black text-gray-400">rayon</div></div>
          </div>
          <div className="flex flex-wrap gap-2 mb-5">
            {selected.services.map(s=>(
              <span key={s} className="px-3 py-1.5 rounded-full text-xs font-black" style={{background:'var(--accent-l)',color:'var(--accent-d)'}}>
                {SERVICE_LABELS[s]?.emoji} {SERVICE_LABELS[s]?.label}</span>))}
          </div>
          <div className="flex gap-1 p-1 rounded-2xl mb-4" style={{background:'var(--cream)'}}>
            {([['apropos','À propos'],['avis','Avis'],['galerie','Galerie']] as const).map(([k,l])=>(
              <button key={k} onClick={()=>setTab(k)} className="flex-1 py-2.5 rounded-xl text-sm font-black"
                style={tab===k?{background:'white',color:'var(--navy)'}:{color:'#9CA3AF'}}>{l}</button>))}
          </div>
          {tab==='apropos' && (
            <div>
              <p className="text-sm font-bold text-gray-600 leading-relaxed mb-4">{selected.bio}</p>
              <div className="space-y-2">
                {[['🪪','Identité vérifiée'],['📋','Documents fournis'],['🛡️','RC Professionnelle'],['💳','Paiement sécurisé Nexto']].map(([i,l])=>(
                  <div key={l} className="flex items-center gap-3 p-3 rounded-xl" style={{background:'var(--cream)'}}>
                    <span className="text-lg">{i}</span><span className="flex-1 text-sm font-black text-navy">{l}</span>
                    <span style={{color:'var(--ok)'}}>✓</span></div>))}
              </div>
              <div className="mt-3 p-3 rounded-xl text-xs font-bold text-gray-400" style={{background:'#FFF7ED'}}>
                Statut : {LEGAL_FORM_LABELS[selected.legal_form as keyof typeof LEGAL_FORM_LABELS]}. Nexto met à disposition les documents sur demande mais ne garantit pas leur authenticité.</div>
            </div>
          )}
          {tab==='avis' && (
            <div className="space-y-3">
              {reviews.length===0 && <div className="text-center py-8 text-gray-300 font-bold">Aucun avis</div>}
              {reviews.map(r=>(
                <div key={r.id} className="p-4 rounded-2xl" style={{background:'var(--cream)'}}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-black text-sm text-navy">{r.author}</span>
                    <span className="text-sm">{'⭐'.repeat(r.rating)}</span></div>
                  <p className="text-sm font-bold text-gray-600">{r.comment}</p></div>))}
            </div>
          )}
          {tab==='galerie' && (
            <div className="grid grid-cols-3 gap-2">
              {[1,2,3,4,5,6].map(i=>(
                <div key={i} className="aspect-square rounded-2xl flex items-center justify-center" style={{background:'var(--cream)'}}>
                  <span className="text-2xl opacity-30">{selected.services.map(s=>SERVICE_LABELS[s]?.emoji)[0]}</span></div>))}
            </div>
          )}
        </div>
        <div className="sticky bottom-0 bg-white px-5 py-4 border-t border-gray-100">
          <button onClick={()=>setStep('request')} className="w-full py-4 rounded-full text-white font-fredoka text-lg" style={{background:'var(--accent)'}}>
            Demander un devis</button>
        </div>
      </div>
    )
  }

  // ───────────── REQUEST ─────────────
  if (step==='request' && selected) return (
    <div className="min-h-screen pt-9" style={{background:'var(--navy)'}}>
      <DemoBanner/>
      <div className="px-5 pt-5 pb-4">
        <button onClick={()=>setStep('profile')} className="text-white mb-3 text-sm font-black">← Retour</button>
        <h1 className="font-fredoka text-2xl text-white">Demande de devis</h1>
        <p className="text-sm font-bold mt-1" style={{color:'rgba(255,255,255,0.5)'}}>à {selected.company_name}</p>
      </div>
      <div className="bg-white rounded-t-3xl px-5 py-6 min-h-screen space-y-4">
        <div className="p-3 rounded-2xl" style={{background:'var(--accent-l)'}}>
          <span className="font-black text-sm" style={{color:'var(--accent-d)'}}>
            {SERVICE_LABELS[selected.services[0]].emoji} {SERVICE_LABELS[selected.services[0]].label}</span>
        </div>
        <div>
          <label className="block text-xs font-black uppercase tracking-wider text-gray-500 mb-1.5">Description (pré-remplie démo)</label>
          <textarea rows={3} defaultValue="Bonjour, j'aurais besoin d'une intervention rapide. Quelles sont vos disponibilités cette semaine ?"
            className="w-full px-4 py-3 border-2 border-gray-100 rounded-2xl text-sm font-bold outline-none focus:border-accent resize-none"/>
        </div>
        <div>
          <label className="block text-xs font-black uppercase tracking-wider text-gray-500 mb-1.5">Adresse</label>
          <input defaultValue="12 rue de l'Oratoire, 06130 Grasse"
            className="w-full px-4 py-3 border-2 border-gray-100 rounded-2xl text-sm font-bold outline-none focus:border-accent"/>
        </div>
        <button onClick={()=>{setChatMsgs([{me:true,txt:"Bonjour, j'aurais besoin d'une intervention rapide cette semaine."},{me:false,txt:'Bonjour ! Je suis disponible jeudi matin. Je vous propose un devis à 90€ TTC pour l\'intervention. Ça vous convient ?'}]);setStep('chat')}}
          className="w-full py-4 rounded-full text-white font-fredoka text-lg mt-2" style={{background:'var(--accent)'}}>
          Envoyer la demande →</button>
      </div>
    </div>
  )

  // ───────────── CHAT ─────────────
  if (step==='chat' && selected) return (
    <div className="min-h-screen flex flex-col pt-9" style={{background:'var(--cream)'}}>
      <DemoBanner/>
      <div className="px-4 py-3 flex items-center gap-3" style={{background:'var(--navy)'}}>
        <button onClick={()=>setStep('request')} className="text-white font-black">←</button>
        <div className="flex-1"><div className="font-fredoka text-white">{selected.company_name}</div>
          <div className="text-xs font-bold" style={{color:'rgba(255,255,255,0.5)'}}>🔒 Conversation sécurisée</div></div>
      </div>
      <div className="px-4 py-2 text-xs font-bold text-center" style={{background:'var(--accent-l)',color:'var(--accent-d)'}}>
        🛡️ Coordonnées et paiements hors plateforme bloqués</div>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {chatMsgs.map((m,i)=>(
          <div key={i} className={`flex ${m.me?'justify-end':'justify-start'}`}>
            <div className="max-w-[75%] px-4 py-2.5 rounded-2xl text-sm font-bold"
              style={m.me?{background:'var(--accent)',color:'white'}:{background:'white',color:'var(--navy)'}}>{m.txt}</div>
          </div>))}
        <div className="flex justify-center">
          <div className="px-4 py-3 rounded-2xl text-center" style={{background:'white',border:'2px solid var(--accent)'}}>
            <div className="text-xs font-black text-gray-400 mb-1">DEVIS REÇU</div>
            <div className="font-fredoka text-2xl text-navy mb-1">90,00 €</div>
            <div className="text-xs font-bold text-gray-400 mb-3">Intervention {SERVICE_LABELS[selected.services[0]].label.toLowerCase()} · jeudi matin</div>
            <button onClick={()=>setStep('payment')} className="px-6 py-2.5 rounded-full text-white font-black text-sm" style={{background:'var(--accent)'}}>
              Accepter et payer →</button>
          </div>
        </div>
      </div>
      <div className="px-4 py-3 bg-white flex gap-2 items-center border-t border-gray-100">
        <input value={chatInput} onChange={e=>setChatInput(e.target.value)}
          className="flex-1 px-4 py-3 rounded-full text-sm font-bold outline-none" style={{background:'var(--cream)'}} placeholder="Message..."/>
        <button onClick={()=>{if(chatInput){setChatMsgs([...chatMsgs,{me:true,txt:chatInput}]);setChatInput('')}}}
          className="w-11 h-11 rounded-full flex items-center justify-center text-white font-black" style={{background:'var(--accent)'}}>↑</button>
      </div>
    </div>
  )

  // ───────────── PAYMENT (escrow) ─────────────
  if (step==='payment' && selected) return (
    <div className="min-h-screen pt-9" style={{background:'var(--navy)'}}>
      <DemoBanner/>
      <div className="px-5 pt-5 pb-4">
        <button onClick={()=>setStep('chat')} className="text-white mb-3 text-sm font-black">← Retour</button>
        <h1 className="font-fredoka text-2xl text-white">Paiement sécurisé</h1>
        <p className="text-sm font-bold mt-1" style={{color:'rgba(255,255,255,0.5)'}}>🔒 Séquestre Nexto — l'argent est bloqué jusqu'à validation</p>
      </div>
      <div className="bg-white rounded-t-3xl px-5 py-6 min-h-screen">
        <div className="p-4 rounded-2xl mb-4" style={{background:'var(--cream)'}}>
          <div className="flex justify-between text-sm font-bold mb-2"><span className="text-gray-500">Prestation</span><span className="text-navy">90,00 €</span></div>
          <div className="flex justify-between text-sm font-bold mb-2"><span className="text-gray-500">Frais de service Nexto</span><span className="text-navy">5,40 €</span></div>
          <div className="h-px bg-gray-200 my-2"/>
          <div className="flex justify-between font-fredoka text-lg"><span className="text-navy">Total</span><span style={{color:'var(--accent)'}}>95,40 €</span></div>
        </div>
        <div className="space-y-3 mb-4">
          <div><label className="block text-xs font-black uppercase tracking-wider text-gray-500 mb-1.5">Carte (démo)</label>
            <input defaultValue="4242 4242 4242 4242" className="w-full px-4 py-3 border-2 border-gray-100 rounded-2xl text-sm font-bold outline-none tracking-widest"/></div>
          <div className="flex gap-3">
            <input defaultValue="12/28" className="flex-1 px-4 py-3 border-2 border-gray-100 rounded-2xl text-sm font-bold outline-none"/>
            <input defaultValue="123" className="flex-1 px-4 py-3 border-2 border-gray-100 rounded-2xl text-sm font-bold outline-none"/>
          </div>
        </div>
        <div className="p-3 rounded-2xl mb-4" style={{background:'#DCFCE7'}}>
          <div className="text-xs font-black" style={{color:'#15803D'}}>
            💶 Votre paiement est bloqué en séquestre. Le pro n'est payé qu'après validation de l'intervention par double QR code et absence de litige.</div>
        </div>
        <button onClick={()=>setStep('tracking')} className="w-full py-4 rounded-full text-white font-fredoka text-lg" style={{background:'var(--accent)'}}>
          Payer 95,40 € en séquestre 🔒</button>
      </div>
    </div>
  )

  // ───────────── TRACKING + QR ─────────────
  if (step==='tracking' && selected) return (
    <div className="min-h-screen pt-9" style={{background:'var(--cream)'}}>
      <DemoBanner/>
      <div className="px-5 pt-5 pb-4" style={{background:'var(--navy)'}}>
        <h1 className="font-fredoka text-2xl text-white">Suivi intervention</h1>
        <p className="text-sm font-bold mt-1" style={{color:'rgba(255,255,255,0.5)'}}>{selected.company_name} arrive</p>
      </div>
      <div className="bg-white rounded-t-3xl -mt-4 px-5 py-6 min-h-screen">
        <div className="space-y-3 mb-6">
          {[['✅','Paiement bloqué en séquestre','95,40 € sécurisés',true],
            ['🚗','Pro en route','Arrivée estimée 9h15',true],
            ['📍','QR code d\'arrivée','Le pro scanne en arrivant',false],
            ['🔧','Intervention en cours','',false],
            ['🏁','QR code de fin','Validation des deux parties',false],
            ['💶','Paiement libéré','Versé au pro à J+2 sans litige',false]].map(([i,t,s,done],idx)=>(
            <div key={idx} className="flex items-center gap-3 p-3 rounded-2xl" style={{background:done?'#F0FFF4':'var(--cream)'}}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                style={{background:done?'#DCFCE7':'white'}}>{i}</div>
              <div className="flex-1"><div className="font-black text-sm text-navy">{t}</div>
                {s && <div className="text-xs font-bold text-gray-400">{s}</div>}</div>
              {done && <span style={{color:'var(--ok)'}}>✓</span>}
            </div>))}
        </div>
        <div className="p-5 rounded-3xl text-center mb-4" style={{background:'var(--navy)'}}>
          <div className="text-xs font-black uppercase tracking-wider mb-3" style={{color:'rgba(255,255,255,0.5)'}}>QR Code de validation</div>
          <div className="w-40 h-40 mx-auto rounded-2xl flex items-center justify-center" style={{background:'white'}}>
            <svg width="120" height="120" viewBox="0 0 120 120">
              <rect width="120" height="120" fill="white"/>
              {Array.from({length:144}).map((_,i)=>{const x=(i%12)*10,y=Math.floor(i/12)*10;return Math.random()>0.5?<rect key={i} x={x} y={y} width="10" height="10" fill="#1A1033"/>:null})}
            </svg>
          </div>
          <div className="text-xs font-bold mt-3" style={{color:'rgba(255,255,255,0.5)'}}>Le pro scanne ce code à l'arrivée et en fin d'intervention</div>
        </div>
        <button onClick={()=>setStep('done')} className="w-full py-4 rounded-full text-white font-fredoka text-lg" style={{background:'var(--accent)'}}>
          Simuler validation complète →</button>
      </div>
    </div>
  )

  // ───────────── DONE + FACTURE ─────────────
  if (step==='done' && selected) return (
    <div className="min-h-screen pt-9" style={{background:'var(--cream)'}}>
      <DemoBanner/>
      <div className="px-5 pt-8 pb-6 text-center" style={{background:'var(--navy)'}}>
        <div className="text-5xl mb-3">🎉</div>
        <h1 className="font-fredoka text-2xl text-white">Intervention terminée !</h1>
        <p className="text-sm font-bold mt-1" style={{color:'rgba(255,255,255,0.6)'}}>Paiement libéré · Facture émise</p>
      </div>
      <div className="bg-white rounded-t-3xl -mt-4 px-5 py-6 min-h-screen">
        {/* Facture */}
        <div className="border-2 border-gray-100 rounded-2xl p-5 mb-4">
          <div className="flex justify-between items-start mb-4">
            <div><div className="font-fredoka text-lg text-navy">FACTURE</div>
              <div className="text-xs font-bold text-gray-400">FAC-DEMO-2026</div></div>
            <div className="text-right"><div className="font-fredoka text-lg" style={{color:'var(--accent)'}}>Nexto</div>
              <div className="text-xs font-bold text-gray-400">{new Date().toLocaleDateString('fr-FR')}</div></div>
          </div>
          <div className="text-xs font-bold text-gray-500 mb-3">
            <div className="font-black text-navy">{selected.company_name}</div>
            {LEGAL_FORM_LABELS[selected.legal_form as keyof typeof LEGAL_FORM_LABELS]}<br/>
            {selected.vat_regime==='franchise_base'?'TVA non applicable, art. 293 B du CGI':selected.vat_regime==='non_assujetti'?'Non assujetti à la TVA':'TVA incluse'}
          </div>
          <div className="space-y-2 text-sm font-bold border-t border-gray-100 pt-3">
            <div className="flex justify-between"><span className="text-gray-500">Prestation {SERVICE_LABELS[selected.services[0]].label.toLowerCase()}</span><span className="text-navy">90,00 €</span></div>
            <div className="flex justify-between text-xs"><span className="text-gray-400">dont commission Nexto</span><span className="text-gray-400">9,00 €</span></div>
            <div className="flex justify-between border-t border-gray-100 pt-2 font-fredoka">
              <span className="text-navy">Total payé</span><span style={{color:'var(--accent)'}}>90,00 €</span></div>
          </div>
          {selected.vat_regime==='non_assujetti' && (
            <div className="mt-3 p-2 rounded-xl text-xs font-bold text-center" style={{background:'#DCFCE7',color:'#15803D'}}>
              ✓ Éligible crédit d'impôt 50% (case 7DB)</div>)}
        </div>
        <div className="p-4 rounded-2xl mb-4" style={{background:'var(--accent-l)'}}>
          <div className="text-sm font-black mb-2" style={{color:'var(--accent-d)'}}>Versement au pro</div>
          <div className="flex justify-between text-sm font-bold" style={{color:'var(--accent-d)'}}>
            <span>Montant net (commission déduite)</span><span>81,00 €</span></div>
          <div className="text-xs font-bold mt-1" style={{color:'var(--accent-d)'}}>Virement SEPA J+2</div>
        </div>

        <div className="text-center mb-4">
          <div className="font-fredoka text-lg text-navy mb-1">C'est tout le parcours Nexto !</div>
          <div className="text-sm font-bold text-gray-400">Recherche → Devis → Paiement séquestre → QR → Facture</div>
        </div>
        <Link href="/demo" onClick={()=>setStep('map')} className="block w-full py-4 rounded-full text-center font-fredoka text-lg border-2 border-gray-100 text-navy mb-2">
          Recommencer la démo</Link>
        <Link href="/auth/signup" className="block w-full py-4 rounded-full text-center text-white font-fredoka text-lg" style={{background:'var(--accent)'}}>
          Créer mon compte Nexto →</Link>
      </div>
    </div>
  )

  return null
}
