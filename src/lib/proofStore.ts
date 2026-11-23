// Conservation locale de la preuve d'arrivée (client absent) : photo + position + heure de prise de vue gardées SUR LE
// TÉLÉPHONE (IndexedDB) tant que l'envoi n'a pas réussi. Audit du 23/11/2026, correction 6.
// Règles : 1 entrée par mission, 3 entrées au plus, purge automatique après 24 h, purge dès l'envoi réussi, photo
// compressée. L'heure de prise de vue ne sert QU'À L'AFFICHAGE sur le téléphone : elle n'est jamais envoyée au serveur,
// qui garde sa propre heure comme référence (la facturation démarre à la validation serveur). Aucune donnée n'est lue
// ni envoyée tant que le prestataire n'a pas lui-même appuyé sur « Envoyer ».
// IndexedDB peut manquer ou refuser (navigation privée) : toutes les fonctions répondent alors null / false et
// l'écran fonctionne comme avant, avec la preuve en mémoire de la page seulement.

export const PROOF_TTL_MS = 24 * 3600 * 1000
export const PROOF_MAX = 3
export const PROOF_EVENT = 'ping:proof-queue'

export type StoredProof = {
  txId: string
  uid: string
  photo: Blob
  lat: number
  lng: number
  accuracyM: number
  approx: boolean
  /** Heure de prise de vue sur le téléphone (ms) : affichage seulement, jamais envoyée. */
  takenAt: number
  /** Enregistrée le (ms) : départ des 24 h. */
  savedAt: number
  /** Chemin de la photo déjà au stockage (évite un second téléversement au renvoi). */
  uploadedPath?: string
  /** Vrai quand le prestataire a appuyé sur « Envoyer » et que l'envoi a échoué faute de réseau : renvoi automatique. */
  queued?: boolean
}

const DB_NAME = 'ping_proofs'
const STORE = 'proofs'

function open(): Promise<IDBDatabase | null> {
  return new Promise(resolve => {
    try {
      if (typeof indexedDB === 'undefined') { resolve(null); return }
      const req = indexedDB.open(DB_NAME, 1)
      req.onupgradeneeded = () => { req.result.createObjectStore(STORE, { keyPath: 'txId' }) }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
      req.onblocked = () => resolve(null)
    } catch { resolve(null) }
  })
}

function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest | null): Promise<T | null> {
  return open().then(db => new Promise<T | null>(resolve => {
    if (!db) { resolve(null); return }
    try {
      const tx = db.transaction(STORE, mode)
      const r = fn(tx.objectStore(STORE))
      let out: unknown = null
      if (r) r.onsuccess = () => { out = r.result }
      tx.oncomplete = () => { db.close(); resolve(out as T | null) }
      tx.onerror = tx.onabort = () => { db.close(); resolve(null) }
    } catch { try { db.close() } catch { /* sans objet */ } resolve(null) }
  }))
}

function notify() {
  try { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(PROOF_EVENT)) } catch { /* sans objet */ }
}

export async function listProofs(): Promise<StoredProof[]> {
  const all = (await run<StoredProof[]>('readonly', s => s.getAll())) ?? []
  return all.sort((a, b) => a.savedAt - b.savedAt)
}

/** Supprime les entrées de plus de 24 h. Renvoie les entrées conservées. */
export async function purgeExpiredProofs(now = Date.now()): Promise<StoredProof[]> {
  const all = await listProofs()
  const keep: StoredProof[] = []
  for (const p of all) {
    if (now - p.savedAt > PROOF_TTL_MS) await run('readwrite', s => s.delete(p.txId))
    else keep.push(p)
  }
  if (keep.length !== all.length) notify()
  return keep
}

export async function getProof(txId: string): Promise<StoredProof | null> {
  const kept = await purgeExpiredProofs()
  return kept.find(p => p.txId === txId) ?? null
}

/** Enregistre (ou remplace) la preuve d'une mission ; au-delà de 3 missions, la plus ancienne est retirée. */
export async function saveProof(p: StoredProof): Promise<boolean> {
  const kept = await purgeExpiredProofs()
  const ok = await run('readwrite', s => s.put(p))
  // `put` répond avec la clé ; null = échec d'ouverture ou d'écriture (IndexedDB indisponible, quota).
  if (ok === null) return false
  const others = kept.filter(k => k.txId !== p.txId)
  const excess = others.length + 1 - PROOF_MAX
  if (excess > 0) for (const old of others.slice(0, excess)) await run('readwrite', s => s.delete(old.txId))
  notify()
  return true
}

export async function deleteProof(txId: string): Promise<void> {
  await run('readwrite', s => s.delete(txId))
  notify()
}

/**
 * Photo compressée avant conservation et envoi : côté long 1600 px au plus, JPEG qualité 0,8.
 * Repli : le fichier d'origine si le navigateur ne sait pas le redessiner.
 */
export async function compressPhoto(file: File | Blob): Promise<Blob> {
  try {
    const url = URL.createObjectURL(file)
    try {
      const img = await new Promise<HTMLImageElement>((res, rej) => {
        const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('image')); i.src = url
      })
      const k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight))
      const w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k))
      const c = document.createElement('canvas'); c.width = w; c.height = h
      const ctx = c.getContext('2d')
      if (!ctx) return file
      ctx.drawImage(img, 0, 0, w, h)
      const blob = await new Promise<Blob | null>(res => c.toBlob(res, 'image/jpeg', 0.8))
      // On garde la version compressée seulement si elle est plus légère.
      return blob && blob.size < file.size ? blob : file
    } finally { URL.revokeObjectURL(url) }
  } catch { return file }
}
