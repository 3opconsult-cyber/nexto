"use client"
import { useParams, useRouter } from 'next/navigation'
import TutoPlayer from '@/components/TutoPlayer'
import { AIDE_RUBRIQUES } from '@/lib/aide'

// Une route par rubrique : le bouton retour du navigateur revient donc à la liste /aide.
export default function AideRubrique() {
  const { slug } = useParams<{ slug: string }>()
  const router = useRouter()
  const r = AIDE_RUBRIQUES.find(x => x.slug === slug)
  if (!r) return (
    <div style={{ padding: 40, textAlign: 'center', fontFamily: 'Inter, sans-serif' }}>
      <p style={{ color: '#4E6470' }}>Rubrique introuvable.</p>
      <button onClick={() => router.push('/aide')} style={{ border: 'none', background: 'none', color: '#0C8F7E', fontWeight: 700, cursor: 'pointer' }}>Retour aux rubriques</button>
    </div>
  )
  return <TutoPlayer title={r.title} src={r.src} onClose={() => router.push('/aide')} />
}
