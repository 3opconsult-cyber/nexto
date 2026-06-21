"use client"
import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function SignupForm() {
  const router = useRouter()
  const params = useSearchParams()
  const defaultRole = (params.get('role') as 'client' | 'pro') || 'client'
  const [role, setRole] = useState<'client' | 'pro'>(defaultRole)
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    email: '', password: '', firstName: '', lastName: '',
    phone: '', birthdate: '', address: '',
  })

  function update(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (step === 1) { setStep(2); return }
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { data, error: signupError } = await supabase.auth.signUp({
      email: form.email, password: form.password,
      options: {
        data: {
          first_name: form.firstName,
          last_name: form.lastName,
          phone: form.phone,
          birthdate: form.birthdate,
          role,
        }
      }
    })
    if (signupError) { setError(signupError.message); setLoading(false); return }
    if (role === 'pro') router.push('/pro/onboarding')
    else router.push('/map')
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--navy)' }}>
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        <Link href="/" className="font-fredoka text-4xl text-white mb-6">Nexto</Link>

        {/* Role switcher */}
        <div className="flex gap-2 p-1 rounded-full mb-6" style={{ background: 'rgba(255,255,255,0.1)' }}>
          {(['client', 'pro'] as const).map(r => (
            <button key={r} onClick={() => setRole(r)}
              className="px-5 py-2 rounded-full text-sm font-black transition-all"
              style={role === r
                ? { background: 'var(--accent)', color: 'white' }
                : { color: 'rgba(255,255,255,0.6)' }
              }
            >
              {r === 'client' ? '👤 Particulier' : '🔧 Professionnel'}
            </button>
          ))}
        </div>

        <div className="w-full max-w-sm bg-white rounded-3xl p-7 shadow-2xl">
          {/* Progress */}
          <div className="flex gap-2 mb-5">
            {[1, 2].map(s => (
              <div key={s} className="flex-1 h-1 rounded-full transition-all"
                style={{ background: s <= step ? 'var(--accent)' : '#E5E7EB' }} />
            ))}
          </div>
          <h2 className="font-fredoka text-2xl text-navy mb-1">
            {step === 1 ? 'Vos informations' : 'Finaliser'}
          </h2>
          <p className="text-xs text-gray-400 font-bold mb-5">Étape {step} sur 2</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {step === 1 ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-gray-500 mb-1.5">Prénom</label>
                    <input type="text" value={form.firstName} onChange={e => update('firstName', e.target.value)}
                      className="w-full px-3 py-3 border-2 border-gray-100 rounded-xl text-sm font-bold outline-none focus:border-accent"
                      placeholder="Sophie" required />
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-gray-500 mb-1.5">Nom</label>
                    <input type="text" value={form.lastName} onChange={e => update('lastName', e.target.value)}
                      className="w-full px-3 py-3 border-2 border-gray-100 rounded-xl text-sm font-bold outline-none focus:border-accent"
                      placeholder="Laurent" required />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-gray-500 mb-1.5">Date de naissance</label>
                  <input type="date" value={form.birthdate} onChange={e => update('birthdate', e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-100 rounded-2xl text-sm font-bold outline-none focus:border-accent"
                    required />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-gray-500 mb-1.5">Téléphone</label>
                  <input type="tel" value={form.phone} onChange={e => update('phone', e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-100 rounded-2xl text-sm font-bold outline-none focus:border-accent"
                    placeholder="+33 6 00 00 00 00" required />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-gray-500 mb-1.5">Adresse</label>
                  <input type="text" value={form.address} onChange={e => update('address', e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-100 rounded-2xl text-sm font-bold outline-none focus:border-accent"
                    placeholder="12 rue des Lilas, Grasse" />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-gray-500 mb-1.5">Email</label>
                  <input type="email" value={form.email} onChange={e => update('email', e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-100 rounded-2xl text-sm font-bold outline-none focus:border-accent"
                    placeholder="vous@email.com" required />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-gray-500 mb-1.5">Mot de passe</label>
                  <input type="password" value={form.password} onChange={e => update('password', e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-100 rounded-2xl text-sm font-bold outline-none focus:border-accent"
                    placeholder="8 caractères minimum" minLength={8} required />
                </div>
                <div className="flex items-start gap-3 p-3 rounded-xl" style={{ background: 'var(--accent-l)' }}>
                  <input type="checkbox" required className="mt-1 w-4 h-4 accent-accent" />
                  <label className="text-xs font-bold" style={{ color: 'var(--accent-d)' }}>
                    J'accepte les <Link href="/cgu" className="underline">Conditions Générales</Link> et la{' '}
                    <Link href="/privacy" className="underline">Politique de confidentialité</Link> de Nexto
                  </label>
                </div>
              </>
            )}
            {error && <p className="text-red-500 text-sm font-bold">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full py-4 rounded-full text-white font-fredoka text-lg disabled:opacity-60"
              style={{ background: 'var(--accent)' }}
            >
              {loading ? 'Création...' : step === 1 ? 'Continuer →' : 'Créer mon compte 🚀'}
            </button>
          </form>
          <p className="text-center text-sm text-gray-400 mt-4">
            Déjà un compte ?{' '}
            <Link href="/auth/login" className="text-accent font-black">Se connecter</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function SignupPage() {
  return <Suspense><SignupForm /></Suspense>
}
