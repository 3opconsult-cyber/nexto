import Link from 'next/link'

export default function LandingPage() {
  return (
    <main className="min-h-screen flex flex-col" style={{ background: 'var(--navy)' }}>
      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
        {/* Logo */}
        <div className="mb-8">
          <div
            className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'var(--accent)' }}
          >
            <span className="text-4xl">📍</span>
          </div>
          <h1 className="font-fredoka text-5xl text-white mb-2">Nexto</h1>
          <p className="text-sm font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Services de proximité
          </p>
        </div>

        {/* Tagline */}
        <h2 className="font-fredoka text-3xl text-white leading-tight max-w-sm mb-4">
          Et si ce que vous cherchez se trouvait juste à côté ?
        </h2>
        <p className="text-base max-w-xs leading-relaxed mb-12" style={{ color: 'rgba(255,255,255,0.6)' }}>
          Plombier, baby-sitter, ménage, jardinage, manutention — des pros vérifiés, autour de vous, disponibles maintenant.
        </p>

        {/* CTA */}
        <div className="w-full max-w-xs space-y-3">
          <Link
            href="/auth/signup?role=client"
            className="block w-full py-4 rounded-full text-white font-fredoka text-lg text-center"
            style={{ background: 'var(--accent)' }}
          >
            Je cherche un service
          </Link>
          <Link
            href="/auth/signup?role=pro"
            className="block w-full py-4 rounded-full font-fredoka text-lg text-center"
            style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: '1.5px solid rgba(255,255,255,0.2)' }}
          >
            Je suis un professionnel
          </Link>
        </div>

        {/* Already have account */}
        <p className="mt-6 text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
          Déjà un compte ?{' '}
          <Link href="/auth/login" className="underline" style={{ color: 'rgba(255,255,255,0.7)' }}>
            Se connecter
          </Link>
        </p>
      </div>

      {/* Trust badges */}
      <div className="px-6 pb-12">
        <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto">
          {[
            { icon: '🔒', label: 'Paiement sécurisé' },
            { icon: '✓', label: 'Pros vérifiés' },
            { icon: '⭐', label: 'Avis garantis' },
          ].map((b) => (
            <div
              key={b.label}
              className="flex flex-col items-center p-3 rounded-2xl text-center"
              style={{ background: 'rgba(255,255,255,0.06)' }}
            >
              <span className="text-2xl mb-1">{b.icon}</span>
              <span className="text-xs font-bold leading-tight" style={{ color: 'rgba(255,255,255,0.6)' }}>
                {b.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
