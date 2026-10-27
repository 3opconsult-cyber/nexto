"use client"
import Link from 'next/link'

// Pictogrammes SVG, pas d'emoji (règle du design system) — même logique
// d'icônes que NavDrawer, simplifiée pour cet index de dev.
const ICONS: Record<string, JSX.Element> = {
  wow: <><path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8" /></>,
  play: <path d="M8 5v14l11-7z" />,
  map: <><path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" /><path d="M9 4v14M15 6v14" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  doc: <><path d="M6 2h9l3 3v17H6z" /><path d="M9 9h6M9 13h6M9 17h4" /></>,
  grid: <><path d="M4 4h7v7H4zM13 4h7v7h-7zM13 13h7v7h-7zM4 13h7v7H4z" /></>,
  list: <><path d="M4 6h16M4 12h16M4 18h10" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></>,
  key: <><circle cx="8" cy="15" r="4" /><path d="M10.85 12.15 19 4m-3 3 2 2m-6 2 2 2" /></>,
  edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></>,
  link: <><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" /><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" /></>,
}

export default function Hub() {
  const sections = [
    {
      title: 'Présentation',
      desc: 'Le pitch complet, vue client et pro',
      items: [
        {icon:'wow',label:'Animation présentation',href:'/presentation',tag:'Wow'},
        {icon:'play',label:'Démo interactive end-to-end',href:'/demo',tag:'Sans inscription'},
      ]
    },
    {
      title: 'Parcours Client',
      desc: 'Trouver et réserver un pro',
      items: [
        {icon:'map',label:'Carte géolocalisée',href:'/map'},
        {icon:'user',label:'Mon profil & historique',href:'/client/profil'},
        {icon:'doc',label:'Nouvelle demande',href:'/mission/new'},
      ]
    },
    {
      title: 'Parcours Pro',
      desc: 'Gérer son activité',
      items: [
        {icon:'grid',label:'Dashboard pro',href:'/pro/dashboard'},
        {icon:'list',label:'Inscription pro (7 étapes)',href:'/pro/onboarding'},
        {icon:'doc',label:'Documents',href:'/pro/onboarding/documents'},
      ]
    },
    {
      title: 'Administration',
      desc: 'Supervision plateforme',
      items: [
        {icon:'settings',label:'Admin dashboard',href:'/admin',tag:'Super-admin'},
      ]
    },
    {
      title: 'Comptes',
      desc: 'Connexion',
      items: [
        {icon:'key',label:'Connexion',href:'/auth/login'},
        {icon:'edit',label:'Inscription',href:'/auth/signup'},
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
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{background:'var(--accent-l)'}}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-d)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{ICONS[item.icon]}</svg>
                  </div>
                  <span className="flex-1 font-black text-sm text-navy">{item.label}</span>
                  {item.tag && <span className="text-xs font-black px-2 py-0.5 rounded-full" style={{background:'var(--accent-l)',color:'var(--accent-d)'}}>{item.tag}</span>}
                  <span className="text-gray-300">→</span>
                </Link>
              ))}
            </div>
          </div>
        ))}

        <div className="mt-4 p-4 rounded-2xl" style={{background:'var(--cream)'}}>
          <div className="font-black text-sm text-navy mb-1 flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" /><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" /></svg>
            Liens techniques
          </div>
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
