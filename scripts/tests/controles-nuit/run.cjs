// Test de la migration 061 (contrôles de nuit) sur un PostgreSQL 16 local jetable : initdb + pg_ctl sur un port libre,
// schéma minimal imitant Supabase (auth.uid(), rôles anon/authenticated/service_role, droits par défaut larges, pg_cron factice).
//   node scripts/tests/controles-nuit/run.cjs
// Ignoré proprement si les binaires PostgreSQL 16 sont absents. Aucune base de production n'est touchée.
const fs = require('fs'), path = require('path'), os = require('os'), net = require('net')
const { execFileSync, spawnSync } = require('child_process')

const BIN = process.env.PG_BIN || '/usr/lib/postgresql/16/bin'
if (!fs.existsSync(path.join(BIN, 'initdb'))) { console.log('PostgreSQL 16 absent : test ignoré'); process.exit(0) }
const root = path.join(__dirname, '../../..')
const MIG = fs.readFileSync(path.join(root, 'supabase/migrations/061_controles_nocturnes.sql'), 'utf8')

let uid, gid
if (process.getuid && process.getuid() === 0) {
  try { uid = Number(execFileSync('id', ['-u', 'postgres']).toString()); gid = Number(execFileSync('id', ['-g', 'postgres']).toString()) } catch (e) { console.log('utilisateur postgres absent : test ignoré'); process.exit(0) }
}
const dir = fs.mkdtempSync(path.join(process.env.CTL_TMP || os.tmpdir(), 'pgctl-'))
if (uid !== undefined) fs.chownSync(dir, uid, gid)
const data = path.join(dir, 'data'), sock = dir

const freePort = () => new Promise(res => { const s = net.createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => res(p)) }) })
const sh = (cmd, args, extra = {}) => spawnSync(cmd, args, { encoding: 'utf8', uid, gid, ...extra })
let PORT, extFiles = []

function psql(sql, { role, sub, expectError } = {}) {
  const pre = (sub !== undefined ? `set request.jwt.claim.sub = '${sub}';\n` : '') + (role ? `set role ${role};\n` : '')
  const r = sh(BIN + '/psql', ['-h', sock, '-p', String(PORT), '-U', 'postgres', '-d', 'ping', '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1'], { input: pre + sql })
  if (expectError) return { ok: r.status === 0, err: (r.stderr || '') }
  if (r.status !== 0) throw new Error('SQL en erreur : ' + (r.stderr || '').trim() + '\n' + sql.slice(0, 300))
  return r.stdout.trim()
}

let nOk = 0, nKo = 0
const ok = (name, cond, extra) => { if (cond) { nOk++; console.log('OK   ' + name) } else { nKo++; console.log('KO   ' + name + (extra ? ' : ' + extra : '')) } }

// Lance les contrôles et renvoie les lignes de ce passage : [{controle, gravite, titre, detail}]
function run() {
  const id = psql("select public.run_nightly_controls()->>'run_id';")
  const out = psql(`select coalesce(json_agg(json_build_object('controle', c.controle, 'gravite', c.gravite, 'titre', c.titre, 'detail', c.detail) order by c.controle, c.titre), '[]')
    from public.controles_resultats c where c.run_id = '${id}';`)
  return JSON.parse(out)
}
const of = (rows, c) => rows.filter(x => x.controle === c)
const grav = (rows, c) => of(rows, c).map(x => x.gravite).sort().join(',')

const SETUP = `
create role anon nologin; create role authenticated nologin; create role service_role nologin;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text, created_at timestamptz default now());
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
-- Droits par défaut de Supabase : tout pour anon, authenticated, service_role.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;

create table public.admins (user_id uuid primary key);
create function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$ select exists (select 1 from public.admins where user_id = auth.uid()) $$;

create table public.profiles (id uuid primary key, full_name text);
create table public.provider_private (id uuid primary key);
create table public.provider_profiles (id uuid primary key);
create table public.services (id uuid primary key);
create table public.messages (id uuid primary key default gen_random_uuid());
create table public.avance_immediate_demandes (id uuid primary key default gen_random_uuid());
create table public.app_settings (key text primary key, value jsonb);
create table public.events (id uuid primary key default gen_random_uuid(), name text);
create table public.notification_log (id uuid primary key default gen_random_uuid());
create table public.payment_alerts (id uuid primary key default gen_random_uuid());
create table public.requests (id uuid primary key default gen_random_uuid(), title text, fictif boolean not null default false);
create table public.transactions (id uuid primary key default gen_random_uuid(), request_id uuid, buyer_id uuid, seller_id uuid, status text,
  arrived_at timestamptz, subtotal_cents int, buyer_fee_cents int, total_charged_cents int, booking_status text default 'acceptee',
  accept_deadline timestamptz, fictif boolean not null default false);
create table public.invoices (id uuid primary key default gen_random_uuid(), transaction_id uuid, kind text);
create table public.transfer_payments (id uuid primary key default gen_random_uuid(), invoice_id uuid, transaction_id uuid, suspended_at timestamptz);
create table public.disputes (id uuid primary key default gen_random_uuid(), transaction_id uuid, status text default 'open', created_at timestamptz default now());
create table public.documents (id uuid primary key default gen_random_uuid(), owner_id uuid, status text, valid_until date);
create table public.commission_debts (id uuid primary key default gen_random_uuid(), provider_id uuid, amount_cents int, status text default 'open');
create table public.admin_notifications (id uuid primary key default gen_random_uuid(), kind text not null, user_id uuid, ref_id uuid, title text not null,
  detail jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), handled_at timestamptz, emailed_at timestamptz);
create function public.providers_nearby(p_lat float8) returns int language sql security definer as $$ select 1 $$;
create function public.secret_fn() returns int language sql security definer as $$ select 1 $$;
`
// État de base « sain » : on resserre les droits comme la production le vise.
const BASELINE = `
do $$ declare t record; begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end $$;
revoke all on all tables in schema public from anon;
revoke truncate, references, trigger on all tables in schema public from authenticated;
grant select on public.provider_profiles, public.services, public.app_settings to anon;
grant insert on public.events to anon;
revoke execute on function public.secret_fn() from public, anon, authenticated;
`
const CRON_EXT = `
comment on schema public is 'test';
create extension pg_cron;
`

async function main() {
  PORT = await freePort()
  let r = sh(BIN + '/initdb', ['-D', data, '-A', 'trust', '-U', 'postgres', '--no-sync', '-E', 'UTF8'])
  if (r.status !== 0) { console.log('initdb impossible : ' + r.stderr); process.exit(0) }
  r = sh(BIN + '/pg_ctl', ['-D', data, '-w', '-l', path.join(dir, 'log'), '-o', `-p ${PORT} -k ${sock} -c listen_addresses=''`, 'start'])
  if (r.status !== 0) { console.log('pg_ctl impossible : ' + r.stderr + fs.readFileSync(path.join(dir, 'log'), 'utf8').slice(-300)); process.exit(0) }
  sh(BIN + '/createdb', ['-h', sock, '-p', String(PORT), '-U', 'postgres', 'ping'])

  // pg_cron factice : même nom d'extension, mêmes tables (cron.job, cron.job_run_details), fonction cron.schedule.
  const ext = path.join(execFileSync(BIN + '/pg_config', ['--sharedir']).toString().trim(), 'extension')
  let cronOk = false
  try {
    fs.writeFileSync(path.join(ext, 'pg_cron.control'), "default_version = '1.0'\nrelocatable = false\nschema = cron\ncomment = 'faux pg_cron pour test'\n")
    fs.writeFileSync(path.join(ext, 'pg_cron--1.0.sql'), `
      create table cron.job (jobid bigserial primary key, jobname text, schedule text, command text);
      create table cron.job_run_details (runid bigserial primary key, jobid bigint, status text, start_time timestamptz);
      create function cron.schedule(job_name text, sched text, cmd text) returns bigint language sql as $f$
        insert into cron.job (jobname, schedule, command) values (job_name, sched, cmd) returning jobid $f$;`)
    extFiles = [path.join(ext, 'pg_cron.control'), path.join(ext, 'pg_cron--1.0.sql')]
    cronOk = true
  } catch (e) { console.log('pg_cron factice impossible (' + e.message + ') : tests cron ignorés') }

  psql(SETUP)
  if (cronOk) psql('create extension pg_cron;')

  // 1. Migration collée deux fois, sans erreur --------------------------------------------------------------------------------
  psql(MIG); ok('migration collée une première fois sans erreur', true)
  psql(MIG); ok('migration collée une deuxième fois sans erreur', true)
  if (cronOk) ok('tâche ping_controles_nuit planifiée une seule fois à 3 h 17', psql("select count(*) || '|' || min(schedule) from cron.job where jobname = 'ping_controles_nuit'") === '1|17 3 * * *')
  ok('aucun mot de suppression dans la migration', !/\b(drop|delete)\b/i.test(MIG) && !/drop|delet/i.test(MIG))

  // 2. Droits de la table de résultats -------------------------------------------------------------------------------------------
  const priv = psql(`select string_agg(r.rolname || ':' || p, ',' order by r.rolname, p) from pg_roles r cross join unnest(array['SELECT','INSERT','UPDATE','TRUNCATE','REFERENCES','TRIGGER']) p
     where r.rolname in ('anon','authenticated') and has_table_privilege(r.rolname, 'public.controles_resultats', p)`)
  ok('controles_resultats : seul authenticated:SELECT reste (aucun droit pour anon, aucune écriture, aucun TRUNCATE)', priv === 'authenticated:SELECT', priv)
  ok('controles_reference : seul authenticated:SELECT reste', psql(`select count(*) from pg_roles r cross join unnest(array['SELECT','INSERT','UPDATE','TRUNCATE','REFERENCES','TRIGGER']) p
     where r.rolname in ('anon','authenticated') and has_table_privilege(r.rolname, 'public.controles_reference', p) and not (r.rolname = 'authenticated' and p = 'SELECT')`) === '0')

  // Base saine : on resserre les droits, on déclare les tâches, puis premier passage ---------------------------------------------------
  psql(BASELINE)
  if (cronOk) psql(`insert into cron.job (jobname, schedule, command) values ('ping_reservations_expirees','*/10 * * * *','x'), ('ping_virements_en_retard','23 6 * * *','x'), ('ping_pieces_expirees','41 6 * * *','x');
     insert into cron.job_run_details (jobid, status, start_time) select jobid, 'succeeded', now() - interval '2 hours' from cron.job;`)
  psql(`insert into public.admins values ('aaaaaaaa-0000-0000-0000-000000000001')`)
  const ADMIN = 'aaaaaaaa-0000-0000-0000-000000000001', USER = 'bbbbbbbb-0000-0000-0000-000000000002'

  let rows = run()
  if (process.env.CTL_DEBUG) console.log(JSON.stringify(rows.map(x => [x.controle, x.gravite, x.titre])))
  const rouges = rows.filter(x => x.gravite === 'rouge').length
  ok('base saine : aucun rouge', rouges === 0, JSON.stringify(rows.filter(x => x.gravite !== 'vert').map(x => x.controle + ':' + x.titre)))
  const oranges = rows.filter(x => x.gravite === 'orange').map(x => x.controle)
  ok('base saine : seule la sauvegarde est orange (' + oranges.join(',') + ')', oranges.join(',') === 'sauvegarde', oranges.join(','))
  ok('première exécution : référence du schéma enregistrée', of(rows, 'derive_schema')[0].titre.startsWith('Référence initiale'))
  ok('base saine : 15 contrôles distincts écrits', new Set(rows.map(x => x.controle)).size >= 15, String(new Set(rows.map(x => x.controle)).size))
  ok('base saine : pas d\'alerte admin (la sauvegarde seule n\'alerte pas)', psql("select count(*) from public.admin_notifications where kind = 'controle_nuit'") === '0')
  rows = run()
  ok('deuxième passage : schéma identique (vert)', grav(rows, 'derive_schema') === 'vert' && of(rows, 'derive_schema')[0].titre.startsWith('Le schéma est identique'))

  // 3. Un cas rouge ou orange par contrôle, puis retour au vert ---------------------------------------------------------------------------
  // Contrôle 1 : droits de anon
  psql('grant select on public.profiles to anon;')
  rows = run(); ok('1. anon lit profiles : rouge, ligne détaillée avec la table', of(rows, 'droits_anon').some(x => x.gravite === 'rouge' && x.detail.table === 'profiles'))
  psql('revoke select on public.profiles from anon; grant insert on public.provider_profiles to anon;')
  rows = run(); ok('1. anon écrit dans une table publique : rouge', of(rows, 'droits_anon').some(x => x.gravite === 'rouge' && x.detail.table === 'provider_profiles'))
  psql('revoke insert on public.provider_profiles from anon; grant select on public.avance_immediate_demandes to anon;')
  rows = run(); ok('1. anon lit avance_immediate_demandes (motif) : rouge', of(rows, 'droits_anon').some(x => x.gravite === 'rouge' && x.detail.table === 'avance_immediate_demandes'))
  psql('revoke select on public.avance_immediate_demandes from anon; grant select on public.invoices to anon; grant insert, update on public.events to anon;')
  rows = run()
  ok('1. anon lit invoices : rouge', of(rows, 'droits_anon').some(x => x.gravite === 'rouge' && x.detail.table === 'invoices'))
  ok('1. events : insertion + modification par anon : rouge (seule l\'insertion est permise)', of(rows, 'droits_anon').some(x => x.gravite === 'rouge' && x.detail.table === 'events'))
  psql('revoke all on public.invoices from anon; revoke update on public.events from anon; create table public.lecture_bizarre (id int); alter table public.lecture_bizarre enable row level security; revoke all on public.lecture_bizarre from anon, authenticated; grant select on public.lecture_bizarre to anon;')
  rows = run(); ok('1. table non listée lisible par anon : orange', of(rows, 'droits_anon').some(x => x.gravite === 'orange' && x.detail.table === 'lecture_bizarre'))
  psql('revoke all on public.lecture_bizarre from anon; alter table public.lecture_bizarre disable row level security;')
  psql('alter table public.lecture_bizarre enable row level security;')
  rows = run(); ok('1. retour au vert', grav(rows, 'droits_anon') === 'vert', JSON.stringify(of(rows, 'droits_anon')))

  // Contrôle 2 : TRUNCATE, TRIGGER, REFERENCES
  psql('grant truncate on public.provider_profiles to authenticated; grant references on public.profiles to anon;')
  rows = run(); ok('2. TRUNCATE pour authenticated, REFERENCES pour anon : rouge (2 droits)', of(rows, 'droits_dangereux')[0].gravite === 'rouge' && of(rows, 'droits_dangereux')[0].detail.nombre === 2, JSON.stringify(of(rows, 'droits_dangereux')))
  psql('revoke truncate on public.provider_profiles from authenticated; revoke references on public.profiles from anon;')
  rows = run(); ok('2. retour au vert', grav(rows, 'droits_dangereux') === 'vert')

  // Contrôle 3 : RLS et règles ouvertes
  psql('alter table public.services disable row level security;')
  rows = run(); ok('3. table sans sécurité par ligne : rouge', of(rows, 'rls_active')[0].gravite === 'rouge' && of(rows, 'rls_active')[0].detail.tables.includes('services'))
  psql('alter table public.services enable row level security; create policy ouverte on public.messages for select using (true); create policy anon_ecrit on public.invoices for insert to anon with check (true);')
  rows = run()
  ok('3. règle « true » pour tout le monde sur messages : rouge', of(rows, 'rls_regles_ouvertes').some(x => x.gravite === 'rouge' && x.detail.table === 'messages'))
  ok('3. règle « true » pour anon sur invoices (écriture) : rouge', of(rows, 'rls_regles_ouvertes').some(x => x.gravite === 'rouge' && x.detail.table === 'invoices'))
  psql('create policy lecture_pub on public.services for select using (true);')
  rows = run(); ok('3. règle « true » sur une table publique (services) : pas signalée', !of(rows, 'rls_regles_ouvertes').some(x => x.detail.table === 'services'))
  psql('alter policy ouverte on public.messages using (false); alter policy anon_ecrit on public.invoices with check (false);')
  rows = run(); ok('3. retour au vert', grav(rows, 'rls_regles_ouvertes') === 'vert' && grav(rows, 'rls_active') === 'vert')

  // Contrôle 4 : fonctions SECURITY DEFINER exécutables par anon
  psql('grant execute on function public.secret_fn() to anon;')
  rows = run(); ok('4. fonction SECURITY DEFINER exécutable par anon hors liste blanche : orange, nommée', of(rows, 'fonctions_anon')[0].gravite === 'orange' && of(rows, 'fonctions_anon')[0].detail.fonctions.includes('secret_fn') && !of(rows, 'fonctions_anon')[0].detail.fonctions.includes('providers_nearby'))
  psql('revoke execute on function public.secret_fn() from anon;')
  rows = run(); ok('4. retour au vert (providers_nearby et is_admin en liste blanche)', grav(rows, 'fonctions_anon') === 'vert')

  // Contrôle 5 : intégrité métier
  const T = (n) => `cccccccc-0000-0000-0000-00000000000${n}`
  psql(`
    insert into public.transactions (id, buyer_id, seller_id, status, arrived_at, subtotal_cents, buyer_fee_cents, total_charged_cents) values
     ('${T(1)}', '${USER}', 'dddddddd-0000-0000-0000-000000000001', 'completed', null, 10000, 800, 10800),        -- sans arrivée
     ('${T(2)}', '${USER}', '${USER}', 'pending', null, null, null, null),                                          -- acheteur = vendeur
     ('${T(3)}', '${USER}', 'dddddddd-0000-0000-0000-000000000001', 'completed', now(), 10000, 800, 9000),          -- total faux
     ('${T(4)}', '${USER}', 'dddddddd-0000-0000-0000-000000000001', 'completed', now(), 10000, 800, 10800);         -- bon total, factures à poser
    insert into public.invoices (transaction_id, kind) select '${T(4)}', k from unnest(array['prestation','commission_client']) k;   -- 2 lignes seulement
    insert into public.invoices (id, transaction_id, kind) values ('eeeeeeee-0000-0000-0000-000000000001', '${T(1)}', 'prestation');
    insert into public.transfer_payments (transaction_id, invoice_id, suspended_at) values ('${T(4)}', 'eeeeeeee-0000-0000-0000-000000000099', now()), ('${T(1)}', 'eeeeeeee-0000-0000-0000-000000000001', now());
    insert into public.disputes (transaction_id, status, created_at) values ('${T(3)}', 'open', now() - interval '9 days');
    insert into public.transactions (id, buyer_id, seller_id, status, booking_status, accept_deadline) values ('${T(5)}', '${USER}', 'dddddddd-0000-0000-0000-000000000001', 'pending', 'en_attente', now() - interval '3 hours');
    insert into public.documents (owner_id, status, valid_until) values ('${USER}', 'valid', current_date - 3), ('${USER}', 'valid', current_date + 30);
    insert into public.commission_debts (provider_id, amount_cents) values ('dddddddd-0000-0000-0000-000000000001', 4000), ('dddddddd-0000-0000-0000-000000000001', 3000), ('dddddddd-0000-0000-0000-000000000002', 500);
  `)
  rows = run()
  const one = (c, g, pred) => of(rows, c).length === 1 && of(rows, c)[0].gravite === g && (!pred || pred(of(rows, c)[0]))
  ok('5. mission terminée sans arrivée : orange', one('integrite_arrivee', 'orange', x => x.detail.nombre === 1 && x.detail.ids[0] === T(1)), JSON.stringify(of(rows, 'integrite_arrivee')))
  ok('5. acheteur = vendeur : rouge', one('integrite_acheteur_vendeur', 'rouge', x => x.detail.ids[0] === T(2)))
  ok('5. total ≠ prestation + frais : orange (1 seule mission fautive)', one('integrite_total', 'orange', x => x.detail.nombre === 1 && x.detail.ids[0] === T(3)), JSON.stringify(of(rows, 'integrite_total')))
  ok('5. terminée sans exactement 3 factures : rouge (missions 1, 3 et 4)', one('integrite_factures', 'rouge', x => x.detail.nombre === 3), JSON.stringify(of(rows, 'integrite_factures')))
  ok('5. virement sans facture : rouge', one('integrite_virements', 'rouge', x => x.detail.nombre === 1))
  ok('5. virement suspendu sans litige ouvert : orange (mission 4 ; la mission 1 n\'a pas de litige non plus)', one('integrite_suspension', 'orange', x => x.detail.nombre === 2))
  ok('5. litige ouvert depuis 9 jours : orange', one('integrite_litiges', 'orange', x => x.detail.nombre === 1))
  ok('5. réservation en attente dépassée de 3 h : orange', one('integrite_reservations', 'orange', x => x.detail.ids[0] === T(5)))
  ok('5. pièce validée échue : orange (1 sur 2)', one('integrite_pieces', 'orange', x => x.detail.nombre === 1))
  ok('5. dettes au-dessus du plafond (7 000 > 5 000 par défaut) : orange (1 prestataire)', one('integrite_dettes', 'orange', x => x.detail.nombre === 1))
  ok('alerte admin créée : 1 ligne « controle_nuit » (rouge compté)', psql("select count(*) from public.admin_notifications where kind = 'controle_nuit' and handled_at is null") === '1')
  const al1 = psql("select detail->>'rouge' from public.admin_notifications where kind = 'controle_nuit'")
  rows = run()
  ok('alerte : une seule alerte ouverte par jour même après un deuxième passage', psql("select count(*) from public.admin_notifications where kind = 'controle_nuit' and handled_at is null") === '1' && Number(al1) >= 3, al1)
  ok('aucune donnée personnelle dans les résultats (ni e-mail, ni nom : seulement ids et nombres)', !/@/.test(JSON.stringify(rows)))
  // retour au vert
  psql(`update public.transfer_payments set suspended_at = null; truncate public.transfer_payments, public.invoices, public.disputes, public.documents, public.commission_debts, public.transactions;`)
  rows = run()
  ok('5. retour au vert : tous les contrôles d\'intégrité sont verts', rows.filter(x => x.controle.startsWith('integrite_')).every(x => x.gravite === 'vert'), JSON.stringify(rows.filter(x => x.controle.startsWith('integrite_') && x.gravite !== 'vert')))

  // Contrôle 6 : cron
  if (cronOk) {
    psql("delete from cron.job where jobname = 'ping_pieces_expirees';")
    rows = run(); ok('6. tâche planifiée absente : orange, nommée', of(rows, 'cron').some(x => x.gravite === 'orange' && x.detail.tache === 'ping_pieces_expirees'))
    psql("insert into cron.job (jobname, schedule, command) values ('ping_pieces_expirees','41 6 * * *','x'); update cron.job_run_details set start_time = now() - interval '2 days' where jobid = (select jobid from cron.job where jobname = 'ping_virements_en_retard');")
    rows = run(); ok('6. dernière réussite il y a 2 jours : orange', of(rows, 'cron').some(x => x.gravite === 'orange' && x.detail.tache === 'ping_virements_en_retard'))
    psql("update cron.job_run_details set status = 'failed' where jobid = (select jobid from cron.job where jobname = 'ping_reservations_expirees');")
    rows = run(); ok('6. dernière exécution en échec seulement : orange', of(rows, 'cron').some(x => x.gravite === 'orange' && x.detail.tache === 'ping_reservations_expirees'))
    psql("update cron.job_run_details set status = 'succeeded', start_time = now() - interval '1 hour'; insert into cron.job_run_details (jobid, status, start_time) select jobid, 'succeeded', now() from cron.job where jobname = 'ping_pieces_expirees';")
    rows = run(); ok('6. retour au vert', grav(rows, 'cron') === 'vert', JSON.stringify(of(rows, 'cron')))
  }

  // Contrôle 7 : données de test
  psql(`insert into public.requests (title, fictif) values ('QA ménage test', false), ('QA autre', true);
        insert into auth.users (email, created_at) values ('qa.x@qa.ping-test.invalid', now() - interval '40 days'), ('audit@ping-demo.invalid', now() - interval '90 days'), ('neuf@qa.ping-test.invalid', now());`)
  rows = run(); ok('7. demande QA non fictive + compte .invalid ancien : orange, comptés (1 demande, 1 compte)', of(rows, 'donnees_test')[0].gravite === 'orange' && of(rows, 'donnees_test')[0].detail.demandes_qa === 1 && of(rows, 'donnees_test')[0].detail.comptes_invalid_anciens === 1, JSON.stringify(of(rows, 'donnees_test')))
  psql('truncate public.requests; truncate auth.users;')
  rows = run(); ok('7. retour au vert', grav(rows, 'donnees_test') === 'vert')

  // Contrôle 8 : volume
  psql("insert into public.events (name) select 'x' from generate_series(1, 500001);")
  rows = run(); ok('8. 500 001 lignes dans events : orange, dépassement nommé', of(rows, 'volume')[0].gravite === 'orange' && /events/.test(JSON.stringify(of(rows, 'volume')[0].detail.depassements)))
  psql('truncate public.events;')
  rows = run(); ok('8. retour au vert', grav(rows, 'volume') === 'vert')

  // Contrôle 9 : dérive du schéma (on part d'une référence à jour : les tables et règles de test ci-dessus sont acceptées)
  psql('select public.accept_schema_reference();', { role: 'authenticated', sub: ADMIN })
  psql('alter table public.services add column nouveau text;')
  rows = run(); ok('9. colonne ajoutée : orange, partie « colonnes » désignée', of(rows, 'derive_schema')[0].gravite === 'orange' && of(rows, 'derive_schema')[0].detail.parties_changees.join() === 'colonnes', JSON.stringify(of(rows, 'derive_schema')))
  const refus = psql('select public.accept_schema_reference();', { role: 'authenticated', sub: USER, expectError: true })
  ok('9. accept_schema_reference refusée à un non-admin', !refus.ok && /Réservé/.test(refus.err), refus.err)
  const refusAnon = psql('select public.accept_schema_reference();', { role: 'anon', expectError: true })
  ok('9. accept_schema_reference refusée à anon (droit retiré)', !refusAnon.ok && /permission denied/.test(refusAnon.err), refusAnon.err)
  psql('select public.accept_schema_reference();', { role: 'authenticated', sub: ADMIN })
  rows = run(); ok('9. après acceptation par l\'admin : vert', grav(rows, 'derive_schema') === 'vert')
  psql('create policy nouvelle on public.provider_profiles for select using (true);')
  rows = run(); ok('9. nouvelle règle : orange, partie « regles »', of(rows, 'derive_schema')[0].gravite === 'orange' && of(rows, 'derive_schema')[0].detail.parties_changees.join() === 'regles')
  psql('select public.accept_schema_reference();', { role: 'authenticated', sub: ADMIN })

  // Contrôle 10 : sauvegarde
  const refusAck = psql("select public.acknowledge_control('sauvegarde');", { role: 'authenticated', sub: USER, expectError: true })
  ok('10. acquittement refusé à un non-admin', !refusAck.ok && /Réservé/.test(refusAck.err))
  const refusAck2 = psql("select public.acknowledge_control('cron');", { role: 'authenticated', sub: ADMIN, expectError: true })
  ok('10. seul le contrôle « sauvegarde » s\'acquitte', !refusAck2.ok && /ne s'acquitte pas/.test(refusAck2.err))
  psql("select public.acknowledge_control('sauvegarde');", { role: 'authenticated', sub: ADMIN })
  rows = run(); ok('10. sauvegarde acquittée : vert, acquittee_le renseignée', grav(rows, 'sauvegarde') === 'vert' && psql("select count(*) from public.controles_resultats where controle = 'sauvegarde' and acquittee_le is not null") >= '1')
  psql("update public.controles_reference set mis_a_jour = now() - interval '100 days' where cle = 'ack:sauvegarde';")
  rows = run(); ok('10. acquittement vieux de 100 jours : de nouveau orange', grav(rows, 'sauvegarde') === 'orange')

  // Tolérance : une table absente donne orange sans casser les autres contrôles
  psql('alter table public.disputes rename to disputes_x;')
  rows = run()
  ok('tolérance : table disputes absente : contrôles litiges et suspension en orange avec le message', grav(rows, 'integrite_litiges') === 'orange' && /impossible/.test(of(rows, 'integrite_litiges')[0].titre) && grav(rows, 'integrite_suspension') === 'orange')
  ok('tolérance : les autres contrôles tournent quand même (droits, rls, cron...)', grav(rows, 'droits_anon') === 'vert' && grav(rows, 'rls_active') === 'vert' && grav(rows, 'integrite_pieces') === 'vert')
  psql('alter table public.disputes_x rename to disputes;')
  psql('alter table public.admin_notifications rename to admin_notifications_x; insert into public.requests (title) values (\'x\');')
  psql(`insert into public.transactions (buyer_id, seller_id, status) values ('${USER}', '${USER}', 'pending');`)
  rows = run(); ok('tolérance : file d\'alertes absente : ligne « alerte_admin » orange, le reste continue', grav(rows, 'alerte_admin') === 'orange' && grav(rows, 'integrite_acheteur_vendeur') === 'rouge')
  psql('alter table public.admin_notifications_x rename to admin_notifications; truncate public.transactions;')

  // 4. Qui peut exécuter / lire ----------------------------------------------------------------------------------------------------------
  const a = psql('select public.run_nightly_controls();', { role: 'authenticated', sub: ADMIN, expectError: true })
  ok('exécution refusée à authenticated (même admin)', !a.ok && /permission denied/.test(a.err), a.err)
  const b = psql('select public.run_nightly_controls();', { role: 'anon', expectError: true })
  ok('exécution refusée à anon', !b.ok && /permission denied/.test(b.err))
  const c = psql('select (public.run_nightly_controls()->>\'run_id\') is not null;', { role: 'service_role' })
  ok('exécution autorisée à service_role', c === 't', c)
  const d = psql('select public._ctl_put(gen_random_uuid(), \'x\', \'vert\', \'x\');', { role: 'authenticated', sub: ADMIN, expectError: true })
  ok('fonction interne _ctl_put refusée à authenticated', !d.ok && /permission denied/.test(d.err))
  const nonAdminRead = psql('select count(*) from public.controles_resultats;', { role: 'authenticated', sub: USER })
  const adminRead = psql('select count(*) from public.controles_resultats;', { role: 'authenticated', sub: ADMIN })
  ok('lecture : un non-admin voit 0 ligne, l\'admin voit les résultats (' + adminRead + ')', nonAdminRead === '0' && Number(adminRead) > 50)
  for (const [nm, sql] of [['INSERT', "insert into public.controles_resultats (run_id, controle, gravite) values (gen_random_uuid(), 'x', 'vert')"],
                            ['UPDATE', "update public.controles_resultats set gravite = 'vert'"],
                            ['TRUNCATE', 'truncate public.controles_resultats'],
                            ['lecture par anon', 'select count(*) from public.controles_resultats']]) {
    const e = psql(sql, { role: nm === 'lecture par anon' ? 'anon' : 'authenticated', sub: ADMIN, expectError: true })
    ok('controles_resultats : ' + nm + ' refusé (admin connecté compris)', !e.ok && /permission denied/.test(e.err), e.err)
  }
  const e2 = psql("insert into public.controles_reference (cle) values ('x')", { role: 'authenticated', sub: ADMIN, expectError: true })
  ok('controles_reference : écriture directe refusée', !e2.ok && /permission denied/.test(e2.err))
  const wrongGrav = psql("insert into public.controles_resultats (run_id, controle, gravite) values (gen_random_uuid(), 'x', 'bleu')", { expectError: true })
  ok('gravité hors vert/orange/rouge refusée par la contrainte', !wrongGrav.ok && /check/.test(wrongGrav.err))
}

main().catch(e => { console.log('ERREUR : ' + e.stack); nKo++ }).finally(() => {
  try { sh(BIN + '/pg_ctl', ['-D', data, '-m', 'immediate', 'stop']) } catch (e) { }
  for (const f of extFiles) { try { fs.unlinkSync(f) } catch (e) { } }
  try { fs.rmSync(dir, { recursive: true, force: true }) } catch (e) { }
  console.log(`\n${nOk} OK, ${nKo} KO`)
  process.exit(nKo ? 1 : 0)
})
