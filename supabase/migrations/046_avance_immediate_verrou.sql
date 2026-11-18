-- 046 — Avance immédiate (Urssaf) : seul le serveur ou un admin écrit les statuts (18/11/2026).
-- NON APPLIQUÉE par Claude. Copie identique dans supabase/a_coller/046_avance_immediate_verrou.sql.
-- Sans DROP ni DELETE : on retire des droits (REVOKE) et on ajoute une garde. Rejouable sans risque.
--
-- Faille (contrôle qualité du 18/11, C7) : la 013 donne au prestataire une politique « aid seller write »
-- FOR ALL sur avance_immediate_demandes, plus INSERT/UPDATE à `authenticated`. Un prestataire peut donc,
-- par un appel direct à l'API, créer ou modifier la demande de SA mission avec statut « payée »
-- (ou changer le montant), sans que l'Urssaf n'ait rien validé. Même chose côté client sur
-- avance_immediate_clients (« aic self » FOR ALL) : un client peut se déclarer « actif » avec un
-- identifiant Urssaf inventé.
--
-- Après cette migration : les deux tables restent LISIBLES par les mêmes personnes qu'avant (la mission
-- pour ses deux parties, son inscription pour le client), mais seuls le serveur (clé service, routes
-- /api/avance-immediate/**) et un admin PING y écrivent.
--
-- L'app fonctionne avant et après : les routes serveur écrivent avec la clé service
-- (SUPABASE_SERVICE_ROLE_KEY) quand elle est posée, et retombent sur la session de l'utilisateur sinon
-- (ce qui ne marche plus qu'avant cette migration). Le module est éteint tant que les identifiants Urssaf
-- ne sont pas posés : aucun écran actuel n'écrit dans ces tables depuis le navigateur.
-- Prérequis avant d'activer l'avance immédiate : SUPABASE_SERVICE_ROLE_KEY sur Vercel.

revoke insert, update, delete on table public.avance_immediate_demandes from anon, authenticated;
revoke insert, update, delete on table public.avance_immediate_clients from anon, authenticated;
grant select on table public.avance_immediate_demandes to authenticated;
grant select on table public.avance_immediate_clients to authenticated;
revoke all on table public.avance_immediate_demandes from anon;
revoke all on table public.avance_immediate_clients from anon;

-- Garde en plus des droits (au cas où un GRANT serait reposé un jour par erreur) : une écriture faite
-- avec une session utilisateur qui n'est pas admin est refusée. La clé service n'a pas de auth.uid().
create or replace function public.guard_avance_immediate_write() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_admin() then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  raise exception 'Le statut de l''avance immédiate est posé par PING et l''Urssaf, pas depuis l''application.';
end $$;
revoke execute on function public.guard_avance_immediate_write() from public, anon, authenticated;

create or replace trigger trg_guard_avance_immediate_demandes
  before insert or update or delete on public.avance_immediate_demandes
  for each row execute function public.guard_avance_immediate_write();
create or replace trigger trg_guard_avance_immediate_clients
  before insert or update or delete on public.avance_immediate_clients
  for each row execute function public.guard_avance_immediate_write();
