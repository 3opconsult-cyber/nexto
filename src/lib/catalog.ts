// Catalogue des services EN DONNÉES (lots 26 et 27, décision Romain du 07/11/2026 « services
// extensibles ») : une ligne de la table `service_catalog` = un service, avec ses manières de tarifer,
// son éligibilité CESU / crédit d'impôt, les champs de l'annonce et les pièces demandées aux
// prestataires. Écriture par l'admin seul (public/admin.html > Catalogue des services).
//
// REPLI : tant que la table n'existe pas (migration 050 non appliquée), qu'elle est vide ou illisible,
// le catalogue est reconstruit depuis src/lib/trades.ts : l'app se comporte exactement comme avant.
// Le premier rendu utilise toujours le repli (pas de saut d'affichage) ; la version en base remplace
// ensuite le repli si elle est lisible.
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TRADES, TRADE_LIST, cesuEligible, applyCatalogToTrades } from '@/lib/trades'

/** Manières de tarifer connues de l'app (src/lib/servicePricing.ts). */
export type CatalogPricingMode = 'forfait' | 'horaire' | 'forfait_heures' | 'devis'
export const PRICING_MODES: CatalogPricingMode[] = ['forfait', 'horaire', 'forfait_heures', 'devis']

/** Champs de l'annonce (dépôt de demande, colonnes de `requests`). */
export type RequestField = 'surface_m2' | 'nombre_pieces' | 'hours_wanted' | 'linen_kg' | 'linen_types' | 'household_size'
export const REQUEST_FIELDS: RequestField[] = ['surface_m2', 'nombre_pieces', 'hours_wanted', 'linen_kg', 'linen_types', 'household_size']

/** Rubriques de « Mes pièces » (valeurs de l'enum doc_kind déjà en base : pas d'ALTER TYPE). */
export type DocRubrique = 'identite' | 'rcpro' | 'kbis' | 'diplome' | 'sap' | 'rib'
export const DOC_RUBRIQUES: DocRubrique[] = ['identite', 'rcpro', 'kbis', 'diplome', 'sap', 'rib']

/**
 * Pièce ou qualification demandée pour un service. Elle se range dans une rubrique existante de
 * « Mes pièces » (`kind`) sous un type propre (`type`, ex. « decennale » dans Assurances, « cap-aepe »
 * dans Diplômes) : le fichier est stocké `<uid>/<kind>--<type>-<horodatage>`, comme les autres pièces.
 */
export interface CatalogDoc { kind: DocRubrique; type: string; label: string; required: boolean }

export interface CatalogService {
  key: string
  label: string
  /** Clé de pictogramme (src/components/PingIcons.tsx, ex. « s_menage ») ; repli s_autre. */
  icon: string
  /** Domaine des qualifications (Nettoyage, Bâtiment, Garde d'enfants, Autre…). */
  domain: string
  pricing_modes: CatalogPricingMode[]
  /** Unité d'un futur prix unitaire (panier, fenêtre, m²) ; null = forfait ou à l'heure. */
  unit: string | null
  cesu_eligible: boolean
  request_fields: RequestField[]
  required_docs: CatalogDoc[]
  /** Proposé au choix (inscription pro, dépôt de demande, Mes tarifs). */
  active: boolean
  /** Masqué partout, y compris des puces de la carte (le libellé reste lu pour l'historique). */
  hidden: boolean
  sort_order: number
}

const HOME_FIELDS: RequestField[] = ['surface_m2', 'nombre_pieces', 'hours_wanted', 'household_size']
const LINEN_FIELDS: RequestField[] = ['linen_kg', 'linen_types', 'household_size']
const SELECTABLE_KEYS = TRADE_LIST.map(t => t.key)

/** Repli : la liste codée de src/lib/trades.ts, à l'identique (mêmes lignes que la migration 050). */
export const FALLBACK_CATALOG: CatalogService[] = Object.keys(TRADES).map((key, i) => ({
  key,
  label: TRADES[key],
  icon: `s_${key}`,
  domain: 'Nettoyage',
  pricing_modes: [...PRICING_MODES],
  unit: null,
  cesu_eligible: cesuEligible(key),
  request_fields: key === 'repassage' ? [...LINEN_FIELDS] : [...HOME_FIELDS],
  required_docs: [],
  active: SELECTABLE_KEYS.includes(key),
  hidden: false,
  sort_order: (i + 1) * 10,
}))

const TYPE_RX = /^[a-z][a-z-]{0,39}$/
function normalize(r: any): CatalogService | null {
  if (!r || typeof r.key !== 'string' || typeof r.label !== 'string' || !r.label.trim()) return null
  const modes = (Array.isArray(r.pricing_modes) ? r.pricing_modes : []).filter((m: any) => PRICING_MODES.includes(m))
  const fields = (Array.isArray(r.request_fields) ? r.request_fields : []).filter((f: any) => REQUEST_FIELDS.includes(f))
  const docs: CatalogDoc[] = (Array.isArray(r.required_docs) ? r.required_docs : [])
    .filter((d: any) => d && DOC_RUBRIQUES.includes(d.kind) && typeof d.type === 'string' && TYPE_RX.test(d.type) && typeof d.label === 'string' && d.label.trim())
    .map((d: any) => ({ kind: d.kind, type: d.type, label: String(d.label).trim(), required: d.required === true }))
  return {
    key: r.key,
    label: r.label.trim(),
    icon: typeof r.icon === 'string' && r.icon ? r.icon : 's_autre',
    domain: typeof r.domain === 'string' && r.domain ? r.domain : 'Autre',
    pricing_modes: modes.length ? modes : [...PRICING_MODES],
    unit: typeof r.unit === 'string' && r.unit.trim() ? r.unit.trim() : null,
    cesu_eligible: r.cesu_eligible === true,
    request_fields: fields,
    required_docs: docs,
    active: r.active === true,
    hidden: r.hidden === true,
    sort_order: Number.isFinite(r.sort_order) ? r.sort_order : 100,
  }
}

let cache: CatalogService[] | null = null
let fromDb = false
let inflight: Promise<CatalogService[]> | null = null

/** Charge le catalogue (une fois par session de page). Repli sur trades.ts si la table manque ou est vide. */
export function fetchCatalog(): Promise<CatalogService[]> {
  if (cache) return Promise.resolve(cache)
  if (inflight) return inflight
  inflight = (async () => {
    try {
      const { data, error } = await createClient().from('service_catalog')
        .select('key, label, icon, domain, pricing_modes, unit, cesu_eligible, request_fields, required_docs, active, hidden, sort_order')
        .order('sort_order').order('label')
      const rows = error ? [] : ((data ?? []).map(normalize).filter(Boolean) as CatalogService[])
      if (rows.length) {
        cache = rows; fromDb = true
        applyCatalogToTrades(rows)
      } else cache = FALLBACK_CATALOG
    } catch { cache = FALLBACK_CATALOG }
    inflight = null
    return cache!
  })()
  return inflight
}

export interface CatalogView {
  all: CatalogService[]
  /** Proposés au choix : inscription pro, dépôt de demande, Mes tarifs. */
  selectable: CatalogService[]
  /** Visibles sur la carte (puces et filtres) : tout sauf les masqués. */
  visible: CatalogService[]
  get: (key: string | null | undefined) => CatalogService | undefined
  /** true si la liste vient de la table service_catalog (false = repli trades.ts). */
  fromDb: boolean
}

export function catalogView(all: CatalogService[], db = fromDb): CatalogView {
  const byKey = new Map(all.map(s => [s.key, s]))
  return {
    all,
    selectable: all.filter(s => s.active && !s.hidden),
    visible: all.filter(s => !s.hidden),
    get: k => (k ? byKey.get(k) : undefined),
    fromDb: db,
  }
}

/** Catalogue pour un écran : repli au premier rendu, version en base dès qu'elle est lue. */
export function useCatalog(): CatalogView {
  const [list, setList] = useState<CatalogService[]>(cache ?? FALLBACK_CATALOG)
  useEffect(() => {
    let live = true
    fetchCatalog().then(l => { if (live && l !== list) setList(l) })
    return () => { live = false }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return catalogView(list, list !== FALLBACK_CATALOG && fromDb)
}

/** Pièces demandées par le catalogue pour un ensemble de services (sans doublon kind+type). */
export function docsForServices(view: CatalogView, keys: (string | null | undefined)[]): (CatalogDoc & { services: string[] })[] {
  const out: (CatalogDoc & { services: string[] })[] = []
  for (const k of keys) {
    const svc = view.get(k)
    if (!svc) continue
    for (const d of svc.required_docs) {
      const hit = out.find(x => x.kind === d.kind && x.type === d.type)
      if (hit) { if (!hit.services.includes(svc.label)) hit.services.push(svc.label); hit.required = hit.required || d.required }
      else out.push({ ...d, services: [svc.label] })
    }
  }
  return out
}
