"use client"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ProDashboard() {
  const router = useRouter()
  const [proName, setProName] = useState('...')
  const [pro, setPro] = useState<any>(null)
  const [missions, setMissions] = useState<any[]>([])
  const [invoices, setInvoices] = useState<any[]>([])
  const [available, setAvailable] = useState(true)
  const [qrCode, setQrCode] = useState('')
  const [tab, setTab] = useState<'overview'|'missions'|'factures'|'kit'>('overview')

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      const { data: profile } = await supabase.from('profiles').select('first_name').eq('id', user.id).single()
      const { data: pp } = await supabase.from('pro_profiles').select('*').eq('user_id', user.id).single()
      if (profile) setProName(profile.first_name)
      if (pp) {
        setPro(pp); setAvailable(pp.is_available)
        const { data: ms } = await supabase.from('missions').select('*').eq('pro_id', pp.id).order('created_at', { ascending: false })
        const { data: inv } = await supabase.from('invoices').select('*').eq('pro_id', pp.id).order('created_at', { ascending: false })
        const { data: qr } = await supabase.from('pro_qr_codes').select('code').eq('pro_id', pp.id).single()
        setMissions(ms ?? []); setInvoices(inv ?? [])
        if (qr) setQrCode(qr.code)
      }
    }
    load()
  }, [router])

  async function toggleAvailable() {
    const supabase = createClient()
    const newVal = !available
    setAvailable(newVal)
    if (pro) await supabase.from('pro_profiles').update({ is_available: newVal }).eq('id', pro.id)
  }

  // KPIs calculés
  const caMois = invoices.filter(i => {
    const d = new Date(i.issued_at); const now = new Date()
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).reduce((s, i) => s + (parseFloat(i.net_pro) || 0), 0)
  const totalComm = invoices.reduce((s, i) => s + (parseFloat(i.nexto_commission) || 0), 0)
  const status = pro?.status ?? 'pending'

  return (
    <div className="min-h-screen" style={{ background: 'var(--navy)' }}>
      {/* Header */}
      <div className="px-5 pt-8 pb-4 flex justify-between items-center">
        <div>
          <div className="text-xs font-black uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Espace Pro 👋</div>
          <div className="font-fredoka text-2xl text-white">{proName}</div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggleAvailable}
            className="px-3 py-2 rounded-full text-xs font-black transition-all"
            style={available ? { background: '#22C55E', color: 'white' } : { background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.6)' }}>
            {available ? '● Disponible' : '○ Indispo'}
          </button>
        </div>
      </div>

      {status === 'pending' && (
        <div className="mx-4 mb-3 p-3 rounded-2xl" style={{ background: '#FFF7ED', border: '2px solid #FB923C' }}>
          <div className="font-black text-xs" style={{ color: '#C2410C' }}>⏳ Profil en vérification (24-48h)</div>
        </div>
      )}

      {/* Tabs */}
      <div className="px-4 flex gap-1 mb-1">
        {([['overview','Résumé'],['missions','Missions'],['factures','Factures'],['kit','Kit Com']] as const).map(([k,label]) => (
          <button key={k} onClick={() => setTab(k)}
            className="flex-1 py-2.5 rounded-t-xl text-xs font-black transition-all"
            style={tab === k ? { background: 'white', color: 'var(--navy)' } : { color: 'rgba(255,255,255,0.5)' }}>
            {label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-t-2xl min-h-screen px-5 py-5">
        {tab === 'overview' && (
          <>
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="p-4 rounded-2xl" style={{ background: 'var(--accent-l)' }}>
                <div className="font-fredoka text-2xl" style={{ color: 'var(--accent-d)' }}>{caMois.toFixed(0)} €</div>
                <div className="text-xs font-black text-gray-500 mt-1 uppercase tracking-wider">Revenus ce mois</div>
              </div>
              <div className="p-4 rounded-2xl border-2 border-gray-100">
                <div className="font-fredoka text-2xl text-navy">{pro?.mission_count ?? 0}</div>
                <div className="text-xs font-black text-gray-400 mt-1 uppercase tracking-wider">Missions</div>
              </div>
              <div className="p-4 rounded-2xl border-2 border-gray-100">
                <div className="font-fredoka text-2xl" style={{ color: '#F59E0B' }}>⭐ {pro?.rating_avg?.toFixed(1) ?? '—'}</div>
                <div className="text-xs font-black text-gray-400 mt-1 uppercase tracking-wider">{pro?.rating_count ?? 0} avis</div>
              </div>
              <div className="p-4 rounded-2xl border-2 border-gray-100">
                <div className="font-fredoka text-2xl text-navy">{totalComm.toFixed(0)} €</div>
                <div className="text-xs font-black text-gray-400 mt-1 uppercase tracking-wider">Commissions Nexto</div>
              </div>
            </div>

            {/* Bloc paiement Stripe - souscription */}
            {!pro?.stripe_account_id && (
              <div className="p-4 rounded-2xl mb-4" style={{ background: 'linear-gradient(135deg, #635BFF 0%, #7C5CFC 100%)' }}>
                <div className="font-fredoka text-lg text-white mb-1">💳 Activez les paiements</div>
                <div className="text-xs font-bold text-white/80 mb-3">
                  Connectez votre compte pour recevoir vos virements automatiquement après chaque mission validée.
                </div>
                <a href="https://dashboard.stripe.com/register" target="_blank" rel="noopener noreferrer"
                  className="block w-full py-3 rounded-full text-center font-fredoka text-sm"
                  style={{ background: 'white', color: '#635BFF' }}>
                  Connecter mon compte bancaire →
                </a>
              </div>
            )}

            {/* Formule premium */}
            <div className="p-4 rounded-2xl mb-4 border-2" style={{ borderColor: 'var(--accent)' }}>
              <div className="flex items-center justify-between mb-2">
                <div className="font-fredoka text-lg text-navy">⭐ Nexto Pro+</div>
                <span className="text-xs font-black px-2 py-1 rounded-full" style={{ background: 'var(--accent-l)', color: 'var(--accent-d)' }}>Premium</span>
              </div>
              <div className="text-xs font-bold text-gray-500 mb-3">
                Placement prioritaire sur la carte · Photos & vidéos illimitées · Système de remises · Badge mis en avant.
              </div>
              <button className="w-full py-3 rounded-full text-white font-fredoka text-sm" style={{ background: 'var(--accent)' }}>
                Passer Premium — 19€/mois
              </button>
            </div>
          </>
        )}

        {tab === 'missions' && (
          <div className="space-y-2">
            {missions.length === 0 ? (
              <div className="text-center py-12 text-gray-300">
                <div className="text-3xl mb-2">📭</div>
                <div className="font-bold text-sm text-gray-400">Aucune mission pour l'instant</div>
              </div>
            ) : missions.map(m => (
              <button key={m.id} onClick={() => router.push(`/mission/${m.id}/chat`)}
                className="w-full text-left p-4 rounded-2xl border-2 border-gray-100 hover:border-accent transition-all">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-black text-sm text-navy">{m.ref}</span>
                  <span className="text-xs font-black px-2 py-0.5 rounded-full" style={{ background: 'var(--accent-l)', color: 'var(--accent-d)' }}>{m.status}</span>
                </div>
                <div className="text-xs font-bold text-gray-400">{m.description?.slice(0,50)}</div>
                {m.amount_ttc && <div className="text-sm font-black mt-1" style={{ color: 'var(--accent)' }}>{m.amount_ttc} € TTC</div>}
              </button>
            ))}
          </div>
        )}

        {tab === 'factures' && (
          <div className="space-y-2">
            {invoices.length === 0 ? (
              <div className="text-center py-12 text-gray-300">
                <div className="text-3xl mb-2">🧾</div>
                <div className="font-bold text-sm text-gray-400">Aucune facture émise</div>
                <div className="text-xs text-gray-400 font-bold mt-1">Les factures sont générées après chaque mission payée et purgée de litige.</div>
              </div>
            ) : invoices.map(i => (
              <div key={i.id} className="p-4 rounded-2xl border-2 border-gray-100">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-black text-sm text-navy">{i.ref}</span>
                  <span className="text-sm font-black" style={{ color: 'var(--accent)' }}>{i.total_ttc} €</span>
                </div>
                <div className="flex justify-between text-xs font-bold text-gray-400">
                  <span>Net : {i.net_pro} €</span>
                  <span>Commission : {i.nexto_commission} €</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'kit' && (
          <div>
            <div className="text-center p-6 rounded-2xl mb-4" style={{ background: 'var(--cream)' }}>
              <div className="font-fredoka text-lg text-navy mb-3">Votre QR code Nexto</div>
              <div className="w-40 h-40 mx-auto rounded-2xl flex items-center justify-center mb-3" style={{ background: 'white', border: '2px solid var(--accent-l)' }}>
                <div className="text-center">
                  <div className="text-5xl mb-1">▦</div>
                  <div className="font-mono font-black text-sm" style={{ color: 'var(--accent)' }}>{qrCode || '...'}</div>
                </div>
              </div>
              <div className="text-xs font-bold text-gray-500">
                Collez ce QR sur votre véhicule, vos factures, votre vitrine. Vos clients le scannent et vous gardent en favori.
              </div>
            </div>
            <div className="space-y-2">
              <button className="w-full py-3 rounded-2xl font-black text-sm text-white" style={{ background: 'var(--accent)' }}>
                📥 Télécharger le QR (PNG)
              </button>
              <button className="w-full py-3 rounded-2xl font-black text-sm" style={{ background: 'var(--cream)', color: 'var(--navy)' }}>
                🖨️ Kit autocollant véhicule
              </button>
            </div>
            <div className="mt-4 p-4 rounded-2xl" style={{ background: 'var(--accent-l)' }}>
              <div className="font-black text-sm mb-2" style={{ color: 'var(--accent-d)' }}>📊 Votre fichier client</div>
              <div className="text-xs font-bold" style={{ color: 'var(--accent-d)' }}>
                Chaque scan ajoute le client à votre CRM. Nexto peut envoyer vos promos et relances directement.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Nav bas */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-6 py-3 flex justify-around">
        <button onClick={() => router.push('/pro/dashboard')} className="flex flex-col items-center gap-0.5">
          <span className="text-xl">📊</span><span className="text-xs font-black" style={{ color: 'var(--accent)' }}>Tableau</span>
        </button>
        <button onClick={() => router.push('/map')} className="flex flex-col items-center gap-0.5">
          <span className="text-xl opacity-40">🗺️</span><span className="text-xs font-black text-gray-400">Carte</span>
        </button>
        <button onClick={() => router.push('/pro/profil')} className="flex flex-col items-center gap-0.5">
          <span className="text-xl opacity-40">⚙️</span><span className="text-xs font-black text-gray-400">Profil</span>
        </button>
      </div>
    </div>
  )
}
