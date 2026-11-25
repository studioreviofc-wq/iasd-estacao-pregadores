-- ============================================================================
-- Etapa 5: controle de contatos e disponibilidades futuras
--   • novos status de contato e convite para mês ou culto específico
--   • contatos imutáveis: cada interação é um novo registro (histórico preservado)
--   • disponibilidade por mês, com datas específicas e dias da semana
--   • status da disponibilidade + histórico de mudanças
--   • escala confirmada atualiza a disponibilidade correspondente (trigger)
--   • visões para pendências do dashboard e página de disponibilidades
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Status do contato
-- ----------------------------------------------------------------------------
create type public.contact_status as enum (
  'nao_contatado',  -- ainda não contatado (contato planejado)
  'aguardando',     -- aguardando resposta
  'aceito',         -- aceitou o convite
  'indisponivel',   -- não está disponível
  'outro_mes',      -- disponível em outro mês
  'novo_contato'    -- necessita de novo contato
);

alter table public.contact_logs alter column outcome drop default;
alter table public.contact_logs
  alter column outcome type public.contact_status
  using (case outcome::text
           when 'recusado' then 'indisponivel'
           when 'sem_resposta' then 'novo_contato'
           else outcome::text
         end)::public.contact_status;
alter table public.contact_logs alter column outcome set default 'aguardando';
drop type public.contact_outcome;

-- Para qual mês (ou culto específico, via service_id) o pregador foi convidado
alter table public.contact_logs
  add column invited_for_month date,
  add column previous_id uuid references public.contact_logs (id) on delete set null,
  add constraint contact_logs_month_first_day check (invited_for_month is null or extract(day from invited_for_month) = 1);

update public.contact_logs c
set invited_for_month = date_trunc('month', s.service_date)::date
from public.services s
where s.id = c.service_id and c.invited_for_month is null;

-- Histórico de contatos não é sobrescrito: sem UPDATE para o app.
-- Cada nova interação gera um novo registro (previous_id aponta o anterior).
drop policy "contact_logs: equipe atualiza" on public.contact_logs;

create index contact_logs_follow_up_idx on public.contact_logs (follow_up_on) where follow_up_on is not null;

-- ----------------------------------------------------------------------------
-- 2. Disponibilidade por mês
-- ----------------------------------------------------------------------------
create type public.availability_status as enum (
  'informada',              -- disponibilidade informada
  'aguardando_confirmacao', -- aguardando nova confirmação
  'agendado',               -- vinculada a um culto confirmado
  'indisponivel',           -- não está mais disponível
  'expirada'                -- período passou sem agendamento
);

alter table public.availabilities
  add column availability_month date,
  add column specific_dates     date[] not null default '{}',
  add column weekdays           smallint[] not null default '{}',
  add column status             public.availability_status not null default 'informada',
  add column follow_up_on       date,
  add column source_contact_id  uuid references public.contact_logs (id) on delete set null,
  add column service_id         uuid references public.services (id) on delete set null,
  add constraint availabilities_weekdays_valid check (weekdays <@ array[0,1,2,3,4,5,6]::smallint[]);

update public.availabilities set availability_month = date_trunc('month', start_date)::date;

alter table public.availabilities
  alter column availability_month set not null,
  add constraint availabilities_month_first_day check (extract(day from availability_month) = 1);

create index availabilities_month_idx on public.availabilities (availability_month, status);

-- start_date/end_date passam a ser derivados do mês e das datas específicas
create or replace function public.availabilities_derive_range()
returns trigger
language plpgsql
as $$
begin
  new.availability_month := date_trunc('month', new.availability_month)::date;
  if cardinality(new.specific_dates) > 0 then
    if exists (
      select 1 from unnest(new.specific_dates) d
      where date_trunc('month', d)::date <> new.availability_month
    ) then
      raise exception 'As datas específicas devem pertencer ao mês informado.' using errcode = '23514';
    end if;
    new.specific_dates := array(select distinct d from unnest(new.specific_dates) d order by d);
    new.start_date := new.specific_dates[1];
    new.end_date := new.specific_dates[cardinality(new.specific_dates)];
  else
    new.start_date := new.availability_month;
    new.end_date := (new.availability_month + interval '1 month' - interval '1 day')::date;
  end if;
  new.weekdays := array(select distinct w from unnest(new.weekdays) w order by w);
  return new;
end;
$$;

create trigger availabilities_derive_range
  before insert or update of availability_month, specific_dates, weekdays, start_date, end_date
  on public.availabilities
  for each row execute function public.availabilities_derive_range();

-- A disponibilidade cobre a data? (período + datas específicas + dias da semana)
create or replace function public.availability_covers(
  p_start date, p_end date, p_dates date[], p_weekdays smallint[], p_day date)
returns boolean
language sql
immutable
as $$
  select p_day between p_start and p_end
     and (cardinality(p_dates) = 0 or p_day = any (p_dates))
     and (cardinality(p_weekdays) = 0 or extract(dow from p_day)::smallint = any (p_weekdays));
$$;

-- ----------------------------------------------------------------------------
-- 3. Histórico de status da disponibilidade (preserva o registro original)
-- ----------------------------------------------------------------------------
create table public.availability_events (
  id               uuid primary key default gen_random_uuid(),
  availability_id  uuid not null references public.availabilities (id) on delete cascade,
  preacher_id      uuid not null references public.preachers (id) on delete restrict,
  from_status      public.availability_status,
  to_status        public.availability_status not null,
  service_id       uuid references public.services (id) on delete set null,
  occurred_at      timestamptz not null default now(),
  created_by       uuid references auth.users (id) on delete set null default auth.uid()
);

create index availability_events_preacher_idx on public.availability_events (preacher_id, occurred_at desc);

alter table public.availability_events enable row level security;
create policy "availability_events: leitura" on public.availability_events
  for select to authenticated using (true);

create or replace function public.availabilities_log_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status or new.service_id is distinct from old.service_id then
    insert into availability_events (availability_id, preacher_id, from_status, to_status, service_id)
    values (new.id, new.preacher_id, case when tg_op = 'UPDATE' then old.status end, new.status, new.service_id);
  end if;
  return new;
end;
$$;

create trigger availabilities_log_events
  after insert or update of status, service_id on public.availabilities
  for each row execute function public.availabilities_log_events();

-- ----------------------------------------------------------------------------
-- 4. Escala → disponibilidade
--   Convite (convidado)  → disponibilidade "aguardando_confirmacao"
--   Confirmado/realizado → disponibilidade "agendado"
--   Culto reaberto, cancelado ou com outro pregador → volta a "informada"
-- Uma disponibilidade nunca cria ou confirma culto sozinha.
-- ----------------------------------------------------------------------------
create or replace function public.services_sync_availability()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target uuid;
begin
  -- Libera disponibilidades ligadas a este culto que deixaram de valer
  update availabilities
  set status = 'informada', service_id = null
  where service_id = new.id
    and status in ('agendado', 'aguardando_confirmacao')
    and (preacher_id is distinct from new.preacher_id or new.status in ('aberto', 'cancelado'));

  if new.preacher_id is not null and new.status in ('convidado', 'confirmado', 'realizado') then
    select a.id into v_target
    from availabilities a
    where a.preacher_id = new.preacher_id
      and (a.service_id = new.id
           or (a.service_id is null and a.status in ('informada', 'aguardando_confirmacao')))
      and availability_covers(a.start_date, a.end_date, a.specific_dates, a.weekdays, new.service_date)
    order by (a.service_id = new.id) desc nulls last, a.created_at
    limit 1;

    if v_target is not null then
      update availabilities
      set status = case when new.status = 'convidado' then 'aguardando_confirmacao' else 'agendado' end::availability_status,
          service_id = new.id
      where id = v_target;
    end if;
  end if;
  return new;
end;
$$;

create trigger services_sync_availability
  after insert or update of preacher_id, status, service_date on public.services
  for each row execute function public.services_sync_availability();

-- ----------------------------------------------------------------------------
-- 5. Visões
-- ----------------------------------------------------------------------------

-- Disponibilidades com status efetivo (expira sozinha), dados do pregador,
-- última pregação realizada e último contato
create or replace view public.availability_overview
with (security_invoker = true) as
select
  a.*,
  case
    when a.status in ('informada', 'aguardando_confirmacao') and a.end_date < public.church_today()
      then 'expirada'::public.availability_status
    else a.status
  end as effective_status,
  p.full_name   as preacher_name,
  p.phone       as preacher_phone,
  p.whatsapp    as preacher_whatsapp,
  p.is_active   as preacher_active,
  p.archived_at as preacher_archived_at,
  st.last_preached_on,
  lc.last_contacted_at
from public.availabilities a
join public.preachers p on p.id = a.preacher_id
left join lateral (
  select max(s.service_date) as last_preached_on
  from public.services s
  where s.preacher_id = a.preacher_id and s.status = 'realizado' and s.service_date <= public.church_today()
) st on true
left join lateral (
  select max(c.contacted_at) as last_contacted_at
  from public.contact_logs c
  where c.preacher_id = a.preacher_id
) lc on true;

-- Situação atual de contato de cada pregador (último registro)
create or replace view public.contact_latest
with (security_invoker = true) as
select distinct on (c.preacher_id)
  c.*,
  p.full_name as preacher_name,
  p.phone     as preacher_phone,
  p.whatsapp  as preacher_whatsapp
from public.contact_logs c
join public.preachers p on p.id = c.preacher_id
where p.archived_at is null
order by c.preacher_id, c.contacted_at desc, c.created_at desc;

-- Próxima disponibilidade no resumo do pregador considera só as vigentes
create or replace view public.preacher_overview
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
