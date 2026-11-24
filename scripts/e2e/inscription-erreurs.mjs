// Messages d'erreur d'inscription (compte existant, mot de passe faible, trop de tentatives) sur la production, sans créer de compte :
// la requête d'inscription est interceptée. BASE=https://nexto-eta.vercel.app node inscription-erreurs.mjs
import { chromium } from 'playwright'
const BASE = process.env.BASE || 'https://nexto-eta.vercel.app'
let ko = 0
;(async () => {
  const b = await chromium.launch()
  for (const [label, status, body, re] of [
    ['compte deja existant', 422, { code: 'user_already_exists', msg: 'User already registered', error_code: 'user_already_exists' }, /existe déjà/],
    ['mot de passe faible', 422, { code: 'weak_password', msg: 'Password should be at least 8 characters', error_code: 'weak_password' }, /faible/],
    ['trop de tentatives', 429, { code: 'over_email_send_rate_limit', msg: 'email rate limit exceeded', error_code: 'over_email_send_rate_limit' }, /tentatives/],
  ]) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, locale: 'fr-FR' })
    const p = await ctx.newPage()
    let hits = 0
    await p.route(/\/auth\/v1\/signup/, r => { hits++; r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) }) })
    await p.goto(BASE + '/auth/signup', { waitUntil: 'networkidle' })
    await p.evaluate(() => sessionStorage.setItem('ping_signup_draft', JSON.stringify({ form: { email: 'simule@ping-demo.invalid', firstName: 'T', lastName: 'S', phone: '0612345678', birthdate: '', address: '' }, role: 'client', step: 3 })))
    await p.reload({ waitUntil: 'networkidle' })
    await p.waitForSelector('input[type=email]')
    await p.locator('input[autocomplete=new-password]').fill('MotDePasse2026')
    await p.locator('input[type=checkbox]').check()
    await p.getByRole('button', { name: 'Créer mon compte' }).click()
    await p.waitForTimeout(1500)
    const alert = (await p.locator('[role=alert]').allInnerTexts()).join(' | ').slice(0, 120)
    if (!re.test(alert)) ko++
    console.log(re.test(alert) ? 'OK' : 'KO', label, '->', alert, '| requêtes interceptées:', hits)
    await ctx.close()
  }
  await b.close()
  process.exit(ko ? 1 : 0)
})()
