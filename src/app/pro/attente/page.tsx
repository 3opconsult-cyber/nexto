import Link from 'next/link'

export default function ProAttente() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
      style={{ background: 'var(--navy)' }}>
      <div className="text-6xl mb-6">⏳</div>
      <h1 className="font-fredoka text-3xl text-white mb-3">Dossier soumis !</h1>
      <p className="text-sm font-bold max-w-xs leading-relaxed mb-8"
        style={{ color: 'rgba(255,255,255,0.6)' }}>
        Notre équipe vérifie vos documents et activera votre profil sous <strong className="text-white">24-48h</strong>.
        Vous recevrez une notification dès la validation.
      </p>
      <div className="w-full max-w-xs space-y-3">
        <div className="p-4 rounded-2xl text-left" style={{ background: 'rgba(255,255,255,0.08)' }}>
          <div className="text-xs font-black uppercase tracking-wider mb-3"
            style={{ color: 'rgba(255,255,255,0.4)' }}>Statut du dossier</div>
          <div className="space-y-2">
            {[
              { label: 'Profil créé', done: true },
              { label: 'Documents reçus', done: true },
              { label: 'Vérification en cours', done: false, current: true },
              { label: 'Profil activé', done: false },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0"
                  style={{
                    background: item.done ? '#22C55E' : item.current ? 'var(--accent)' : 'rgba(255,255,255,0.1)',
                    color: 'white'
                  }}>
                  {item.done ? '✓' : item.current ? '●' : ''}
                </div>
                <span className="text-sm font-bold"
                  style={{ color: item.done || item.current ? 'white' : 'rgba(255,255,255,0.4)' }}>
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>
        <Link href="/pro/dashboard"
          className="block w-full py-4 rounded-full text-white font-fredoka text-lg text-center"
          style={{ background: 'rgba(255,255,255,0.1)', border: '1.5px solid rgba(255,255,255,0.2)' }}>
          Accéder au dashboard →
        </Link>
      </div>
    </div>
  )
}
