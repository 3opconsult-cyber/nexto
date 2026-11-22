// Test de la migration 062 (alertes d'argent et de litige dans l'admin, chat en direct) sur un PostgreSQL 16 local jetable :
// initdb + pg_ctl sur un port libre, schéma minimal imitant Supabase (auth.uid(), is_admin(), rôles anon/authenticated/service_role),
// migration 057 collée d'abord (table admin_notifications réelle).
//   node scripts/tests/alertes-admin/run.cjs
// Ignoré proprement si les binaires PostgreSQL 16 sont absents. Aucune base de production n'est touchée.
const fs = require('fs'), path = require('path'), os = require('os'), net = require('net')
const { execFileSync, spawnSync } = require('child_process')

const BIN = process.env.PG_BIN || '/usr/lib/postgresql/16/bin'
if (!fs.existsSync(path.join(BIN, 'initdb'))) { console.log('PostgreSQL 16 absent : test ignoré'); process.exit(0) }
const root = path.join(__dirname, '../../..')
const MIG = fs.readFileSync(path.join(root, 'supabase/migrations/062_alertes_admin_et_chat_direct.sql'), 'utf8')
const COPY = fs.readFileSync(path.join(root, 'supabase/a_coller/062_alertes_admin_et_chat_direct.sql'), 'utf8')
const M057 = fs.readFileSync(path.join(root, 'supabase/migrations/057_alertes_admin_pieces.sql'), 'utf8')
const TS = fs.readFileSync(path.join(root, 'src/lib/adminAlerts.ts'), 'utf8')

let uid, gid
if (process.getuid && process.getuid() === 0) {
  try { uid = Number(execFileSync('id', ['-u', 'postgres']).toString()); gid = Number(execFileSync('id', ['-g', 'postgres']).toString()) } catch (e) { console.log('utilisateur postgres absent : test ignoré'); process.exit(0) }
}
const dir = fs.mkdtempSync(path.join(process.env.CTL_TMP || os.tmpdir(), 'pgalert-'))
if (uid !== undefined) fs.chownSync(dir, uid, gid)
const data = path.join(dir, 'data'), sock = dir
const freePort = () => new Promise(res => { const s = net.createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => res(p)) }) })
const sh = (cmd, args, extra = {}) => spawnSync(cmd, args, { encoding: 'utf8', uid, gid, ...extra })
let PORT

function psql(sql, { role, sub, db = 'ping', expectError } = {}) {
  const pre = (sub !== undefined ? `set request.jwt.claim.sub = '${sub}';\n` : '') + (role ? `set role ${role};\n` : '')
  const r = sh(BIN + '/psql', ['-h', sock, '-p', String(PORT), '-U', 'postgres', '-d', db, '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1'], { input: pre + sql })
  if (expectError) return { ok: r.status === 0, err: (r.stderr || ''), out: (r.stdout || '').trim() }
  if (r.status !== 0) throw new Error('SQL en erreur : ' + (r.stderr || '').trim() + '\n' + sql.slice(0, 300))
  return r.stdout.trim()
}
let nOk = 0, nKo = 0
const ok = (name, cond, extra) => { if (cond) { nOk++; console.log('OK   ' + name) } else { nKo++; console.log('KO   ' + name + (extra !== undefined ? ' : ' + extra : '')) } }
const n = sql => Number(psql(`select count(*) from (${sql}) x;`))

const ADMIN = '00000000-0000-0000-0000-00000000000a', PRO = '00000000-0000-0000-0000-0000000000b1', CLIENT = '00000000-0000-0000-0000-0000000000c1'
const ROLES = 'create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;'   // rôles (service_role contourne la RLS comme sur Supabase) : une fois pour le serveur
const SETUP = `
create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
create table public.admins (user_id uuid primary key);
create function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$ select exists (select 1 from public.admins where user_id = auth.uid()) $$;
insert into auth.users values ('${ADMIN}', 'admin@ping.test'), ('${PRO}', 'pro@ping.test'), ('${CLIENT}', 'client@ping.test');
insert into public.admins values ('${ADMIN}');
create table public.profiles (id uuid primary key, full_name text);
create table public.provider_profiles (id uuid primary key);
create table public.documents (id uuid primary key default gen_random_uuid(), owner_id uuid, kind text, status text default 'pending', storage_path text, created_at timestamptz default now());
create table public.admin_conversations (id uuid primary key default gen_random_uuid(), user_id uuid, last_message_at timestamptz);
create table public.admin_messages (id uuid primary key default gen_random_uuid(), conversation_id uuid, sender_is_admin boolean, body text, read_by_admin boolean);
create table public.transactions (id uuid primary key default gen_random_uuid(), buyer_id uuid, seller_id uuid, status text default 'pending');
create table public.messages (id uuid primary key default gen_random_uuid(), transaction_id uuid, sender_id uuid, body text, kind text default 'text', created_at timestamptz default now());
create type public.dispute_status as enum ('open', 'resolved', 'rejected');
create table public.disputes (id uuid primary key default gen_random_uuid(), transaction_id uuid, opener_id uuid, reason text,
  status public.dispute_status not null default 'open', resolution text, created_at timestamptz default now(), closed_at timestamptz,
  mediation_requested_at timestamptz, mediation_requested_by uuid);
create table public.dispute_messages (id uuid primary key default gen_random_uuid(), dispute_id uuid, sender_id uuid, body text, created_at timestamptz default now());
-- payment_alerts : forme exacte de 019 (sans la clé étrangère vers auth.users).
create table public.payment_alerts (id uuid primary key default gen_random_uuid(), provider_id uuid, kind text not null,
  detail jsonb not null default '{}', created_at timestamptz not null default now(), handled_at timestamptz);
alter table public.payment_alerts enable row level security;
create policy "payment_alerts admin" on public.payment_alerts for all using (public.is_admin()) with check (public.is_admin());
grant select, insert, update on public.payment_alerts to authenticated;
alter table public.disputes enable row level security;
create policy "disputes parties" on public.disputes for all using (opener_id = auth.uid() or public.is_admin()) with check (opener_id = auth.uid() or public.is_admin());
grant select, insert, update on public.disputes to authenticated;
-- _cx_alert de 056 (alerte posée depuis une fonction security definer, exception avalée).
create function public._cx_alert(p_provider uuid, p_kind text, p_detail jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin insert into public.payment_alerts (provider_id, kind, detail) values (p_provider, p_kind, coalesce(p_detail, '{}'::jsonb));
exception when others then null; end $$;
`
const KINDS = ['cancel_after_arrival', 'late_cancellation_fees', 'provider_no_show', 'provider_cancellations', 'transfer_not_received',
  'transfer_disagreement', 'transfer_overdue', 'suspended', 'unsuspended', 'mandate_revoked', 'mandate_failed', 'debit_rejected', 'chargeback', 'refund_failed']

// Libellés et gravité du code (src/lib/adminAlerts.ts), pour la parité avec la base.
function tsLabels() {
  const block = TS.slice(TS.indexOf('PAYMENT_ALERT_LABEL'), TS.indexOf('}', TS.indexOf('PAYMENT_ALERT_LABEL')))
  const out = {}
  for (const m of block.matchAll(/(\w+): '([^']*)'/g)) out[m[1]] = m[2]
  const g0 = TS.indexOf('= [', TS.indexOf('export const PAYMENT_ALERT_GRAVE'))
  const g = TS.slice(g0, TS.indexOf(']', g0))
  return { labels: out, graves: [...g.matchAll(/'(\w+)'/g)].map(m => m[1]) }
}
const norm = s => String(s).replace(/[’']/g, "'")

async function main() {
  PORT = await freePort()
  let r = sh(BIN + '/initdb', ['-D', data, '-A', 'trust', '-U', 'postgres', '--no-sync', '-E', 'UTF8'])
  if (r.status !== 0) { console.log('initdb impossible : ' + r.stderr); process.exit(0) }
  r = sh(BIN + '/pg_ctl', ['-D', data, '-w', '-l', path.join(dir, 'log'), '-o', `-p ${PORT} -k ${sock} -c listen_addresses=''`, 'start'])
  if (r.status !== 0) { console.log('pg_ctl impossible : ' + r.stderr); process.exit(0) }
  sh(BIN + '/createdb', ['-h', sock, '-p', String(PORT), '-U', 'postgres', 'ping'])
  sh(BIN + '/createdb', ['-h', sock, '-p', String(PORT), '-U', 'postgres', 'sans057'])

  // 0. Fichier ------------------------------------------------------------------------------------------------------------
  ok('copie a_coller identique à la migration', MIG === COPY)
  ok('aucun mot de suppression dans la migration (drop, delete, même en commentaire)', !/drop|delet/i.test(MIG))

  // 1. Sans 057 : arrêt clair, rien de créé ----------------------------------------------------------------------------------
  psql(ROLES, { db: 'sans057' })
  psql(SETUP, { db: 'sans057' })
  const no57 = psql(MIG, { db: 'sans057', expectError: true })
  ok('sans 057 : la migration s\'arrête avec un message clair', !no57.ok && /Migration 057 absente/.test(no57.err), no57.err.slice(0, 200))
  ok('sans 057 : aucun trigger créé', psql("select count(*) from pg_trigger where tgname like 'trg_%admin_notify'", { db: 'sans057' }) === '0')

  // 2. Base avec 057 et données déjà présentes (rattrapage) -------------------------------------------------------------------
  psql(SETUP); psql(M057)
  const tx = psql(`insert into public.transactions (buyer_id, seller_id) values ('${CLIENT}', '${PRO}') returning id;`)
  const oldAlert = psql(`insert into public.payment_alerts (provider_id, kind, detail) values ('${PRO}', 'transfer_overdue', '{"transactionId":"${tx}","reference":"FACT-1"}') returning id;`)
  psql(`insert into public.payment_alerts (provider_id, kind, handled_at) values ('${PRO}', 'suspended', now());`)
  const oldDisp = psql(`insert into public.disputes (transaction_id, opener_id, reason, mediation_requested_at) values ('${tx}', '${CLIENT}', 'vieux litige', now()) returning id;`)
  psql(`insert into public.disputes (transaction_id, opener_id, reason, status, closed_at) values ('${tx}', '${CLIENT}', 'clos', 'resolved', now());`)

  // Première fois sans publication supabase_realtime (base hors Supabase) : aucune erreur.
  psql(MIG); ok('collée une 1re fois (sans publication supabase_realtime) sans erreur', true)
  ok('rattrapage : l\'alerte de paiement ouverte apparaît (1), pas celle déjà traitée', n(`select 1 from admin_notifications where kind = 'payment_alert'`) === 1
    && psql(`select ref_id from admin_notifications where kind = 'payment_alert'`) === oldAlert)
  ok('rattrapage : litige ouvert + intervention demandée (2), rien pour le litige clos', n(`select 1 from admin_notifications where kind in ('dispute_open', 'dispute_mediation')`) === 2
    && n(`select 1 from admin_notifications where kind like 'dispute%' and ref_id <> '${oldDisp}'`) === 0)
  ok('rattrapage : marqué « e-mail envoyé » (pas de rafale)', n(`select 1 from admin_notifications where kind in ('payment_alert', 'dispute_open', 'dispute_mediation') and emailed_at is null`) === 0)

  // Publication créée ensuite (cas Supabase) : 2e collage ajoute les deux tables, 3e collage ne change rien.
  psql('create publication supabase_realtime;')
  psql(MIG); ok('collée une 2e fois (publication présente) sans erreur', true)
  ok('messages et dispute_messages ajoutées à supabase_realtime', psql(`select string_agg(tablename, ',' order by tablename) from pg_publication_tables where pubname = 'supabase_realtime'`) === 'dispute_messages,messages')
  psql(COPY); ok('copie a_coller collée une 3e fois sans erreur', true)
  ok('publication inchangée après le 3e collage (2 tables)', n(`select 1 from pg_publication_tables where pubname = 'supabase_realtime'`) === 2)
  ok('rejouée : aucune alerte en double (3 lignes)', n(`select 1 from admin_notifications where kind in ('payment_alert', 'dispute_open', 'dispute_mediation')`) === 3)
  ok('triggers posés une seule fois', psql("select count(*) from pg_trigger where tgname in ('trg_payment_alerts_admin_notify', 'trg_disputes_admin_notify')") === '2')

  // 3. Droits ---------------------------------------------------------------------------------------------------------------
  for (const f of ['payment_alerts_admin_notify()', 'disputes_admin_notify()', '_payment_alert_label(text)', '_payment_alert_grave(text)']) {
    ok(`${f} : non exécutable par anon ni authenticated`, psql(`select has_function_privilege('anon', 'public.${f}', 'execute') or has_function_privilege('authenticated', 'public.${f}', 'execute')`) === 'f')
  }
  ok('admin_alert_counts : non exécutable par anon', psql(`select has_function_privilege('anon', 'public.admin_alert_counts()', 'execute')`) === 'f')
  const asUser = psql('select public.admin_alert_counts();', { role: 'authenticated', sub: CLIENT, expectError: true })
  ok('admin_alert_counts : refusé à un utilisateur non admin', !asUser.ok && /Réservé à l'administration/.test(asUser.err), asUser.err.slice(0, 120))
  ok('admin_notifications : authenticated n\'a toujours pas le droit d\'insérer', psql(`select has_table_privilege('authenticated', 'public.admin_notifications', 'insert')`) === 'f')

  // 4. Un cas par kind ------------------------------------------------------------------------------------------------------
  const { labels, graves } = tsLabels()
  for (const k of KINDS) {
    const id = psql(`select public._cx_alert('${PRO}', '${k}', '{"transactionId":"${tx}","note":"texte libre du client"}'); select id from public.payment_alerts where kind = '${k}' order by created_at desc limit 1;`).split('\n').pop()
    const row = psql(`select title || '|' || (detail ->> 'gravite') || '|' || coalesce(user_id::text, '') || '|' || (detail ->> 'transaction_id') || '|' || coalesce(detail ->> 'note', 'sans-note')
      from admin_notifications where kind = 'payment_alert' and ref_id = '${id}' and handled_at is null`)
    const [title, grav, user, txid, note] = row.split('|')
    const expGrave = graves.includes(k) ? 'grave' : 'normal'
    ok(`${k} : alerte « ${title} » (${grav})`, title && norm(title) === norm(labels[k]) && grav === expGrave && user === PRO && txid === tx && note === 'sans-note', row)
  }
  ok('libellés de la base = libellés du code (14 kinds)', KINDS.every(k => norm(psql(`select public._payment_alert_label('${k}')`)) === norm(labels[k])) && Object.keys(labels).length === KINDS.length)
  ok('kind inconnu : libellé générique', psql(`select public._payment_alert_label('xyz')`) === 'Alerte de paiement : xyz')

  // Alerte posée par un admin connecté (RLS de payment_alerts) : le trigger écrit malgré l'absence de droit d'insertion.
  const viaAdmin = psql(`insert into public.payment_alerts (provider_id, kind) values ('${PRO}', 'chargeback') returning id;`, { role: 'authenticated', sub: ADMIN })
  ok('alerte posée sous RLS (authenticated admin) : notification créée', n(`select 1 from admin_notifications where ref_id = '${viaAdmin}'`) === 1)

  // 5. Traitée quand la source l'est --------------------------------------------------------------------------------------------
  const tgt = psql(`select id from public.payment_alerts where kind = 'provider_no_show' limit 1`)
  psql(`update public.payment_alerts set handled_at = now() where id = '${tgt}';`, { role: 'service_role' })
  ok('payment_alerts.handled_at posé (bouton « Traitée ») : alerte admin traitée', n(`select 1 from admin_notifications where ref_id = '${tgt}' and handled_at is not null`) === 1
    && n(`select 1 from admin_notifications where ref_id = '${tgt}' and handled_at is null`) === 0)
  psql(`update public.payment_alerts set detail = '{"x":1}' where id = '${oldAlert}';`)
  ok('autre mise à jour de payment_alerts : alerte admin toujours ouverte', n(`select 1 from admin_notifications where ref_id = '${oldAlert}' and handled_at is null`) === 1)

  // 6. Litiges -------------------------------------------------------------------------------------------------------------
  const d1 = psql(`insert into public.disputes (transaction_id, opener_id, reason) values ('${tx}', '${CLIENT}', 'Taches') returning id;`, { role: 'authenticated', sub: CLIENT })
  ok('litige ouvert par le client (RLS) : alerte « Litige ouvert »', psql(`select title || '|' || (detail->>'gravite') || '|' || user_id from admin_notifications where kind = 'dispute_open' and ref_id = '${d1}'`) === `Litige ouvert|normal|${CLIENT}`)
  ok('litige ouvert : pas encore d\'intervention demandée', n(`select 1 from admin_notifications where kind = 'dispute_mediation' and ref_id = '${d1}'`) === 0)
  psql(`update public.disputes set mediation_requested_at = now(), mediation_requested_by = '${CLIENT}' where id = '${d1}';`)
  ok('intervention de PING demandée : alerte grave', psql(`select title || '|' || (detail->>'gravite') from admin_notifications where kind = 'dispute_mediation' and ref_id = '${d1}'`) === 'Intervention de PING demandée|grave')
  psql(`update public.disputes set reason = 'Taches (précision)' where id = '${d1}';`)
  ok('autre mise à jour du litige : aucune alerte en double', n(`select 1 from admin_notifications where ref_id = '${d1}'`) === 2)
  psql(`update public.disputes set status = 'resolved', resolution = 'Décision PING', closed_at = now() where id = '${d1}';`)
  ok('litige clos (résolu) : ses 2 alertes sont traitées', n(`select 1 from admin_notifications where ref_id = '${d1}' and handled_at is not null`) === 2)
  const d2 = psql(`insert into public.disputes (transaction_id, opener_id, reason) values ('${tx}', '${PRO}', 'Client absent') returning id;`)
  psql(`update public.disputes set status = 'rejected', closed_at = now() where id = '${d2}';`)
  ok('litige non retenu : alerte traitée', n(`select 1 from admin_notifications where ref_id = '${d2}' and handled_at is null`) === 0 && n(`select 1 from admin_notifications where ref_id = '${d2}'`) === 1)
  const d3 = psql(`insert into public.disputes (transaction_id, opener_id, reason, mediation_requested_at) values ('${tx}', '${CLIENT}', 'direct', now()) returning id;`)
  ok('litige créé avec intervention déjà demandée : 2 alertes', n(`select 1 from admin_notifications where ref_id = '${d3}' and handled_at is null`) === 2)

  // 7. Compteurs ------------------------------------------------------------------------------------------------------------
  const counts = JSON.parse(psql('select public.admin_alert_counts();', { role: 'authenticated', sub: ADMIN }))
  const expPay = n(`select 1 from admin_notifications where kind = 'payment_alert' and handled_at is null`)
  const expGr = n(`select 1 from admin_notifications where kind = 'payment_alert' and handled_at is null and detail->>'gravite' = 'grave'`)
  ok(`admin_alert_counts (admin) : paiements ${counts.paiements}, graves ${counts.paiements_graves}, litiges ${counts.litiges}, médiation ${counts.mediation}`,
    counts.version === 62 && counts.paiements === expPay && counts.paiements_graves === expGr && counts.litiges === 4 && counts.mediation === 2 && expPay === 15, JSON.stringify(counts))

  // 8. L'insertion dans admin_notifications échoue : l'opération principale passe quand même ----------------------------------
  psql('alter table public.admin_notifications rename to admin_notifications_hors_service;')
  const a = psql(`insert into public.payment_alerts (provider_id, kind) values ('${PRO}', 'cancel_after_arrival') returning id;`, { expectError: true })
  ok('alerte de paiement enregistrée malgré une table d\'alertes absente', a.ok && n(`select 1 from public.payment_alerts where id = '${a.out}'`) === 1, a.err.slice(0, 150))
  const nr = psql(`select public._cx_alert('${PRO}', 'provider_no_show', '{}'); select count(*) from public.payment_alerts where kind = 'provider_no_show';`, { expectError: true })
  ok('_cx_alert (annulation, absence) passe malgré la panne', nr.ok && nr.out.split('\n').pop() === '2', nr.err.slice(0, 150))
  const dd = psql(`insert into public.disputes (transaction_id, opener_id, reason) values ('${tx}', '${CLIENT}', 'panne') returning id;`, { expectError: true })
  ok('litige ouvert malgré la panne', dd.ok && n(`select 1 from public.disputes where id = '${dd.out}'`) === 1, dd.err.slice(0, 150))
  const up = psql(`update public.disputes set status = 'resolved', closed_at = now() where id = '${dd.out}';`, { expectError: true })
  ok('litige clos malgré la panne', up.ok)
  const hd = psql(`update public.payment_alerts set handled_at = now() where id = '${a.out}';`, { expectError: true })
  ok('alerte marquée traitée malgré la panne', hd.ok)
  psql('alter table public.admin_notifications_hors_service rename to admin_notifications;')
  // Autre panne : contrainte qui refuse la ligne (au lieu d'une table absente).
  psql(`alter table public.admin_notifications add constraint test_refus check (title <> 'Prestataire absent déclaré') not valid;`)
  const b = psql(`insert into public.payment_alerts (provider_id, kind) values ('${PRO}', 'provider_no_show') returning id;`, { expectError: true })
  ok('alerte de paiement enregistrée malgré un refus d\'écriture dans admin_notifications', b.ok && n(`select 1 from public.payment_alerts where id = '${b.out}'`) === 1
    && n(`select 1 from admin_notifications where ref_id = '${b.out}'`) === 0, b.err.slice(0, 150))

  // 9. La pastille des pièces (057) n'est pas touchée -----------------------------------------------------------------------------
  psql(`insert into public.documents (owner_id, kind, storage_path) values ('${PRO}', 'rcpro', 'x/y.pdf');`)
  ok('057 intacte : la pièce déposée crée toujours son alerte', n(`select 1 from admin_notifications where kind = 'document_pending' and handled_at is null`) === 1)
  const c2 = JSON.parse(psql('select public.admin_alert_counts();', { role: 'authenticated', sub: ADMIN }))
  ok('compteurs séparés : documents 1, distinct des paiements', c2.documents === 1 && c2.paiements !== c2.documents)
}

main().catch(e => { nKo++; console.log('KO   exception : ' + e.message) }).finally(() => {
  try { sh(BIN + '/pg_ctl', ['-D', data, '-m', 'fast', 'stop']) } catch (e) { }
  try { fs.rmSync(dir, { recursive: true, force: true }) } catch (e) { }
  console.log(`\n${nOk} OK, ${nKo} KO`)
  process.exit(nKo ? 1 : 0)
})
