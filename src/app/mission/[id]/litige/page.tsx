"use client"
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LitigePage() {
  const params = useParams()
  const router = useRouter()
  const [existing, setExisting] = useState<any>(null)
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [userId, setUserId] = useState('')

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setUserId(user.id)
      const { data } = await supabase.from('litiges').select('*').eq('mission_id', params.id).single()
      if (data) setExisting(data)
    }
    load()
  }, [params.id])

  async function submit() {
    if (!description.trim()) return
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase.from('litiges').insert({
      mission_id: params.id, opened_by: userId, description, status: 'open'
    }).select().single()
    // Bloque la libération du paiement
    await supabase.from('missions').update({ status: 'disputed' }).eq('id', params.id)
    if (data) setExisting(data)
    setLoading(false)
  }

  const STATUS_LABELS: Record<string,string> = {
    open: 'Ouvert', under_review: 'En cours d\'examen',
    resolved_client: 'Résolu en votre faveur', resolved_pro: 'Résolu', closed: 'Clôturé'
  }

  return (
    <div className="min-h-screen" style={{background:'var(--cream)'}}>
      <div className="px-5 pt-5 pb-3 flex items-center gap-3" style={{background:'var(--navy)'}}>
        <button onClick={()=>router.back()} className="text-white font-black">←</button>
        <div className="font-fredoka text-xl text-white">Signaler un litige</div>
      </div>

      <div className="p-5">
        {existing ? (
          <div className="bg-white rounded-3xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl" style={{background:'#FEE2E2'}}>⚖️</div>
              <div>
                <div className="font-fredoka text-lg text-navy">Litige enregistré</div>
                <span className="text-xs font-black px-2 py-0.5 rounded-full" style={{background:'#FFF7ED',color:'#C2410C'}}>{STATUS_LABELS[existing.status]}</span>
              </div>
            </div>
            <p className="text-sm font-bold text-gray-600 mb-4">{existing.description}</p>
            <div className="p-4 rounded-2xl" style={{background:'var(--cream)'}}>
              <div className="text-xs font-black uppercase tracking-wider text-gray-400 mb-2">Procédure</div>
              <div className="space-y-2">
                {[
                  {label:'Litige ouvert', done:true},
                  {label:'Paiement gelé (séquestre maintenu)', done:true},
                  {label:'Examen par l\'équipe Nexto', done:existing.status!=='open', current:existing.status==='open'},
                  {label:'Décision et résolution', done:['resolved_client','resolved_pro','closed'].includes(existing.status)},
                ].map(s=>(
                  <div key={s.label} className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs"
                      style={{background:s.done?'#22C55E':s.current?'var(--accent)':'#E5E7EB',color:'white'}}>
                      {s.done?'✓':s.current?'●':''}
                    </div>
                    <span className="text-sm font-bold" style={{color:s.done||s.current?'var(--navy)':'#9CA3AF'}}>{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4 p-3 rounded-xl text-xs font-bold" style={{background:'var(--accent-l)',color:'var(--accent-d)'}}>
              Votre paiement reste sous séquestre tant que le litige n'est pas résolu. Aucun virement au prestataire ne sera effectué.
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-3xl p-6">
            <div className="text-4xl mb-3">⚖️</div>
            <h2 className="font-fredoka text-xl text-navy mb-2">Un problème avec cette mission ?</h2>
            <p className="text-sm font-bold text-gray-400 mb-4">
              Décrivez le problème. Votre paiement reste protégé sous séquestre pendant tout l'examen.
            </p>
            <textarea value={description} onChange={e=>setDescription(e.target.value)} rows={5}
              className="w-full px-4 py-3 border-2 border-gray-100 rounded-2xl text-sm font-bold outline-none focus:border-accent resize-none mb-3"
              placeholder="Ex : Le travail n'a pas été terminé / La prestation ne correspond pas..." />
            <button onClick={submit} disabled={loading||!description.trim()}
              className="w-full py-4 rounded-full text-white font-fredoka text-lg disabled:opacity-50" style={{background:'#EF4444'}}>
              {loading?'Envoi...':'Ouvrir le litige'}
            </button>
            <div className="mt-3 p-3 rounded-xl text-xs font-bold text-gray-400" style={{background:'var(--cream)'}}>
              Nexto examine chaque litige sous 48h. Le paiement n'est libéré qu'après résolution.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
