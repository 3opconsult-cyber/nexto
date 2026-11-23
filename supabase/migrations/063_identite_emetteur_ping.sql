-- 063 : identité de l'émetteur des commissions PING (nom commercial PING, société BAITA EURL).
-- Source : informations de Romain (Notion, fiche société). Rejouable, sans DROP ni DELETE.
-- Effet : les NOUVELLES factures de commission portent ces mentions ; les documents déjà émis ne changent pas
-- (ils gardent leur copie figée `issuer_snapshot`). Avec un SIRET renseigné, le « relevé de frais » devient une « facture ».
insert into public.app_settings(key, value)
values ('platform_identity', '{}'::jsonb)
on conflict (key) do nothing;

update public.app_settings
   set value = coalesce(value, '{}'::jsonb) || jsonb_build_object(
         'nom',     'BAITA EURL (marque PING)',
         'forme',   'EURL au capital de 5 000 €, RCS Grasse',
         'adresse', '40 rue des Arcs',
         'ville',   '06140 Vence',
         'siret',   '512 026 907 00018',
         'tva',     'FR82 512 026 907'),
       updated_at = now()
 where key = 'platform_identity';

-- Contrôle : select value from app_settings where key = 'platform_identity';
