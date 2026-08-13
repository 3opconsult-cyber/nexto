// Auto-remplissage des informations légales via l'API publique gratuite
// "Recherche d'entreprises" (DINUM / data.gouv.fr), sans clé requise.
// Doc : https://recherche-entreprises.api.gouv.fr/docs/
// Fonctionne par nom de raison sociale OU par numéro SIREN/SIRET dans le
// même paramètre `q`. Défensif : si un champ manque ou si l'API est
// indisponible, on renvoie une liste vide plutôt que de bloquer l'inscription
// — le prestataire peut toujours saisir ses informations à la main.

export interface CompanyMatch {
  siren: string
  siret: string
  name: string
  address: string
  postalCode: string
  city: string
  lat: number | null
  lng: number | null
  natureJuridique: string | null
}

export async function searchCompany(query: string): Promise<CompanyMatch[]> {
  const q = query.trim()
  if (q.length < 2) return []
  try {
    const res = await fetch(`https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(q)}&per_page=5`)
    if (!res.ok) return []
    const data = await res.json()
    const results = Array.isArray(data?.results) ? data.results : []
    return results.map((r: any) => {
      const siege = r.siege || {}
      const addressParts = [siege.adresse, siege.code_postal, siege.libelle_commune].filter(Boolean)
      return {
        siren: r.siren || '',
        siret: siege.siret || '',
        name: r.nom_complet || r.nom_raison_sociale || r.sigle || q,
        address: siege.adresse || addressParts.join(' ') || '',
        postalCode: siege.code_postal || '',
        city: siege.libelle_commune || '',
        lat: typeof siege.latitude === 'number' ? siege.latitude : (siege.latitude ? Number(siege.latitude) : null),
        lng: typeof siege.longitude === 'number' ? siege.longitude : (siege.longitude ? Number(siege.longitude) : null),
        natureJuridique: r.nature_juridique || null,
      } as CompanyMatch
    }).filter((c: CompanyMatch) => c.name)
  } catch {
    return []
  }
}

// Mappe le code "nature juridique" INSEE (quand disponible) vers nos
// formes juridiques internes. Best-effort : sert juste a pre-cocher une
// valeur plausible, le prestataire peut la corriger plus tard.
export function guessLegalStatus(natureJuridique: string | null): 'auto_entrepreneur' | 'eurl' | 'sasu' | 'sarl' | 'eirl' | 'association' {
  if (!natureJuridique) return 'auto_entrepreneur'
  if (natureJuridique.startsWith('92')) return 'association'
  if (natureJuridique === '5710') return 'sasu'
  if (natureJuridique === '5498' || natureJuridique === '5499') return 'eurl'
  if (natureJuridique.startsWith('54')) return 'sarl'
  return 'auto_entrepreneur'
}
