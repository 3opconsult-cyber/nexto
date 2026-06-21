"use client"
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Email ou mot de passe incorrect')
      setLoading(false)
      return
    }
    // Redirect based on role
    const { data: profile } = await supabase.from('profiles').select('role').single()
    if (profile?.role === 'pro') router.push('/pro/dashboard')
    else if (profile?.role === 'admin') router.push('/admin')
    else router.push('/map')
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--navy)' }}>
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <Link href="/" className="font-fredoka text-4xl text-white mb-8">Nexto</Link>
        <div className="w-full max-w-sm bg-white rounded-3xl p-7 shadow-2xl">
          <h2 className="font-fredoka text-2xl text-navy mb-6">Connexion</h2>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-gray-500 mb-1.5">Email</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-100 rounded-2xl text-sm font-bold outline-none focus:border-accent transition-colors"
                placeholder="vous@email.com" required
              />
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-gray-500 mb-1.5">Mot de passe</label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-100 rounded-2xl text-sm font-bold outline-none focus:border-accent transition-colors"
                placeholder="••••••••" required
              />
            </div>
            {error && <p className="text-red-500 text-sm font-bold">{error}</p>}
            <button
              type="submit" disabled={loading}
              className="w-full py-4 rounded-full text-white font-fredoka text-lg transition-opacity disabled:opacity-60"
              style={{ background: 'var(--accent)' }}
            >
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>
          <p className="text-center text-sm text-gray-400 mt-4">
            Pas encore de compte ?{' '}
            <Link href="/auth/signup" className="text-accent font-black">S'inscrire</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
