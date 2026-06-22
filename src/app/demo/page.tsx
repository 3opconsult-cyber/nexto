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
  const [warn, setWarn] = useState('')

  useEffect(() => {
    setLoading(true)
    fetchDemoPros(activeService ?? undefined).then(setPros).finally(()=>setLoading(false))
  }, [activeService])

  async function openProfile(pro: DemoPro) {
    const { reviews } = await fetchDemoPro(pro.id)
    setSelected(pro); setReviews(reviews); setTab('apropos'); setStep('profile')
  }

  function sendChat() {
    if (!chatInput.trim()) return
    const banned = /(\d[\s.-]*){9,}|whatsapp|virement|espèce|@/i.test(chatInput)
    if (banned) { setWarn('Coordonnées hors plateforme bloquées 🔒'); setTimeout(()=>setWarn(''),3000) }
    setChatMsgs(m=>[...m,{me:true,txt:banned?chatInput.replace(/(\d[\s.-]*){9,}/g,'•••'):chatInput}])
    setChatInput('')
    setTimeout(()=>setChatMsgs(m=>[...m,{me:false,txt:'Parfait, je peux passer cet après-midi. Je vous envoie un devis.'}]),1200)
  }

  const services = Object.entries(SERVICE_LABELS) as [ServiceType,{label:string;emoji:string}][]

  const Banner = () => (
    <div className="sticky top-0 z-50 px-4 py-2 text-center text-xs font-black flex items-center justify-center gap-2" style={{background:'var(--accent)',color:'white'}}>
      <span>🎬 MODE DÉMO — Parcours complet sans inscription</span>
      <Link href="/" className="underline">Quitter</Link>
    </div>
  )

  // ========== ÉTAPE MAP ==========
  if (step === 'map') {
    return (
      <div className="min-h-screen" style={{background:'var(--cream)'}}>
        <Banner/>
        <div className="px-5 pt-4 pb-3" style={{background:'var(--navy)'}}>
          <div className="font-fredoka text-2xl text-white">Nexto</div>
          <div className="text-xs font-bold mb-3" style={{color:'rgba(255,255,255,0.5)'}}>Trouvez un pro autour de vous — Grasse (06)</div>
          <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
            <button onClick={()=>setActiveService(null)} className="px-4 py-2 rounded-full text-sm font-black whitespace-nowrap flex-shrink-0"
              style={activeService===null?{background:'var(--accent)',color:'white'}:{background:'rgba(255,255,255,0.15)',color:'white'}}>Tous</button>
            {services.map(([k,{label,emoji}])=>(
              <button key={k} onClick={()=>setActiveService(k)} className="px-4 py-2 rounded-full text-sm font-black whitespace-nowrap flex-shrink-0"
                style={activeService===k?{background:'var(--accent)',color:'white'}:{background:'rgba(255,255,255,0.15)',color:'white'}}>{emoji} {label}</button>
            ))}
          </div>
        </div>

        {/* Mini-carte décorative */}
        <div className="relative h-44 overflow-hidden" style={{background:'linear-gradient(135deg,#E8E4F0,#F0EDE8)'}}>
          <svg className="absolute inset-0 w-full h-full opacity-40" xmlns="http://www.w3.org/2000/svg">
            <defs><pattern id="g" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0 L0 0 0 32" fill="none" stroke="#7C5CFC" strokeWidth="0.5" opacity="0.4"/></pattern></defs>
            <rect width="100%" height="100%" fill="url(#g)"/>
            <path d="M0,90 Q150,70 300,100 T600,90" stroke="#7C5CFC" strokeWidth="2" fill="none" opacity="0.3"/>
            <path d="M120,0 L140,200" stroke="#7C5CFC" strokeWidth="3" fill="none" opacity="0.2"/>
          </svg>
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="w-4 h-4 rounded-full border-2 border-white shadow-lg" style={{background:'var(--accent)'}}/>
          </div>
          {pros.slice(0,6).map((p,i)=>{
            const pos=[[20,30],[70,25],[40,60],[80,65],[15,70],[55,40]][i]||[50,50]
            const ini=p.company_name.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase()
            return (
              <button key={p.id} onClick={()=>openProfile(p)} className="absolute hover:scale-110 transition-transform" style={{left:`${pos[0]}%`,top:`${pos[1]}%`,transform:'translate(-50%,-50%)'}}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center font-fredoka text-xs text-white shadow-lg border-2 border-white" style={{background:p.is_premium?'#F59E0B':'var(--accent)'}}>{ini}</div>
              </button>
            )
          })}
        </div>

        {/* Liste pros TOUJOURS visible */}
        <div className="px-4 py-4">
          <div className="text-sm font-black text-gray-400 mb-3">{loading?'Recherche...':`${pros.length} pro${pros.length>1?'s':''} disponible${pros.length>1?'s':''}`}</div>
          <div className="space-y-2">
            {pros.map(p=>{
              const ini=p.company_name.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase()
              return (
                <button key={p.id} onClick={()=>openProfile(p)} className="w-full flex items-center gap-3 p-3 rounded-2xl bg-white hover:shadow-md transition-all text-left" style={{boxShadow:'0 2px 8px rgba(0,0,0,0.04)'}}>
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-fredoka text-white flex-shrink-0" style={{background:p.is_premium?'#F59E0B':'var(--accent)'}}>{ini}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="font-black text-sm text-navy">{p.company_name}</span>
                      {p.is_premium && <span className="text-xs">⭐</span>}
                    </div>
                    <div className="text-xs font-bold text-gray-400">{p.services.map(s=>SERVICE_LABELS[s]?.label).join(', ')} · ⭐ {Number(p.rating_avg).toFixed(1)} ({p.rating_count})</div>
                    <div className="text-sm font-black" style={{color:'var(--accent)'}}>{Number(p.hourly_rate).toFixed(0)} €/h · Dépl. {Number(p.travel_fee).toFixed(0)} €</div>
                  </div>
                  <span className="text-gray-300">→</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // ========== ÉTAPE PROFILE ==========
  if (step === 'profile' && selected) {
    const ini=selected.company_name.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase()
    return (
      <div className="min-h-screen" style={{background:'var(--cream)'}}>
        <Banner/>
        <div className="px-5 pt-4 pb-6" style={{background:'var(--navy)'}}>
          <button onClick={()=>setStep('map')} className="text-white text-sm font-black mb-3">← Retour</button>
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-3xl flex items-center justify-center font-fredoka text-2xl text-white" style={{background:selected.is_premium?'#F59E0B':'var(--accent)'}}>{ini}</div>
            <div>
              <div className="flex items-center gap-2"><h1 className="font-fredoka text-2xl text-white">{selected.company_name}</h1>{selected.is_premium && <span>⭐</span>}</div>
              <div className="text-sm font-bold" style={{color:'rgba(255,255,255,0.6)'}}>⭐ {Number(selected.rating_avg).toFixed(1)} · {selected.rating_count} avis · {selected.mission_count} missions</div>
              <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-black" style={{background:'#DCFCE7',color:'#15803D'}}>● Disponible</span>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-t-3xl -mt-4 px-5 py-5">
          <div className="flex gap-2 mb-5">
            {[['Tarif',`${Number(selected.hourly_rate).toFixed(0)} €/h`],['Déplacement',`${Number(selected.travel_fee).toFixed(0)} €`],['Statut',LEGAL_FORM_LABELS[selected.legal_form as keyof typeof LEGAL_FORM_LABELS]?.split(' ')[0]||'—']].map(([l,v])=>(
              <div key={l} className="flex-1 p-3 rounded-2xl text-center" style={{background:'var(--cream)'}}>
                <div className="font-fredoka text-base" style={{color:'var(--accent)'}}>{v}</div>
                <div className="text-xs font-black text-gray-400">{l}</div>
              </div>
            ))}
          </div>
          <div className="flex gap-1 p-1 rounded-2xl mb-4" style={{background:'var(--cream)'}}>
            {([['apropos','À propos'],['avis','Avis'],['galerie','Galerie']] as const).map(([k,l])=>(
              <button key={k} onClick={()=>setTab(k)} className="flex-1 py-2.5 rounded-xl text-sm font-black" style={tab===k?{background:'white',color:'var(--navy)'}:{color:'#9CA3AF'}}>{l}</button>
            ))}
          </div>
          {tab==='apropos' && (
            <div>
              <p className="text-sm font-bold text-gray-600 mb-4">{selected.bio}</p>
              {[['🪪','Identité vérifiée'],['🛡️','RC Professionnelle'],['💳','Paiement sécurisé Nexto']].map(([e,l])=>(
                <div key={l} className="flex items-center gap-3 p-3 rounded-xl mb-2" style={{background:'var(--cream)'}}><span>{e}</span><span className="flex-1 text-sm font-black text-navy">{l}</span><span style={{color:'var(--ok)'}}>✓</span></div>
              ))}
            </div>
          )}
          {tab==='avis' && (
            <div className="space-y-3">
              {reviews.length===0 && <div className="text-center py-8 text-gray-300 font-bold">Aucun avis</div>}
              {reviews.map(r=>(
                <div key={r.id} className="p-4 rounded-2xl" style={{background:'var(--cream)'}}>
                  <div className="flex justify-between mb-1"><span className="font-black text-sm text-navy">{r.author}</span><span>{'⭐'.repeat(r.rating)}</span></div>
                  <p className="text-sm font-bold text-gray-600">{r.comment}</p>
                </div>
              ))}
            </div>
          )}
          {tab==='galerie' && <div className="grid grid-cols-3 gap-2">{[1,2,3,4,5,6].map(i=><div key={i} className="aspect-square rounded-2xl flex items-center justify-center" style={{background:'var(--cream)'}}><span className="text-2xl opacity-30">📷</span></div>)}</div>}
        </div>
        <div className="sticky bottom-0 bg-white px-5 py-4 border-t border-gray-100">
          <button onClick={()=>setStep('request')} className="w-full py-4 rounded-full text-white font-fredoka text-lg" style={{background:'var(--accent)'}}>Demander un devis</button>
        </div>
      </div>
    )
  }

  // ========== ÉTAPE REQUEST ==========
  if (step === 'request') {
    return (
      <div className="min-h-screen" style={{background:'var(--navy)'}}>
        <Banner/>
        <div className="px-5 pt-5 pb-4">
          <button onClick={()=>setStep('profile')} className="text-white text-sm font-black mb-3">← Retour</button>
          <h1 className="font-fredoka text-2xl text-white">Décrivez votre besoin</h1>
        </div>
        <div className="bg-white rounded-t-3xl px-5 py-6 min-h-screen space-y-4">
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-gray-500 mb-1.5">Description</label>
            <textarea rows={4} defaultValue="Fuite sous l’évier, robinet à changer" className="w-full px-4 py-3 border-2 border-gray-100 rounded-2xl text-sm font-bold outline-none focus:border-accent resize-none"/>
          </div>
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-gray-500 mb-1.5">Adresse</label>
            <input defaultValue="12 av. des Mimosas, Grasse" className="w-full px-4 py-3 border-2 border-gray-100 rounded-2xl text-sm font-bold outline-none focus:border-accent"/>
          </div>
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-gray-500 mb-2">Urgence</label>
            <div className="flex gap-2">
              {['🚨 Urgent',"📅 Aujourd'hui",'🗓️ Flexible'].map((u,i)=>(
                <button key={u} className="flex-1 py-3 rounded-2xl border-2 text-xs font-black" style={i===1?{borderColor:'var(--accent)',background:'var(--accent-l)',color:'var(--accent-d)'}:{borderColor:'#F0EDE8',color:'var(--navy)'}}>{u}</button>
              ))}
            </div>
          </div>
          <button onClick={()=>{setChatMsgs([{me:false,txt:'Bonjour ! J\’ai bien reçu votre demande pour la fuite. Je peux intervenir aujourd\’hui.'}]);setStep('chat')}} className="w-full py-4 rounded-full text-white font-fredoka text-lg" style={{background:'var(--accent)'}}>Envoyer la demande →</button>
        </div>
      </div>
    )
  }

  // ========== ÉTAPE CHAT ==========
  if (step === 'chat') {
    return (
      <div className="min-h-screen flex flex-col" style={{background:'var(--cream)'}}>
        <Banner/>
        <div className="px-4 py-3 flex items-center gap-3" style={{background:'var(--navy)'}}>
          <button onClick={()=>setStep('request')} className="text-white font-black">←</button>
          <div className="flex-1"><div className="font-fredoka text-white">{selected?.company_name}</div><div className="text-xs font-bold" style={{color:'rgba(255,255,255,0.5)'}}>🔒 Conversation sécurisée</div></div>
        </div>
        <div className="px-4 py-2 text-xs font-bold text-center" style={{background:'var(--accent-l)',color:'var(--accent-d)'}}>🛡️ Échange de coordonnées et paiements hors plateforme bloqués.</div>
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {chatMsgs.map((m,i)=>(
            <div key={i} className={`flex ${m.me?'justify-end':'justify-start'}`}>
              <div className="max-w-[75%] px-4 py-2.5 rounded-2xl text-sm font-bold" style={m.me?{background:'var(--accent)',color:'white'}:{background:'white',color:'var(--navy)'}}>{m.txt}</div>
            </div>
          ))}
        </div>
        {warn && <div className="mx-4 mb-2 px-4 py-2 rounded-xl text-xs font-black text-center" style={{background:'#FEE2E2',color:'#B91C1C'}}>{warn}</div>}
        <div className="px-4 py-3 bg-white flex gap-2 items-center border-t border-gray-100">
          <input value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendChat()} className="flex-1 px-4 py-3 rounded-full text-sm font-bold outline-none" style={{background:'var(--cream)'}} placeholder="Votre message..."/>
          <button onClick={sendChat} className="w-11 h-11 rounded-full text-white font-black" style={{background:'var(--accent)'}}>↑</button>
        </div>
        <div className="px-4 pb-6 pt-2 bg-white">
          <button onClick={()=>setStep('payment')} className="w-full py-4 rounded-full text-white font-fredoka text-lg" style={{background:'var(--accent)'}}>Accepter le devis (90 €) →</button>
        </div>
      </div>
    )
  }

  // ========== ÉTAPE PAYMENT ==========
  if (step === 'payment') {
    return (
      <div className="min-h-screen flex flex-col" style={{background:'var(--navy)'}}>
        <Banner/>
        <div className="flex-1 px-6 py-8">
          <button onClick={()=>setStep('chat')} className="text-white text-sm font-black mb-6">← Retour</button>
          <h1 className="font-fredoka text-2xl text-white mb-2">Paiement sécurisé</h1>
          <p className="text-sm font-bold mb-6" style={{color:'rgba(255,255,255,0.5)'}}>Votre argent est bloqué en séquestre jusqu'à validation du travail.</p>
          <div className="bg-white rounded-3xl p-5 mb-4">
            <div className="flex justify-between mb-2 text-sm font-bold"><span className="text-gray-500">Prestation plomberie</span><span className="text-navy">75 €</span></div>
            <div className="flex justify-between mb-2 text-sm font-bold"><span className="text-gray-500">Déplacement</span><span className="text-navy">15 €</span></div>
            <div className="flex justify-between mb-2 text-xs font-bold"><span className="text-gray-400">Frais de service Nexto</span><span className="text-gray-400">Inclus</span></div>
            <div className="border-t border-gray-100 mt-2 pt-2 flex justify-between"><span className="font-fredoka text-lg text-navy">Total</span><span className="font-fredoka text-2xl" style={{color:'var(--accent)'}}>90 €</span></div>
          </div>
          <div className="bg-white rounded-3xl p-5 mb-4">
            <div className="text-xs font-black uppercase tracking-wider text-gray-400 mb-3">Carte bancaire</div>
            <div className="space-y-3">
              <div className="px-4 py-3 rounded-xl text-sm font-bold text-gray-400" style={{background:'var(--cream)'}}>4242 4242 4242 4242</div>
              <div className="flex gap-3"><div className="flex-1 px-4 py-3 rounded-xl text-sm font-bold text-gray-400" style={{background:'var(--cream)'}}>12/28</div><div className="flex-1 px-4 py-3 rounded-xl text-sm font-bold text-gray-400" style={{background:'var(--cream)'}}>123</div></div>
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 rounded-2xl mb-4" style={{background:'rgba(255,255,255,0.08)'}}>
            <span>🔒</span><span className="text-xs font-bold" style={{color:'rgba(255,255,255,0.7)'}}>Paiement bloqué en séquestre. Libéré au pro seulement après validation par QR code.</span>
          </div>
          <button onClick={()=>setStep('tracking')} className="w-full py-4 rounded-full text-white font-fredoka text-lg" style={{background:'var(--accent)'}}>Payer 90 € en séquestre →</button>
        </div>
      </div>
    )
  }

  // ========== ÉTAPE TRACKING ==========
  if (step === 'tracking') {
    return (
      <div className="min-h-screen" style={{background:'var(--cream)'}}>
        <Banner/>
        <div className="relative h-64 overflow-hidden" style={{background:'linear-gradient(135deg,#E8E4F0,#F0EDE8)'}}>
          <svg className="absolute inset-0 w-full h-full opacity-40"><defs><pattern id="g2" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0 L0 0 0 32" fill="none" stroke="#7C5CFC" strokeWidth="0.5"/></pattern></defs><rect width="100%" height="100%" fill="url(#g2)"/>
            <line x1="20%" y1="80%" x2="60%" y2="30%" stroke="#7C5CFC" strokeWidth="3" strokeDasharray="8 4"/>
          </svg>
          <div className="absolute left-[20%] top-[80%] -translate-x-1/2 -translate-y-1/2"><div className="w-4 h-4 rounded-full border-2 border-white" style={{background:'var(--navy)'}}/><div className="text-xs font-black mt-1" style={{color:'var(--navy)'}}>Vous</div></div>
          <div className="absolute left-[60%] top-[30%] -translate-x-1/2 -translate-y-1/2"><div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg animate-bounce" style={{background:'var(--accent)'}}>🚐</div></div>
        </div>
        <div className="bg-white rounded-t-3xl -mt-4 px-5 py-5">
          <div className="text-center mb-5">
            <div className="font-fredoka text-xl text-navy">{selected?.company_name} arrive</div>
            <div className="text-sm font-bold text-gray-400">Estimation : 12 min</div>
          </div>
          <div className="space-y-3 mb-5">
            {[['✅','Paiement bloqué en séquestre',true],['🚐','Pro en route',true],['📍','Arrivée — Scan QR code début',false],['🔧','Travail en cours',false],['✅','Fin — Scan QR code + validation',false]].map(([e,l,done],i)=>(
              <div key={i} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{background:done?'#DCFCE7':'var(--cream)'}}>{e}</div>
                <span className="text-sm font-black" style={{color:done?'var(--navy)':'#9CA3AF'}}>{l}</span>
              </div>
            ))}
          </div>
          <button onClick={()=>setStep('done')} className="w-full py-4 rounded-full text-white font-fredoka text-lg" style={{background:'var(--accent)'}}>Simuler la fin (Scan QR) →</button>
        </div>
      </div>
    )
  }

  // ========== ÉTAPE DONE ==========
  return (
    <div className="min-h-screen flex flex-col" style={{background:'var(--navy)'}}>
      <Banner/>
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="text-6xl mb-6">🎉</div>
        <h1 className="font-fredoka text-3xl text-white mb-3">Mission terminée !</h1>
        <p className="text-sm font-bold max-w-xs mb-8" style={{color:'rgba(255,255,255,0.6)'}}>
          Le travail est validé par double QR code. Le paiement vient d'être libéré automatiquement au pro. Votre facture est disponible.
        </p>
        <div className="w-full max-w-xs space-y-3">
          <div className="bg-white rounded-2xl p-4 text-left">
            <div className="flex justify-between text-sm font-bold mb-1"><span className="text-gray-500">Payé</span><span className="text-navy">90 €</span></div>
            <div className="flex justify-between text-sm font-bold mb-1"><span className="text-gray-500">Net pro</span><span className="text-navy">81 €</span></div>
            <div className="flex justify-between text-sm font-bold"><span className="text-gray-500">Commission Nexto</span><span style={{color:'var(--accent)'}}>9 €</span></div>
          </div>
          <button onClick={()=>{setStep('map');setSelected(null)}} className="w-full py-4 rounded-full text-white font-fredoka text-lg" style={{background:'var(--accent)'}}>↺ Recommencer la démo</button>
          <Link href="/auth/signup" className="block w-full py-4 rounded-full font-fredoka text-lg text-center border-2" style={{borderColor:'var(--accent)',color:'white'}}>Créer mon compte</Link>
        </div>
      </div>
    </div>
  )
}
