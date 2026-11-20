// Test de la migration 059 (virement non reçu) sur un PostgreSQL local, schéma minimal + vraies fonctions/gardes
// extraites des migrations 025, 040 et 059.   node scripts/tests/virement-non-recu/run.cjs
// Variable PGTEST_DSN (sinon : serveur local, utilisateur postgres). Ignoré proprement si PostgreSQL est absent.
const fs = require('fs'), path = require('path'), assert = require('assert')
const { execFileSync, spawnSync } = require('child_process')
const root = path.join(__dirname, '../../..')
const out = path.join(__dirname, '.build'); fs.mkdirSync(out, { recursive: true })
const dsn = process.env.PGTEST_DSN
let uid
if (!dsn && process.getuid && process.getuid() === 0) { try { uid = Number(execFileSync('id', ['-u', 'postgres']).toString()) } catch (e) { uid = undefined } }
if (uid !== undefined) fs.chmodSync(out, 0o755)
const psql = (file) => spawnSync('psql', [...(dsn ? [dsn] : ['-d', 'postgres']), '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-f', file], { encoding: 'utf8', uid })
const probe = spawnSync('psql', [...(dsn ? [dsn] : ['-d', 'postgres']), '-X', '-c', 'select 1'], { encoding: 'utf8', uid })
if (probe.status !== 0) { console.log('PostgreSQL local indisponible : test ignoré'); process.exit(0) }

const rd = f => fs.readFileSync(path.join(root, 'supabase/migrations', f), 'utf8')
const grab = (src, re) => { const m = src.match(re); if (!m) throw new Error('fonction introuvable ' + re); return m[0] }
const local = s => s.replace(/public\./g, '').replace(/search_path = public/g, 'search_path = vtest, public')
const m025 = rd('025_virement_sepa.sql'), m040 = rd('040_arrangement_amiable.sql')
const parts = [
  fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'),
  local(grab(m040, /create or replace function public\.guard_transfer_payment[\s\S]*?end \$\$;/)),
  'create trigger trg_guard_transfer_payment before update on transfer_payments for each row execute function guard_transfer_payment();',
  local(grab(m025, /create or replace function public\.transfer_payment_received[\s\S]*?end \$\$;/)),
  'create trigger trg_transfer_payment_received after update on transfer_payments for each row execute function transfer_payment_received();',
  // 059 en entier, adaptée au schéma local (les « revoke/grant » visent des rôles réels, conservés).
  local(rd('059_virement_non_recu.sql')),
]
// Scénarios : chaque ligne « select T('nom', 'ok'|'ko : raison') » est lue en sortie.
const A = '11111111-1111-1111-1111-111111111111' // client
const P = '22222222-2222-2222-2222-222222222222' // prestataire
const X = '33333333-3333-3333-3333-333333333333' // admin
const TX = '44444444-4444-4444-4444-444444444444'
const as = (u) => `select set_config('request.jwt.claim.sub', '${u}', false); set role authenticated;`
const back = 'reset role; select set_config(\'request.jwt.claim.sub\', \'\', false);'
const expectErr = (name, sql) => `do $$ begin ${sql.replace(/;?\s*$/, ';')} raise notice 'RES|KO|${name}|aucune erreur'; exception when others then if sqlerrm like '%RES|KO%' then raise; end if; raise notice 'RES|OK|${name}|%', sqlerrm; end $$;`
const check = (name, cond) => `do $$ begin if (${cond}) then raise notice 'RES|OK|${name}|'; else raise notice 'RES|KO|${name}|condition fausse'; end if; end $$;`
const sc = []
sc.push(`insert into transactions values ('${TX}', '${A}', '${P}'); insert into admins values ('${X}');
insert into provider_profiles values ('${P}'); insert into app_settings values ('unpaid_ceiling_cents', '5000'::jsonb);
insert into transfer_payments (id, invoice_id, transaction_id, payer_role, payee, payer_id, payee_id, reference, amount_cents, status, declared_at)
 values ('a0000000-0000-0000-0000-000000000001', gen_random_uuid(), '${TX}', 'client', 'pro', '${A}', '${P}', 'FACT-1', 9000, 'a_payer', null),
        ('a0000000-0000-0000-0000-000000000002', gen_random_uuid(), '${TX}', 'pro', 'ping', '${P}', null, 'PING-V-1', 1530, 'declare_paye', now() - interval '12 days');
grant select, insert on messages, payment_alerts to authenticated; grant select, insert, update on commission_debts, provider_profiles, provider_private to authenticated;`)
const T1 = "'a0000000-0000-0000-0000-000000000001'", T2 = "'a0000000-0000-0000-0000-000000000002'"
sc.push(as(P), expectErr('non reçu refusé tant que le client n a rien annoncé', `perform transfer_report_not_received(${T1}, 'x')`), back)
sc.push(as(A), `update transfer_payments set status = 'declare_paye' where id = ${T1};`, back)
sc.push(as(A), expectErr('le payeur ne peut pas se déclarer « non reçu » lui-même', `perform transfer_report_not_received(${T1}, 'x')`), back)
sc.push(as(A), expectErr('le payeur ne peut pas écrire not_received_at en direct', `update transfer_payments set not_received_at = now() where id = ${T1}`), back)
sc.push(as(P), expectErr('le prestataire ne peut pas écrire not_received_at en direct', `update transfer_payments set not_received_at = now() where id = ${T1}`), back)
sc.push(as(P), `select transfer_report_not_received(${T1}, 'Rien sur mon compte depuis 3 jours');`, back)
sc.push(check('contestation posée, statut resté « annoncé »', `(select status = 'declare_paye' and not_received_at is not null and not_received_by = '${P}' and not_received_note like 'Rien%' from transfer_payments where id = ${T1})`))
sc.push(check('message système dans la conversation, signé du prestataire', `(select count(*) from messages where transaction_id = '${TX}' and kind = 'system' and sender_id = '${P}' and body like '%n''a pas reçu%FACT-1%90,00 €%') = 1`))
sc.push(check('alerte admin créée', `(select count(*) from payment_alerts where kind = 'transfer_not_received' and detail->>'reference' = 'FACT-1') = 1`))
sc.push(as(A), expectErr('un tiers (autre compte) ne peut pas contester', `perform transfer_report_not_received(${T1}, null)`), back)
sc.push(as(A), `select transfer_reaffirm(${T1}, 'Virement fait mardi, preuve à l''appui');`, back)
sc.push(check('désaccord : contestation gardée, réaffirmation posée, annonce renouvelée', `(select not_received_at is not null and reaffirmed_at is not null and status = 'declare_paye' and declared_at > now() - interval '1 minute' from transfer_payments where id = ${T1})`))
sc.push(check('alerte « désaccord » pour l admin', `(select count(*) from payment_alerts where kind = 'transfer_disagreement') = 1`))
sc.push(as(P), `select transfer_report_not_received(${T1}, 'Toujours rien');`, back)
sc.push(check('nouvelle contestation : la réaffirmation est effacée', `(select reaffirmed_at is null from transfer_payments where id = ${T1})`))
sc.push(as(A), `update transfer_payments set status = 'a_payer' where id = ${T1};`, back)
sc.push(check('« Pas encore fait » lève la contestation', `(select status = 'a_payer' and not_received_at is null and reaffirmed_at is null from transfer_payments where id = ${T1})`))
// Relance : contestation non réaffirmée après 3 jours -> en retard
sc.push(as(A), `update transfer_payments set status = 'declare_paye' where id = ${T1};`, back)
sc.push(as(P), `select transfer_report_not_received(${T1}, null);`, back)
sc.push(`update transfer_payments set not_received_at = now() - interval '4 days' where id = ${T1};`)
sc.push(`select mark_overdue_transfers();`)
sc.push(check('contesté depuis 4 j sans réponse du payeur : « en retard » (pas besoin d attendre 10 j)', `(select status = 'en_retard' from transfer_payments where id = ${T1})`))
// Commission du pro annoncée il y a 12 j : en retard, dette, alerte
sc.push(check('commission annoncée depuis 12 j : en retard', `(select status = 'en_retard' from transfer_payments where id = ${T2})`))
sc.push(check('dette de commission créée (15,30 €), une seule', `(select count(*) = 1 and sum(amount_cents) = 1530 from commission_debts where provider_id = '${P}')`))
sc.push(check('sous le plafond (50 €) : pas de suspension', `(select payments_suspended_at is null from provider_profiles where id = '${P}')`))
sc.push(`select mark_overdue_transfers();`)
sc.push(check('2e passage : pas de doublon de dette', `(select count(*) = 1 from commission_debts where provider_id = '${P}')`))
// Plafond dépassé -> suspension
sc.push(`update app_settings set value = '1000'::jsonb where key = 'unpaid_ceiling_cents';
insert into transfer_payments (invoice_id, transaction_id, payer_role, payee, payer_id, reference, amount_cents, status, declared_at)
 values (gen_random_uuid(), '${TX}', 'pro', 'ping', '${P}', 'PING-V-2', 2000, 'declare_paye', now() - interval '11 days');
select mark_overdue_transfers();`)
sc.push(check('plafond dépassé (35,30 € > 10 €) : compte suspendu et masqué', `(select payments_suspended_at is not null and is_active = false from provider_profiles where id = '${P}')`))
// Admin : « non reçu » sur une commission annoncée
sc.push(`insert into transfer_payments (id, invoice_id, transaction_id, payer_role, payee, payer_id, reference, amount_cents, status, declared_at)
 values ('a0000000-0000-0000-0000-000000000003', gen_random_uuid(), '${TX}', 'pro', 'ping', '${P}', 'PING-V-3', 500, 'declare_paye', now());`)
sc.push(as(X), `select transfer_report_not_received('a0000000-0000-0000-0000-000000000003', 'Pas sur le relevé PING');`, back)
sc.push(check('admin : « non reçu » sur une commission, message signé « PING »', `(select count(*) from messages where body like 'PING n''a pas reçu le virement de la commission PING-V-3%') = 1`))
sc.push(as(P), `select transfer_reaffirm('a0000000-0000-0000-0000-000000000003', null);`, back)
sc.push(as(X), `update transfer_payments set status = 'recu' where id = 'a0000000-0000-0000-0000-000000000003';`, back)
sc.push(check('l admin tranche : noté reçu (historique de contestation conservé)', `(select status = 'recu' and not_received_at is not null from transfer_payments where id = 'a0000000-0000-0000-0000-000000000003')`))
sc.push(as(P), expectErr('un virement reçu ne se conteste plus', `perform transfer_report_not_received('a0000000-0000-0000-0000-000000000003', null)`), back)

const file = path.join(out, 'test.sql')
// Deux passes pour prouver le « rejouable » : on charge la migration deux fois.
fs.writeFileSync(file, parts.join('\n') + '\n' + local(rd('059_virement_non_recu.sql')) + '\nset search_path = vtest, public;\n' + sc.join('\n') + '\nreset role;\ndrop schema vtest cascade;\n')
if (uid !== undefined) fs.chmodSync(file, 0o644)
const r = psql(file)
const lines = `${r.stdout}\n${r.stderr}`.split('\n').filter(l => /RES\|/.test(l))
let ok = 0, ko = 0
for (const l of lines) { const m = l.match(/RES\|(OK|KO)\|([^|]*)\|(.*)/); if (!m) continue; if (m[1] === 'OK') { ok++; console.log('  OK  ' + m[2]) } else { ko++; console.log('  KO  ' + m[2] + ' : ' + m[3]) } }
if (r.status !== 0) { ko++; console.log('  KO  erreur SQL\n' + r.stderr.split('\n').filter(l => !/RES\|/.test(l)).join('\n')) }
console.log(`\n${ok} OK, ${ko} KO`)
process.exit(ko ? 1 : 0)
