-- ============================================================================
-- Etapa 3: escala regular de pregações
--   • período (manhã/tarde/noite) em cada culto
--   • cultos regulares: sábado manhã, quarta noite, domingo noite
--   • faixa configurável do calendário (inicial: dez/2026 → dez/2027)
--   • geração idempotente das datas reais via generate_regular_services()
--   • fuso horário America/Maceio
-- Nenhum pregador é inserido: os cultos nascem "aberto", prontos para a escala.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Período do culto
-- ----------------------------------------------------------------------------
create type public.service_period as enum ('manha', 'tarde', 'noite');

-- Período fixo de cada culto regular (cultos extraordinários escolhem o seu)
create or replace function public.regular_period(t public.service_type)
returns public.service_period
language sql
immutable
as $$
  select case t
    when 'sabado_manha'  then 'manha'::public.service_period
    when 'sabado_tarde'  then 'tarde'::public.service_period
    when 'domingo_noite' then 'noite'::public.service_period
    when 'quarta_noite'  then 'noite'::public.service_period
    else null
  end;
$$;

-- Dia da semana (0 = domingo … 6 = sábado) de cada culto regular
create or replace function public.regular_weekday(t public.service_type)
returns integer
language sql
immutable
as $$
  select case t
    when 'sabado_manha'  then 6
    when 'sabado_tarde'  then 6
    when 'domingo_noite' then 0
    when 'quarta_noite'  then 3
    else null
  end;
$$;

alter table public.services add column period public.service_period;

update public.services
set period = coalesce(public.regular_period(service_type), 'noite')
where period is null;

alter table public.services alter column period set not null;

-- Garante período coerente e impede culto regular em dia da semana errado
create or replace function public.services_enforce_regular()
returns trigger
language plpgsql
as $$
begin
  if new.service_type <> 'especial' then
    new.period := public.regular_period(new.service_type);
    if extract(dow from new.service_date)::int <> public.regular_weekday(new.service_type) then
      raise exception 'Culto regular em dia da semana incompatível (% em %)', new.service_type, new.service_date
        using errcode = '23514';
    end if;
  elsif new.period is null then
    raise exception 'Informe o período do culto extraordinário.' using errcode = '23502';
  end if;
  return new;
end;
$$;

create trigger services_enforce_regular
  before insert or update of service_date, service_type, period on public.services
  for each row execute function public.services_enforce_regular();

-- Unicidade: um culto regular por tipo e data. Extraordinários podem coexistir.
alter table public.services drop constraint services_unique_slot;
create unique index services_regular_slot
  on public.services (service_date, service_type)
  where service_type <> 'especial';

-- Cultos regulares não são excluídos (seriam recriados pela geração):
-- devem ser cancelados. Extraordinários podem ser excluídos.
drop policy "services: equipe remove" on public.services;
create policy "services: equipe remove extraordinários" on public.services
  for delete to authenticated
  using (public.is_staff() and service_type = 'especial');

-- ----------------------------------------------------------------------------
-- Configurações: fuso, cultos regulares e faixa do calendário
-- ----------------------------------------------------------------------------
alter table public.church_settings
  add column schedule_start date not null default date '2026-12-01',
  add column schedule_end   date not null default date '2027-12-31',
  add constraint church_settings_schedule_range check (
    schedule_end >= schedule_start
    and extract(day from schedule_start) = 1
    and schedule_end - schedule_start <= 3660
  );

alter table public.church_settings
  alter column timezone set default 'America/Maceio',
  alter column default_service_types
    set default array['sabado_manha', 'quarta_noite', 'domingo_noite']::public.service_type[];

update public.church_settings
set timezone = 'America/Maceio',
    default_service_types = array['sabado_manha', 'quarta_noite', 'domingo_noite']::public.service_type[]
where id = 1;

-- ----------------------------------------------------------------------------
-- Geração idempotente dos cultos regulares
--   Usa as datas reais do calendário gregoriano (generate_series do Postgres).
--   Executada com as permissões de quem chama (RLS: apenas a equipe insere).
--   Retorna quantos cultos foram criados; datas existentes são ignoradas.
-- ----------------------------------------------------------------------------
create or replace function public.generate_regular_services(p_start date, p_end date)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_types public.service_type[];
  v_created integer;
begin
  if p_start is null or p_end is null or p_end < p_start then
    raise exception 'Intervalo de datas inválido.' using errcode = '22023';
  end if;
  if p_end - p_start > 3660 then
    raise exception 'Intervalo máximo de 10 anos.' using errcode = '22023';
  end if;

  select default_service_types into v_types from public.church_settings where id = 1;

  insert into public.services (service_date, service_type, period, status)
  select d::date, t, public.regular_period(t), 'aberto'
  from generate_series(p_start::timestamp, p_end::timestamp, interval '1 day') as d
  cross join unnest(coalesce(v_types, '{}')) as t
  where t <> 'especial'
    and extract(dow from d)::int = public.regular_weekday(t)
  on conflict do nothing;

  get diagnostics v_created = row_count;
  return v_created;
end;
$$;

-- Período inicial de operação: dezembro/2026 a dezembro/2027
select public.generate_regular_services(date '2026-12-01', date '2027-12-31');
