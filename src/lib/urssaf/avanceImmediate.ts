// Serveur uniquement (routes /api/avance-immediate) : ne jamais importer côté client, le secret Urssaf y transite.
// Connecteur API Tiers de prestation (Urssaf) — avance immédiate du crédit d'impôt.
//
// État : prêt au branchement, éteint tant que URSSAF_CLIENT_ID / URSSAF_CLIENT_SECRET ne sont pas
// définis (fournis par l'Urssaf après l'habilitation via api.gouv.fr / DataPass).
// Les noms de champs suivent la documentation publique connue ; ils sont à recontrôler sur le
// Swagger officiel remis à l'habilitation, et à tester d'abord sur le bac à sable (URSSAF_API_BASE).

const API_BASE = process.env.URSSAF_API_BASE || 'https://api.urssaf.fr'
const TOKEN_URL = process.env.URSSAF_TOKEN_URL || `${API_BASE}/api/oauth/v1/token`
const TP = `${API_BASE}/atp/v1/tiersPrestations`

export function isConfigured() {
  return !!process.env.URSSAF_CLIENT_ID && !!process.env.URSSAF_CLIENT_SECRET
}

let cached: { token: string; exp: number } | null = null

async function token(): Promise<string> {
  if (cached && cached.exp > Date.now() + 30_000) return cached.token
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: process.env.URSSAF_CLIENT_ID!,
    client_secret: process.env.URSSAF_CLIENT_SECRET!,
    scope: process.env.URSSAF_SCOPE || 'homeplus.tiersprestations',
  })
  const res = await fetch(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body })
  if (!res.ok) throw new UrssafError(`Authentification Urssaf refusée (${res.status})`, res.status)
  const json = await res.json() as { access_token: string; expires_in?: number }
  cached = { token: json.access_token, exp: Date.now() + (json.expires_in ?? 3600) * 1000 }
  return cached.token
}

export class UrssafError extends Error {
  constructor(message: string, public status = 500, public details?: unknown) { super(message) }
}

async function call<T>(path: string, payload: unknown): Promise<T> {
  const res = await fetch(`${TP}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  })
  const text = await res.text()
  const data = text ? JSON.parse(text) : null
  if (!res.ok) throw new UrssafError(`Urssaf a refusé la requête (${res.status})`, res.status, data)
  return data as T
}

// ---------- inscription d'un particulier ----------
export type Particulier = {
  civilite: '1' | '2'               // 1 = homme, 2 = femme
  nomNaissance: string
  nomUsage?: string
  prenoms: string
  dateNaissance: string             // AAAA-MM-JJ
  lieuNaissance: { codePaysNaissance: string; departementNaissance?: string; communeNaissance?: { codeCommune: string; libelleCommune: string } }
  numeroTelephonePortable: string
  adresseMail: string
  adressePostale: { numeroVoie?: string; libelleVoie: string; complement?: string; codeCommune: string; libelleCommune: string; codePostal: string; codePays: string }
  coordonneeBancaire: { bic: string; iban: string; titulaire: string }
}

export async function inscrireParticulier(p: Particulier): Promise<{ idClient: string }> {
  return call('/particulier', { ...p, dateNaissance: `${p.dateNaissance}T00:00:00.000Z` })
}

// ---------- demande de paiement (une mission terminée) ----------
// Code nature de la prestation, à confirmer sur la nomenclature officielle remise à l'habilitation.
export const CODE_NATURE: Record<string, string> = {
  menage: 'ENT', repassage: 'ENT', nettoyage: 'ENT', vitres: 'ENT',
}

export type DemandeInput = {
  idClient: string
  dateNaissanceClient: string        // AAAA-MM-JJ
  numFactureTiers: string
  dateFacture: string                // AAAA-MM-JJ
  dateDebutEmploi: string
  dateFinEmploi: string              // même mois calendaire que le début
  category: string
  quantite: number                   // heures, ou 1 pour un forfait
  unite: 'HEURE' | 'FORFAIT'
  montantTtcCents: number
}

export async function transmettreDemande(d: DemandeInput): Promise<{ idDemandePaiement: string; statut?: string }> {
  const ttc = d.montantTtcCents / 100
  const out = await call<Array<{ idDemandePaiement: string; statut?: { code?: string } | string }>>('/demandePaiement', [{
    idClient: d.idClient,
    dateNaissanceClient: `${d.dateNaissanceClient}T00:00:00.000Z`,
    numFactureTiers: d.numFactureTiers,
    dateFacture: `${d.dateFacture}T00:00:00.000Z`,
    dateDebutEmploi: `${d.dateDebutEmploi}T00:00:00.000Z`,
    dateFinEmploi: `${d.dateFinEmploi}T00:00:00.000Z`,
    inputPrestations: [{
      codeNature: CODE_NATURE[d.category] ?? 'ENT',
      quantite: d.quantite,
      unite: d.unite,
      mntUnitaireTTC: Math.round((ttc / d.quantite) * 100) / 100,
      mntPrestationTTC: ttc,
    }],
    totalPrestationTTC: ttc,
  }])
  const first = out?.[0]
  if (!first?.idDemandePaiement) throw new UrssafError('Réponse Urssaf inattendue', 502, out)
  return { idDemandePaiement: first.idDemandePaiement, statut: typeof first.statut === 'string' ? first.statut : first.statut?.code }
}

// ---------- suivi ----------
export async function rechercherDemandes(ids: string[]) {
  return call<unknown>('/demandePaiement/rechercher', { idDemandePaiements: ids })
}
