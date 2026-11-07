-- Comptes de TEST identifiés (audit 10/10, 07/11/2026). Mot de passe : QaPing2026!
-- Tous les e-mails se terminent par @qa.ping-test.invalid : retrait facile (voir la fin du fichier).
with new_users as (
  select gen_random_uuid() as id, e.email, e.fn, e.ln, e.ph
  from (values
    ('qa.client1@qa.ping-test.invalid','QA','Client1','0600000001'),
    ('qa.client2@qa.ping-test.invalid','QA','Client2','0600000002'),
    ('qa.pro1@qa.ping-test.invalid','QA','Pro1','0600000003'),
    ('qa.pro2@qa.ping-test.invalid','QA','Pro2','0600000004'),
    ('qa.double1@qa.ping-test.invalid','QA','Double1','0600000005')
  ) as e(email, fn, ln, ph)
  where not exists (select 1 from auth.users u where u.email = e.email)
), ins as (
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new)
  select '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', email, crypt('QaPing2026!', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('first_name', fn, 'last_name', ln, 'phone', ph, 'birthdate', '1990-01-01', 'address', '1 place Massena, 06000 Nice', 'role', 'client'),
    now(), now(), '', '', '', ''
  from new_users returning id, email
)
insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), id, id::text, 'email', jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true), now(), now(), now() from ins;

-- Retrait des comptes de test (à exécuter à la fin ; supprime aussi leurs données liées par cascade) :
-- delete from auth.users where email like 'qa.%@qa.ping-test.invalid';
