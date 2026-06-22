"use client"
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AdminDashboard() {
  const router = useRouter()
  const [stats, setStats] = useState<any>(null)
  const [missions, setMissions] = useState<any[]>([])
  const [pros, setPros] = useState<any[]>([])
  const [tab, setTab] = useState<'overview'|'missions'|'pros'|'litiges'>('overview')

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const { data: s } = await supabase.rpc('admin_stats')
      const { data: m } = await supabase.rpc('admin_missions_by_pro')
      const { data: p } = await supabase.from('pro_profiles').select('*, profiles(first_name,last_name)').order('created_at',{ascending:false})
      setStats(s); setMissions(m ?? []); setPros(p ?? [])
    }
    load()
  }, [])

  return (
    <div className="min-h-screen" style={{background:'var(--navy)'}}>
      <div className="px-5 pt-8 pb-4">
        <div className="text-xs font-black uppercase tracking-wider mb-1" style={{color:'rgba(255,255,255,0.4)'}}>Administration</div>
        <div className="font-fredoka text-2xl text-white">Nexto Admin</div>
      </div>

      <div className="px-4 flex gap-1 overflow-x-auto scrollbar-none">
        {([['overview','Vue d\'ensemble'],['missions','Missions'],['pros','Pros'],['litiges','Litiges']] as const).map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)}
            className="px-4 py-2.5 rounded-t-xl text-xs font-black whitespace-nowrap transition-all"
            style={tab===k?{background:'white',color:'var(--navy)'}:{color:'rgba(255,255,255,0.5)'}}>{l}</button>
        ))}
      </div>

      <div className="bg-white rounded-t-2xl min-h-screen px-5 py-5">
        {tab==='overview' && stats && (
          <div className="grid grid-cols-2 gap-3">
            {[
              {label:'Volume total',value:`${Number(stats.total_volume).toFixed(0)} €`,c:'var(--accent)'},
              {label:'Commissions Nexto',value:`${Number(stats.total_commission).toFixed(0)} €`,c:'#22C55E'},
              {label:'Pros actifs',value:stats.active_pros,c:'var(--navy)'},
              {label:'Pros en attente',value:stats.pending_pros,c:'#FB923C'},
              {label:'Clients',value:stats.total_clients,c:'var(--navy)'},
              {label:'Missions',value:stats.total_missions,c:'var(--navy)'},
              {label:'Terminées',value:stats.completed_missions,c:'#22C55E'},
              {label:'Litiges ouverts',value:stats.open_litiges,c:'#EF4444'},
            ].map(k=>(
              <div key={k.label} className="p-4 rounded-2xl border-2 border-gray-100">
                <div className="font-fredoka text-2xl" style={{color:k.c}}>{k.value}</div>
                <div className="text-xs font-black text-gray-400 mt-1 uppercase tracking-wider">{k.label}</div>
              </div>
            ))}
          </div>
        )}

        {tab==='missions' && (
          <div className="space-y-2">
            {missions.length===0 && <div className="text-center py-12 text-gray-300 font-bold">Aucune mission</div>}
            {missions.map((m,i)=>(
              <div key={i} className="p-4 rounded-2xl border-2 border-gray-100">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-black text-sm text-navy">{m.mission_ref}</span>
                  <span className="text-xs font-black px-2 py-0.5 rounded-full" style={{background:'var(--accent-l)',color:'var(--accent-d)'}}>{m.status}</span>
                </div>
                <div className="text-xs font-bold text-gray-500">{m.pro_name} → {m.client_name}</div>
                <div className="flex justify-between mt-2 text-xs font-bold">
                  <span className="text-gray-400">{m.amount_ttc?`${m.amount_ttc} €`:'—'}</span>
                  <span style={{color:'var(--accent)'}}>Comm: {m.commission?`${m.commission} €`:'—'}</span>
                  {m.has_litige && <span style={{color:'#EF4444'}}>⚠️ Litige</span>}
                  <span style={{color:m.escrow_released?'#22C55E':'#FB923C'}}>{m.escrow_released?'✓ Réglé':'⏳ Séquestre'}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab==='pros' && (
          <div className="space-y-2">
            {pros.map(p=>(
              <div key={p.id} className="p-4 rounded-2xl border-2 border-gray-100">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-black text-sm text-navy">{p.company_name}</span>
                  <span className="text-xs font-black px-2 py-0.5 rounded-full"
                    style={p.status==='active'?{background:'#DCFCE7',color:'#15803D'}:p.status==='pending'?{background:'#FFF7ED',color:'#C2410C'}:{background:'#FEE2E2',color:'#B91C1C'}}>{p.status}</span>
                </div>
                <div className="text-xs font-bold text-gray-500">{p.legal_form} · {p.siret||'SIRET manquant'}</div>
                <div className="flex justify-between mt-1 text-xs font-bold text-gray-400">
                  <span>⭐ {p.rating_avg} ({p.rating_count})</span>
                  <span>{p.mission_count} missions</span>
                  <button onClick={()=>router.push(`/admin/pro/${p.id}`)} style={{color:'var(--accent)'}}>Documents →</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab==='litiges' && (
          <div className="space-y-2">
            {missions.filter(m=>m.has_litige).length===0 ? (
              <div className="text-center py-12 text-gray-300"><div className="text-3xl mb-2">✅</div><div className="font-bold text-sm text-gray-400">Aucun litige en cours</div></div>
            ) : missions.filter(m=>m.has_litige).map((m,i)=>(
              <div key={i} className="p-4 rounded-2xl border-2" style={{borderColor:'#FEE2E2'}}>
                <div className="font-black text-sm text-navy">{m.mission_ref}</div>
                <div className="text-xs font-bold text-gray-500">{m.pro_name} → {m.client_name}</div>
                <button className="mt-2 px-3 py-1.5 rounded-lg text-xs font-black text-white" style={{background:'#EF4444'}}>Examiner le litige</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
