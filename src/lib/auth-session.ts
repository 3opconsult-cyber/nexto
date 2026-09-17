/**
 * "Rester connecté" décoché sur /auth/login.
 *
 * Le SDK Supabase (@supabase/ssr en v0.3.0, utilisé ici) écrit toujours le
 * cookie de session avec une durée de vie fixe et très longue : le champ
 * `maxAge` qu'on pourrait passer en option est écrasé en interne par sa
 * valeur par défaut, quoi qu'on fasse (vérifié dans le code du paquet). Il
 * est donc impossible de demander au SDK un cookie "de session" (effacé à la
 * fermeture du navigateur) pour une seule connexion.
 *
 * On obtient le même résultat sans toucher au client Supabase partagé
 * (`lib/supabase/client.ts`), en s'appuyant sur la différence native entre
 * localStorage (survit à la fermeture de l'onglet) et sessionStorage (vidé
 * à la fermeture) : on marque la session comme "à oublier", avec un jeton
 * partagé entre les deux. Au prochain chargement de l'app (nouvel onglet ou
 * navigateur relancé), si le jeton en localStorage n'a pas de correspondant
 * en sessionStorage, on est dans un nouvel onglet qui a hérité du cookie de
 * session persistant malgré tout : on déconnecte alors explicitement.
 */

const OWNER_KEY = 'ping_forget_me_owner'
const TAB_KEY = 'ping_forget_me_tab'

/** Appelé juste après une connexion réussie, avec la valeur de la case "Rester connecté". */
export function rememberThisTabOnly(rememberMe: boolean) {
  try {
    if (rememberMe) {
      localStorage.removeItem(OWNER_KEY)
      return
    }
    const token = Math.random().toString(36).slice(2) + Date.now().toString(36)
    localStorage.setItem(OWNER_KEY, token)
    sessionStorage.setItem(TAB_KEY, token)
  } catch {
    // Stockage indisponible (navigation privée stricte, etc.) : tant pis,
    // la session restera persistante comme avant cette fonctionnalité.
  }
}

/**
 * Appelé une fois au chargement de l'app (DesktopShell). Si un onglet
 * précédent a coché "ne pas rester connecté" et que celui-ci n'est pas ce
 * même onglet, on ferme la session héritée.
 */
export function enforceForgottenSession(signOut: () => void) {
  try {
    const owner = localStorage.getItem(OWNER_KEY)
    if (!owner) return
    const mine = sessionStorage.getItem(TAB_KEY)
    if (mine === owner) return
    localStorage.removeItem(OWNER_KEY)
    signOut()
  } catch {
    // idem : si le stockage est indisponible, on n'a jamais pu poser le marqueur.
  }
}
