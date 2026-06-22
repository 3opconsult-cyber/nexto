"use client"
import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ServiceType, SERVICE_LABELS } from '@/types'

function MissionForm() {
  const router = useRouter()
  const params = useSearchParams()
  const proId = params.get('pro')
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    service: '' as ServiceType,
    description: '',
    address: '',
    floor: '',
    access_code: '',
    urgency: 'normal',
    scheduled_at: '',
  })
  function upd(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  async function submit() {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }

    const { data: mission, error } = await supabase.from('missions').insert({
      client_id: user.id,
      pro_id: proId,
      service: form.service,
      description: form.description,
      address: form.address,
      floor: form.floor || null,
      access_code: form.access_code || null,
      urgency: form.urgency,
      scheduled_at: form.scheduled_at || null,
      status: 'pending',
    }).select().single()

    if (error) { setLoading(false); return }
    router.push(`/mission/${mission.id}/chat`)
  }

  const services = Object.entries(SERVICE_LABELS) as [ServiceType, { label: string; emoji: string }][]

  return (
    <div className="min-h-screen" style={{ background: 'var(--navy)' }}>
      <div className="px-5 pt-6 pb-4">
        <button onClick={() => router.back()} className="text-white mb-3 text-sm font-black">← Retour</button>
        <h1 className="font-fredoka text-2xl text-white">Demande de devis</h1>
        <p className="text-sm font-bold mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Décrivez votre besoin. Le pro vous répond rapidement.
        </p>
      </div>

      <div className="bg-white rounded-t-3xl px-5 py-6 min-h-screen space-y-4">
        {!form.service && (
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-gray-500 mb-2">Type de service</label>
            <div className="grid grid-cols-2 gap-2">
              {services.map(([key, { label, emoji }]) => (
                <button key={key} onClick={() => upd('service', key)}
                  className="p-3 rounded-2xl border-2 border-gray-100 text-center hover:border-accent transition-all">
                  <div className="text-xl mb-1">{emoji}</div>
                  <div className="text-xs font-black text-navy">{label}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {form.service && (
          <>
            <div className="flex items-center justify-between p-3 rounded-2xl" style={{ background: 'var(--accent-l)' }}>
              <span className="font-black text-sm" style={{ color: 'var(--accent-d)' }}>
                {SERVICE_LABELS[form.service].emoji} {SERVICE_LABELS[form.service].label}
              </span>
              <button onClick={() => upd('service', '')} className="text-xs font-black" style={{ color: 'var(--accent-d)' }}>Changer</button>
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-gray-500 mb-1.5">Description du besoin</label>
              <textarea value={form.description} onChange={e => upd('description', e.target.value)} rows={4}
                className="w-full px-4 py-3 border-2 border-gray-100 rounded-2xl text-sm font-bold outline-none focus:border-accent resize-none"
                placeholder="Ex : Fuite sous l'évier de la cuisine, eau qui goutte en continu." />
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-gray-500 mb-1.5">Adresse d'intervention</label>
              <input value={form.address} onChange={e => upd('address', e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-100 rounded-2xl text-sm font-bold outline-none focus:border-accent"
                placeholder="12 rue des Lilas, 06130 Grasse" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-gray-500 mb-1.5">Étage</label>
                <input value={form.floor} onChange={e => upd('floor', e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-100 rounded-2xl text-sm font-bold outline-none focus:border-accent"
                  placeholder="3e" />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-gray-500 mb-1.5">Code / Interphone</label>
                <input value={form.access_code} onChange={e => upd('access_code', e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-100 rounded-2xl text-sm font-bold outline-none focus:border-accent"
                  placeholder="A1234" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-gray-500 mb-2">Urgence</label>
              <div className="flex gap-2">
                {[['immediate', '🚨 Urgent'], ['today', "📅 Aujourd'hui"], ['normal', '🗓️ Flexible']].map(([k, label]) => (
                  <button key={k} onClick={() => upd('urgency', k)}
                    className="flex-1 py-3 rounded-2xl border-2 text-xs font-black transition-all"
                    style={form.urgency === k
                      ? { borderColor: 'var(--accent)', background: 'var(--accent-l)', color: 'var(--accent-d)' }
                      : { borderColor: '#F0EDE8', color: 'var(--navy)' }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <button onClick={submit} disabled={loading || !form.description || !form.address}
              className="w-full py-4 rounded-full text-white font-fredoka text-lg disabled:opacity-50 mt-2"
              style={{ background: 'var(--accent)' }}>
              {loading ? 'Envoi...' : 'Envoyer la demande →'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default function NewMissionPage() {
  return <Suspense><MissionForm /></Suspense>
}
