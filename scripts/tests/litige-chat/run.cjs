// Test de la migration 059b (litige miroir dans le chat, PING écrit dans la conversation, liste admin) sur un
// PostgreSQL local, schéma minimal.   node scripts/tests/litige-chat/run.cjs
// Variable PGTEST_DSN (sinon : serveur local, utilisateur postgres). Ignoré proprement si PostgreSQL est absent.
const fs = require('fs'), path = require('path')
const { execFileSync, spawnSync } = require('child_process')
const root = path.join(__dirname, '../../..')
const out = path.join(__dirname, '.build'); fs.mkdirSync(out, { recursive: true })
const dsn = process.env.PGTEST_DSN
let uid
if (!dsn && process.getuid && process.getuid() === 0) { try { uid = Number(execFileSync('id', ['-u', 'postgres']).toString()) } catch (e) { uid = undefined } }
if (uid !== undefined) fs.chmodSync(out, 0o755)
const base = dsn ? [dsn] : ['-d', 'postgres']
const probe = spawnSync('psql', [...base, '-X', '-c', 'select 1'], { encoding: 'utf8', uid })
if (probe.status !== 0) { console.log('PostgreSQL local indisponible : test ignoré'); process.exit(0) }

const A = '11111111-1111-1111-1111-111111111111', P = '22222222-2222-2222-2222-222222222222', X = '33333333-3333-3333-3333-333333333333'
const TX = '44444444-4444-4444-4444-444444444444', TX2 = '55555555-5555-5555-5555-555555555555', D = '66666666-6666-6666-6666-666666666666'
const mig = fs.readFileSync(path.join(root, 'supabase/migrations/059b_litige_miroir_chat.sql'), 'utf8').replace(/public\./g, '').replace(/search_path = public/g, 'search_path = vtest, public')
const as = u => `select set_config('request.jwt.claim.sub', '${u}', false); set role authenticated;`
const back = "reset role; select set_config('request.jwt.claim.sub', '', false);"
const check = (name, cond) => `do $$ begin if (${cond}) then raise notice 'RES|OK|${name}|'; else raise notice 'RES|KO|${name}|condition fausse'; end if; end $$;`
const expectErr = (name, sql) => `do $$ begin ${sql}; raise notice 'RES|KO|${name}|aucune erreur'; exception when others then raise notice 'RES|OK|${name}|%', sqlerrm; end $$;`

const sql = `
drop schema if exists vtest cascade; create schema vtest; set search_path = vtest, public;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create table admins(id uuid primary key);
create or replace function is_admin() returns boolean language sql stable as $$ select exists (select 1 from admins where id = auth.uid()) $$;
create table profiles(id uuid primary key, full_name text);
create table requests(id uuid primary key, category text);
create table transactions(id uuid primary key, buyer_id uuid, seller_id uuid, request_id uuid, status text default 'pending', created_at timestamptz default now());
create table messages(id uuid primary key default gen_random_uuid(), transaction_id uuid, sender_id uuid not null, kind text check (kind in ('text','offer','system')), body text, created_at timestamptz default now());
create table disputes(id uuid primary key, transaction_id uuid, status text default 'open', mediation_requested_at timestamptz, created_at timestamptz default now());
create table dispute_messages(id uuid primary key default gen_random_uuid(), dispute_id uuid, sender_id uuid, body text not null, kind text not null default 'text' check (kind in ('text','system','mediation')), created_at timestamptz default now());
grant usage on schema vtest, auth to authenticated; grant select, insert on all tables in schema vtest to authenticated;
insert into profiles values ('${A}', 'Alice Cliente'), ('${P}', 'Paul Prestataire'), ('${X}', 'Admin PING');
insert into admins values ('${X}');
insert into requests values ('77777777-7777-7777-7777-777777777777', 'menage');
insert into transactions values ('${TX}', '${A}', '${P}', '77777777-7777-7777-7777-777777777777'), ('${TX2}', '${P}', '${A}', null);
insert into disputes values ('${D}', '${TX}', 'open', null);
${mig}
${mig}
set search_path = vtest, public;
-- (a) miroir : sur une base où messages.kind refuse 'mediation' (cas pessimiste), repli en 'text'
insert into dispute_messages (dispute_id, sender_id, body, kind) values ('${D}', '${A}', 'Le ménage n''a pas été fait', 'text');
insert into dispute_messages (dispute_id, sender_id, body, kind) values ('${D}', '${P}', 'Je conteste', 'text');
insert into dispute_messages (dispute_id, sender_id, body, kind) values ('${D}', '${X}', 'PING examine le dossier', 'mediation');
insert into dispute_messages (dispute_id, sender_id, body, kind) values ('${D}', '${A}', 'Message système du fil', 'system');
${check('3 messages recopiés (les messages système du fil ne le sont pas)', "(select count(*) from messages where dispute_id = '" + D + "') = 3")}
${check('le message du client est recopié au nom du client, rattaché au dossier', "(select count(*) from messages where dispute_id = '" + D + "' and sender_id = '" + A + "' and body like 'Le ménage%' and transaction_id = '" + TX + "' and dispute_message_id is not null) = 1")}
${check('le message de PING est recopié (repli kind text car la contrainte refuse mediation, expéditeur admin non partie)', "(select count(*) from messages where dispute_id = '" + D + "' and sender_id = '" + X + "' and kind in ('text','mediation')) = 1")}
-- idempotence : un second trigger ne double pas (index unique)
${expectErr('un même message du litige ne peut pas être recopié deux fois', "insert into messages (transaction_id, sender_id, kind, body, dispute_message_id) select transaction_id, sender_id, 'text', 'x', dispute_message_id from messages where dispute_id = '" + D + "' limit 1")}
-- le fil du litige n'est jamais bloqué par une panne de la copie
alter table messages add constraint messages_boom check (body <> 'BOOM') not valid;
insert into dispute_messages (dispute_id, sender_id, body, kind) values ('${D}', '${A}', 'BOOM', 'text');
${check('copie impossible : le message du litige est tout de même enregistré', "(select count(*) from dispute_messages where body = 'BOOM') = 1 and (select count(*) from messages where body = 'BOOM') = 0")}
-- (b) PING écrit dans la conversation
${as(A)}
${expectErr('un client ne peut pas écrire en tant que PING', "perform admin_post_chat_message('" + TX + "', 'coucou')")}
${back}
${as(X)}
select admin_post_chat_message('${TX}', 'Bonjour, PING suit votre dossier.');
${expectErr('message vide refusé', "perform admin_post_chat_message('" + TX + "', '   ')")}
${expectErr('mission inconnue refusée', "perform admin_post_chat_message('99999999-9999-9999-9999-999999999999', 'x')")}
${back}
${check('message de PING dans la conversation, expéditeur = l admin (ni acheteur ni vendeur)', "(select count(*) from messages where transaction_id = '" + TX + "' and sender_id = '" + X + "' and body like 'Bonjour, PING suit%' and dispute_id is null) = 1")}
-- (c) liste admin
${as(P)}
${expectErr('un prestataire ne peut pas lister les conversations', "perform * from admin_conversations_list()")}
${back}
${as(X)}
create temp table l1 as select * from admin_conversations_list(null, 'all', 50);
create temp table l2 as select * from admin_conversations_list('paul', 'all', 50);
create temp table l3 as select * from admin_conversations_list(null, 'litige', 50);
create temp table l4 as select * from admin_conversations_list(null, 'mediation', 50);
create temp table l5 as select * from admin_conversations_list('menage', 'all', 50);
create temp table l6 as select * from admin_conversations_list('44444444', 'all', 50);
${back}
${check('liste complète : 2 missions, celle au litige ouvert en tête, avec noms et nombre de messages', "(select count(*) from l1) = 2 and (select transaction_id from l1 limit 1) = '" + TX + "' and (select buyer_name from l1 limit 1) = 'Alice Cliente' and (select n_messages from l1 limit 1) >= 4")}
${check('recherche par nom (paul) : trouve les 2 missions où Paul est partie', "(select count(*) from l2) = 2")}
${check('filtre « litige ouvert » : 1 mission', "(select count(*) from l3) = 1 and (select dispute_open from l3 limit 1)")}
${check('filtre « intervention de PING demandée » : aucune tant que non demandée', "(select count(*) from l4) = 0")}
${check('recherche par métier : 1 mission', "(select count(*) from l5) = 1")}
${check('recherche par début de numéro de mission : 1 mission', "(select count(*) from l6) = 1")}
update disputes set mediation_requested_at = now() where id = '${D}';
${as(X)}
create temp table l7 as select * from admin_conversations_list(null, 'mediation', 50);
${back}
${check('après la demande d intervention : filtre « intervention de PING demandée » = 1', "(select count(*) from l7) = 1 and (select mediation from l7 limit 1)")}
reset role;
drop schema vtest cascade;
`
const file = path.join(out, 'test.sql'); fs.writeFileSync(file, sql); if (uid !== undefined) fs.chmodSync(file, 0o644)
const r = spawnSync('psql', [...base, '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-f', file], { encoding: 'utf8', uid })
let ok = 0, ko = 0
for (const l of `${r.stdout}\n${r.stderr}`.split('\n')) {
  const m = l.match(/RES\|(OK|KO)\|([^|]*)\|(.*)/); if (!m) continue
  if (m[1] === 'OK') { ok++; console.log('  OK  ' + m[2]) } else { ko++; console.log('  KO  ' + m[2] + ' : ' + m[3]) }
}
if (r.status !== 0) { ko++; console.log('  KO  erreur SQL\n' + r.stderr.split('\n').filter(l => !/RES\|/.test(l)).join('\n')) }
console.log(`\n${ok} OK, ${ko} KO`)
process.exit(ko ? 1 : 0)
