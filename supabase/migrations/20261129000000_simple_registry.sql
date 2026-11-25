-- ============================================================================
-- Etapa 7: cadastro simplificado de pregadores
--   • apelido (como a pessoa é conhecida)
--   • telefone opcional — mas, se informado, precisa ser válido
--   • nome pode ser só o primeiro nome ou o apelido
-- ============================================================================

alter table public.preachers add column nickname text;

-- Telefone deixa de ser obrigatório; número informado continua sendo validado
alter table public.preachers drop constraint preachers_phone_required;
alter table public.preachers
  add constraint preachers_phone_valid check (
    coalesce(phone, whatsapp) is null
    or btrim(coalesce(phone, whatsapp)) = ''
    or phone_normalized is not null
  );

-- A visão expande p.* na criação: recria para incluir o apelido
drop view public.preacher_overview;
create view public.preacher_overview
with (security_invoker = true) as
select
  p.*,
  st.last_preached_on,
  coalesce(st.total_preached, 0) as total_preached,
  nx.service_date as next_confirmed_on,
  nx.period       as next_confirmed_period,
  av.start_date   as next_available_start,
  av.end_date     as next_available_end
from public.preachers p
left join lateral (
  select max(s.service_date) as last_preached_on, count(*)::int as total_preached
  from public.services s
  where s.preacher_id = p.id and s.status = 'realizado' and s.service_date <= public.church_today()
) st on true
left join lateral (
  select s.service_date, s.period
  from public.services s
  where s.preacher_id = p.id and s.status = 'confirmado' and s.service_date >= public.church_today()
  order by s.service_date
  limit 1
) nx on true
left join lateral (
  select a.start_date, a.end_date
  from public.availabilities a
  where a.preacher_id = p.id
    and a.end_date >= public.church_today()
    and a.status in ('informada', 'aguardando_confirmacao')
  order by a.start_date
  limit 1
) av on true;
