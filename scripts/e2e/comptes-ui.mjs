// Inscription, connexion « Mot de passe oublié » et réinitialisation : parcours réel dans un navigateur, SANS aucun
// e-mail envoyé ni compte créé : toutes les requêtes d'authentification vers Supabase sont interceptées et simulées.
//   BASE=http://localhost:3000 node scripts/e2e/comptes-ui.mjs      (défaut : la prod, toujours sans effet réel)
// Prérequis : playwright (npm i playwright ou ln -s $(npm root -g)/playwright node_modules/playwright).
import { chromium } from 'playwright'

const BASE = process.env.BASE || 'https://nexto-eta.vercel.app'
const REF = 'wmiawwaxwlvascyflpba'
let ok = 0, ko = 0
const check = (c, m) => { c ? ok++ : ko++; console.log((c ? 'OK    ' : 'ECHEC ') + m) }
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url')
const jwt = (exp) => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: '00000000-0000-0000-0000-000000000001', role: 'authenticated', aud: 'authenticated', exp, email: 'simule@ping-demo.invalid' })}.sig`
const json = (status, body) => ({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) })

const b = await chromium.launch()
async function page(opts = {}) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'en-US' })   // navigateur en anglais : les messages doivent rester en français
  const p = await ctx.newPage()
  const calls = []; const errs = []
  p.on('pageerror', e => errs.push(e.message.slice(0, 140)))
  // Rien ne part vers Supabase Auth : on répond nous-mêmes.
  await p.route(/supabase\.co\/auth\/v1\//, async route => {
    const req = route.request(); const url = req.url(); calls.push(`${req.method()} ${url.replace(/^.*\/auth\/v1/, '')}`)
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } })
    if (/\/signup/.test(url)) return route.fulfill(json(opts.signup?.status ?? 200, opts.signup?.body ?? { id: '00000000-0000-0000-0000-000000000009', email: 'simule@ping-demo.invalid', aud: 'authenticated', role: '' }))
    if (/\/recover/.test(url)) return route.fulfill(json(opts.recover?.status ?? 200, opts.recover?.body ?? {}))
    if (/\/user/.test(url) && req.method() === 'PUT') return route.fulfill(json(opts.update?.status ?? 200, opts.update?.body ?? { id: '00000000-0000-0000-0000-000000000001', email: 'simule@ping-demo.invalid', aud: 'authenticated', role: 'authenticated' }))
    if (/\/user/.test(url)) return route.fulfill(json(200, { id: '00000000-0000-0000-0000-000000000001', email: 'simule@ping-demo.invalid', aud: 'authenticated', role: 'authenticated' }))
    return route.fulfill(json(400, { error: 'simulé' }))
  })
  return { p, ctx, calls, errs }
}
const txt = async p => (await p.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
const alertText = async p => ((await p.locator('[role=alert]').allInnerTexts()).join(' ')).replace(/\s+/g, ' ')
const aucunReseau = (calls, re, m) => check(!calls.some(c => re.test(c)), m)

// ───────── Inscription ─────────
console.log('\n=== /auth/signup')
{
  const { p, ctx, calls, errs } = await page()
  await p.goto(BASE + '/auth/signup'); await p.waitForSelector('h1'); await p.evaluate(() => sessionStorage.clear())
  await p.reload(); await p.waitForSelector('h1')
  check(/Étape 1 sur 3/.test(await txt(p)), 'étape 1 sur 3 affichée')
  // Champs vides
  await p.getByRole('button', { name: /Continuer/ }).click(); await p.waitForTimeout(300)
  check(/Renseignez votre prénom, votre nom et votre téléphone/.test(await alertText(p)), 'champs vides : message en français')
  // Téléphone invalide
  const inputs = p.locator('form input')
  await p.locator('input[autocomplete=given-name]').fill('Test'); await p.locator('input[autocomplete=family-name]').fill('Simulé')
  await p.locator('input[type=tel]').fill('12345'); await p.getByRole('button', { name: /Continuer/ }).click(); await p.waitForTimeout(300)
  check(/numéro de téléphone n’est pas valide/.test(await alertText(p)), 'téléphone invalide : message en français avec exemple')
  await p.locator('input[type=tel]').fill('06 12 34 56 78'); await p.getByRole('button', { name: /Continuer/ }).click(); await p.waitForTimeout(500)
  check(/Étape 2 sur 3/.test(await txt(p)), 'téléphone valide : passage à l’étape 2 (adresse et date de naissance)')
  await p.getByRole('button', { name: /Continuer/ }).click(); await p.waitForTimeout(400)
  check(/Étape 3 sur 3/.test(await txt(p)), 'étape 2 facultative : passage à l’étape 3')
  // Retour
  await p.getByRole('button', { name: 'Étape précédente' }).click(); await p.waitForTimeout(400)
  await p.getByRole('button', { name: 'Étape précédente' }).click(); await p.waitForTimeout(400)
  check(/Étape 1 sur 3/.test(await txt(p)), 'bouton retour : étape 1')
  check(await p.locator('input[autocomplete=given-name]').inputValue() === 'Test' && await p.locator('input[type=tel]').inputValue() === '06 12 34 56 78', 'retour : saisie conservée')
  await p.getByRole('button', { name: /Continuer/ }).click(); await p.waitForTimeout(400)
  await p.getByRole('button', { name: /Continuer/ }).click(); await p.waitForTimeout(400)
  // Validations de l'étape 3
  await p.getByRole('button', { name: 'Créer mon compte' }).click(); await p.waitForTimeout(300)
  check(/adresse e-mail valide/.test(await alertText(p)), 'e-mail vide : message en français')
  await p.locator('input[type=email]').fill('pas-un-email'); await p.getByRole('button', { name: 'Créer mon compte' }).click(); await p.waitForTimeout(300)
  check(/adresse e-mail valide/.test(await alertText(p)), 'e-mail invalide : message en français')
  await p.locator('input[type=email]').fill('simule@ping-demo.invalid'); await p.locator('input[autocomplete=new-password]').fill('court')
  await p.getByRole('button', { name: 'Créer mon compte' }).click(); await p.waitForTimeout(300)
  check(/au moins 8 caractères/.test(await alertText(p)), 'mot de passe trop court : message en français')
  await p.locator('input[autocomplete=new-password]').fill('MotDePasse2026')
  await p.getByRole('button', { name: 'Créer mon compte' }).click(); await p.waitForTimeout(300)
  check(/acceptez les Conditions/.test(await alertText(p)), 'CGU non cochées : message en français')
  aucunReseau(calls, /signup/, 'aucune requête d’inscription tant que le formulaire est invalide')
  // Brouillon : rechargement
  await p.reload(); await p.waitForSelector('h1'); await p.waitForTimeout(500)
  const t = await txt(p)
  check(/Étape 3 sur 3/.test(t), 'rechargement : retour à l’étape 3')
  check(await p.locator('input[type=email]').inputValue() === 'simule@ping-demo.invalid', 'rechargement : e-mail conservé')
  check(await p.locator('input[autocomplete=new-password]').inputValue() === '', 'rechargement : le mot de passe n’est JAMAIS conservé')
  const draft = await p.evaluate(() => sessionStorage.getItem('ping_signup_draft') || '')
  check(!/MotDePasse2026/.test(draft), 'le brouillon ne contient pas le mot de passe')
  // Bascule Particulier / Professionnel : le brouillon reste
  await p.getByRole('button', { name: 'Professionnel' }).click(); await p.waitForTimeout(300)
  check(await p.locator('input[type=email]').inputValue() === 'simule@ping-demo.invalid', 'bascule Professionnel : saisie conservée')
  // Inscription simulée : « Vérifiez votre boîte mail »
  await p.locator('input[autocomplete=new-password]').fill('MotDePasse2026'); await p.locator('input[type=checkbox]').check()
  await p.getByRole('button', { name: 'Créer mon compte' }).click(); await p.waitForTimeout(1500)
  check(/Vérifiez votre boîte mail/.test(await txt(p)), 'inscription (simulée, e-mail à confirmer) : écran « Vérifiez votre boîte mail »')
  check(calls.filter(c => /signup/.test(c) && /^POST/.test(c)).length === 1, 'une seule requête d’inscription, interceptée (aucun compte réel)')
  await p.getByRole('button', { name: /Changer d.e-mail/ }).click(); await p.waitForTimeout(400)
  check(/Étape 3 sur 3/.test(await txt(p)), '« Changer d’e-mail » : retour à l’étape 3')
  check(errs.length === 0, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''))
  await ctx.close()
}
// Erreurs serveur d'inscription traduites
for (const [label, status, body, re] of [
  ['compte déjà existant', 422, { code: 'user_already_exists', msg: 'User already registered', error_code: 'user_already_exists' }, /compte existe déjà/],
  ['mot de passe jugé faible', 422, { code: 'weak_password', msg: 'Password should be at least 8 characters', error_code: 'weak_password' }, /trop faible/],
  ['trop de tentatives', 429, { code: 'over_email_send_rate_limit', msg: 'email rate limit exceeded', error_code: 'over_email_send_rate_limit' }, /Trop de tentatives/],
]) {
  const { p, ctx } = await page({ signup: { status, body } })
  await p.goto(BASE + '/auth/signup'); await p.evaluate(() => sessionStorage.setItem('ping_signup_draft', JSON.stringify({ form: { email: 'simule@ping-demo.invalid', firstName: 'T', lastName: 'S', phone: '0612345678', birthdate: '', address: '' }, role: 'client', step: 3 })))
  await p.reload(); await p.waitForSelector('input[type=email]'); await p.locator('input[autocomplete=new-password]').fill('MotDePasse2026'); await p.locator('input[type=checkbox]').check()
  await p.getByRole('button', { name: 'Créer mon compte' }).click(); await p.waitForTimeout(1200)
  check(re.test(await alertText(p)), `erreur serveur « ${label} » : message en français (${(await alertText(p)).slice(0, 70)})`)
  await ctx.close()
}

// ───────── Connexion / mot de passe oublié ─────────
console.log('\n=== /auth/login')
{
  const { p, ctx, calls, errs } = await page()
  await p.goto(BASE + '/auth/login'); await p.waitForSelector('h1')
  await p.getByRole('button', { name: /Mot de passe oublié/ }).click(); await p.waitForTimeout(300)
  check(/Indiquez votre email ci-dessus/.test(await alertText(p)), '« Mot de passe oublié » sans e-mail : message en français')
  await p.locator('#email').fill('pas-un-email'); await p.getByRole('button', { name: /Mot de passe oublié/ }).click(); await p.waitForTimeout(300)
  check(/adresse n’est pas valide|adresse email n’est pas valide/.test(await alertText(p)), '« Mot de passe oublié » avec e-mail invalide : message en français')
  aucunReseau(calls, /recover/, 'aucune demande de lien envoyée pour un e-mail invalide')
  await p.locator('#email').fill('simule@ping-demo.invalid'); await p.getByRole('button', { name: /Mot de passe oublié/ }).click(); await p.waitForTimeout(1200)
  check(/Si un compte existe pour cet email, un lien de réinitialisation/.test(await txt(p)), '« Mot de passe oublié » : confirmation neutre (ne révèle pas si le compte existe)')
  check(calls.filter(c => /recover/.test(c) && /^POST/.test(c)).length === 1, 'une demande de lien, interceptée (aucun e-mail réel)')
  await p.locator('#password').fill(''); await p.getByRole('button', { name: 'Se connecter' }).click(); await p.waitForTimeout(300)
  check(/email et votre mot de passe/.test(await alertText(p)), 'connexion sans mot de passe : message en français')
  check(errs.length === 0, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''))
  await ctx.close()
}
{
  const { p, ctx } = await page({ recover: { status: 429, body: { code: 'over_email_send_rate_limit', msg: 'For security purposes, you can only request this after 42 seconds.', error_code: 'over_email_send_rate_limit' } } })
  await p.goto(BASE + '/auth/login'); await p.waitForSelector('#email'); await p.locator('#email').fill('simule@ping-demo.invalid')
  await p.getByRole('button', { name: /Mot de passe oublié/ }).click(); await p.waitForTimeout(1200)
  check(/Patientez 42 secondes/.test(await alertText(p)), 'limite de débit : « Patientez 42 secondes » en français')
  await ctx.close()
}

// ───────── Réinitialisation ─────────
console.log('\n=== /auth/reset')
{ // lien expiré / ouvert sans session
  const { p, ctx } = await page()
  await p.goto(BASE + '/auth/reset'); await p.waitForTimeout(7500)
  check(/Ce lien n.est plus valable/.test(await txt(p)) && (await p.getByRole('link', { name: /Retour à la connexion/ }).count()) === 1, 'sans session : « Ce lien n’est plus valable » + retour à la connexion')
  await ctx.close()
}
{ // lien en erreur (Supabase met l'erreur dans l'adresse) : message immédiat
  const { p, ctx } = await page()
  await p.goto(BASE + '/auth/reset#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired'); await p.waitForTimeout(1500)
  check(/Ce lien n.est plus valable/.test(await txt(p)), 'lien expiré (erreur dans l’adresse) : message immédiat en français')
  await ctx.close()
}
async function withSession(opts) {
  const x = await page(opts)
  const exp = Math.floor(Date.now() / 1000) + 3600
  const session = { access_token: jwt(exp), refresh_token: 'simule', token_type: 'bearer', expires_in: 3600, expires_at: exp, user: { id: '00000000-0000-0000-0000-000000000001', aud: 'authenticated', role: 'authenticated', email: 'simule@ping-demo.invalid' } }
  const host = new URL(BASE)
  await x.ctx.addCookies([{ name: `sb-${REF}-auth-token`, value: encodeURIComponent(JSON.stringify(session)), domain: host.hostname, path: '/', secure: host.protocol === 'https:' }])
  return x
}
{
  const { p, ctx, calls, errs } = await withSession()
  await p.goto(BASE + '/auth/reset'); await p.waitForSelector('input[type=password]', { timeout: 8000 }).catch(() => { })
  const form = await p.locator('input[type=password]').count()
  check(form === 2, 'avec une session de récupération : formulaire « Nouveau mot de passe » (2 champs)')
  if (form === 2) {
    const [a, c] = [p.locator('input[type=password]').nth(0), p.locator('input[type=password]').nth(1)]
    await p.getByRole('button', { name: 'Enregistrer' }).click(); await p.waitForTimeout(300)
    check(/au moins 8 caractères/.test(await alertText(p)), 'mot de passe vide : message en français')
    await a.fill('NouveauMdp2026'); await c.fill('AutreMdp2026'); await p.getByRole('button', { name: 'Enregistrer' }).click(); await p.waitForTimeout(300)
    check(/pas identiques/.test(await alertText(p)), 'mots de passe différents : « Les deux mots de passe ne sont pas identiques. »')
    aucunReseau(calls, /PUT \/user/, 'aucune requête de changement tant que les mots de passe diffèrent')
    await c.fill('NouveauMdp2026'); await p.getByRole('button', { name: 'Enregistrer' }).click(); await p.waitForTimeout(1200)
    check(/Mot de passe modifié/.test(await txt(p)), 'changement (simulé) : « Mot de passe modifié. Redirection en cours… »')
    check(calls.filter(c => /^PUT \/user/.test(c)).length === 1, 'une seule requête de changement, interceptée (aucun mot de passe réel changé)')
  }
  check(errs.length === 0, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''))
  await ctx.close()
}
{ // le serveur refuse (lien expiré entre-temps / même mot de passe)
  for (const [label, body, re] of [
    ['lien expiré entre-temps', { code: 'session_not_found', msg: 'Auth session missing!' }, /lien a peut-être expiré/],
    ['même mot de passe que l’ancien', { code: 'same_password', msg: 'New password should be different from the old password.' }, /différent de l’ancien/],
    ['mot de passe jugé faible', { code: 'weak_password', msg: 'Password should be at least 8 characters.' }, /trop faible/],
  ]) {
    const { p, ctx } = await withSession({ update: { status: 422, body } })
    await p.goto(BASE + '/auth/reset'); await p.waitForSelector('input[type=password]', { timeout: 8000 }).catch(() => { })
    if (await p.locator('input[type=password]').count() === 2) {
      await p.locator('input[type=password]').nth(0).fill('NouveauMdp2026'); await p.locator('input[type=password]').nth(1).fill('NouveauMdp2026')
      await p.getByRole('button', { name: 'Enregistrer' }).click(); await p.waitForTimeout(1200)
    }
    check(re.test(await alertText(p)), `refus serveur « ${label} » : message en français (${(await alertText(p)).slice(0, 80)})`)
    await ctx.close()
  }
}
await b.close()
console.log(`\n${ok} vérifications réussies, ${ko} échecs`)
process.exit(ko ? 1 : 0)
