"use client"
import Link from 'next/link'

export default function Hub() {
  const sections = [
    {
      title: 'Présentation',
      desc: 'Le pitch complet, vue client et pro',
      items: [
        {emoji:'✨',label:'Animation présentation',href:'/presentation',tag:'Wow'},
        {emoji:'▶️',label:'Démo interactive end-to-end',href:'/demo',tag:'Sans inscription'},
      ]
    },
    {
      title: 'Parcours Client',
      desc: 'Trouver et réserver un pro',
      items: [
        {emoji:'🗺️',label:'Carte géolocalisée',href:'/map'},
        {emoji:'👤',label:'Mon profil & historique',href:'/client/profil'},
        {emoji:'📝',label:'Nouvelle demande',href:'/mission/new'},
      ]
    },
    {
      title: 'Parcours Pro',
      desc: 'Gérer son activité',
      items: [
        {emoji:'📊',label:'Dashboard pro',href:'/pro/dashboard'},
        {emoji:'📋',label:'Inscription pro (7 étapes)',href:'/pro/onboarding'},
        {emoji:'📄',label:'Documents',href:'/pro/onboarding/documents'},
      ]
    },
    {
      title: 'Administration',
      desc: 'Supervision plateforme',
      items: [
        {emoji:'⚙️',label:'Admin dashboard',href:'/admin',tag:'Super-admin'},
      ]
    },
    {
      title: 'Comptes',
      desc: 'Connexion',
      items: [
        {emoji:'🔑',label:'Connexion',href:'/auth/login'},
        {emoji:'✏️',label:'Inscription',href:'/auth/signup'},
      ]
    },
  ]

  return (
    <div className="min-h-screen" style={{background:'var(--navy)'}}>
      <div className="px-6 pt-12 pb-8 text-center">
        <div className="font-fredoka text-4xl text-white mb-2">Nexto</div>
        <div className="text-sm font-bold" style={{color:'rgba(255,255,255,0.5)'}}>Hub — toutes les portes d'entrée</div>
        <div className="inline-block mt-3 px-3 py-1 rounded-full text-xs font-black" style={{background:'#DCFCE7',color:'#15803D'}}>
          ● En production
        </div>
      </div>

      <div className="bg-white rounded-t-3xl px-5 py-6 min-h-screen">
        {sections.map(section=>(
          <div key={section.title} className="mb-6">
            <div className="font-fredoka text-lg text-navy">{section.title}</div>
            <div className="text-xs font-bold text-gray-400 mb-3">{section.desc}</div>
            <div className="space-y-2">
              {section.items.map(item=>(
                <Link key={item.href} href={item.href}
                  className="flex items-center gap-3 p-4 rounded-2xl border-2 border-gray-100 hover:border-accent transition-all">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{background:'var(--accent-l)'}}>{item.emoji}</div>
                  <span className="flex-1 font-black text-sm text-navy">{item.label}</span>
                  {item.tag && <span className="text-xs font-black px-2 py-0.5 rounded-full" style={{background:'var(--accent-l)',color:'var(--accent-d)'}}>{item.tag}</span>}
                  <span className="text-gray-300">→</span>
                </Link>
              ))}
            </div>
          </div>
        ))}

        <div className="mt-4 p-4 rounded-2xl" style={{background:'var(--cream)'}}>
          <div className="font-black text-sm text-navy mb-1">🔗 Liens techniques</div>
          <div className="space-y-1 text-xs font-bold" style={{color:'var(--accent-d)'}}>
            <a href="https://github.com/3opconsult-cyber/nexto" target="_blank" rel="noopener noreferrer" className="block underline">GitHub — code source</a>
            <a href="https://supabase.com/dashboard/project/wmiawwaxwlvascyflpba" target="_blank" rel="noopener noreferrer" className="block underline">Supabase — base de données</a>
            <a href="https://vercel.com/nextoping/nexto" target="_blank" rel="noopener noreferrer" className="block underline">Vercel — déploiements</a>
          </div>
        </div>
      </div>
    </div>
  )
}
