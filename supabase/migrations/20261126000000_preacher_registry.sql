-- ============================================================================
-- Etapa 4: cadastro completo e histórico de pregadores
--   • telefone obrigatório e normalizado (comparação / duplicados)
--   • cargo, dias de preferência, arquivamento
--   • integridade do histórico (sem exclusão em cascata)
--   • registro automático de eventos da escala por pregador
--   • visão consolidada com última pregação, próxima, total e disponibilidade
--   • modelo editável de mensagem de WhatsApp
-- ============================================================================

-- ----------------------------------------------------------------------------
-- "Hoje" no fuso da igreja
-- ----------------------------------------------------------------------------
create or replace function public.church_today()
returns date
language sql
stable
as $$
  select (now() at time zone coalesce(
    (select timezone from public.church_settings where id = 1), 'America/Maceio'))::date;
$$;

-- ----------------------------------------------------------------------------
-- Telefone brasileiro normalizado: apenas DDD + número (10 ou 11 dígitos).
-- Remove máscara, código do país (55) e zero de operadora. Espelha
-- normalizeBrPhone() em src/lib/domain/phone.ts.
-- ----------------------------------------------------------------------------
create or replace function public.normalize_br_phone(raw text)
returns text
language plpgsql
immutable
as $$
declare
  d text := regexp_replace(coalesce(raw, ''), '\D', '', 'g');
begin
  if length(d) in (12, 13) and left(d, 2) = '55' then
    d := substr(d, 3);
  elsif length(d) in (11, 12) and left(d, 1) = '0' then
    d := substr(d, 2);
  end if;
  if length(d) not in (10, 11) then
    return null;
  end if;
  return d;
end;
$$;

-- ----------------------------------------------------------------------------
-- Novos campos do pregador
-- ----------------------------------------------------------------------------
alter table public.preachers
  add column role_title         text,
  add column preferred_weekdays smallint[] not null default '{}',
  add column phone_normalized   text,
  add column archived_at        timestamptz,
  add constraint preachers_weekdays_valid check (preferred_weekdays <@ array[0,1,2,3,4,5,6]::smallint[]);

update public.preachers
set phone_normalized = public.normalize_br_phone(coalesce(phone, whatsapp));

create or replace function public.preachers_normalize()
returns trigger
language plpgsql
as $$
begin
  new.phone_normalized := public.normalize_br_phone(coalesce(new.phone, new.whatsapp));
  -- Arquivado nunca fica ativo
  if new.archived_at is not null then
    new.is_active := false;
  end if;
  return new;
end;
$$;

create trigger preachers_normalize
  before insert or update on public.preachers
  for each row execute function public.preachers_normalize();

-- Novos cadastros exigem telefone válido (registros antigos são preservados)
alter table public.preachers
  add constraint preachers_phone_required check (phone_normalized is not null) not valid;

create index preachers_phone_normalized_idx on public.preachers (phone_normalized);

-- ----------------------------------------------------------------------------
-- Integridade do histórico: pregadores com qualquer registro não são excluídos
-- (devem ser arquivados). Antes: set null / cascade.
-- ----------------------------------------------------------------------------
alter table public.services drop constraint services_preacher_id_fkey;
alter table public.services
  add constraint services_preacher_id_fkey foreign key (preacher_id)
  references public.preachers (id) on delete restrict;

alter table public.availabilities drop constraint availabilities_preacher_id_fkey;
alter table public.availabilities
  add constraint availabilities_preacher_id_fkey foreign key (preacher_id)
  references public.preachers (id) on delete restrict;

alter table public.contact_logs drop constraint contact_logs_preacher_id_fkey;
alter table public.contact_logs
  add constraint contact_logs_preacher_id_fkey foreign key (preacher_id)
  references public.preachers (id) on delete restrict;

-- ----------------------------------------------------------------------------
-- Eventos da escala por pregador (registrados automaticamente por trigger)
-- Guarda o que a tabela de cultos sozinha perderia: desvínculos, cancelamentos
-- e mudanças de status ao longo do tempo.
-- ----------------------------------------------------------------------------
create table public.preacher_events (
  id            uuid primary key default gen_random_uuid(),
  preacher_id   uuid not null references public.preachers (id) on delete restrict,
  service_id    uuid references public.services (id) on delete set null,
  service_date  date not null,
  service_type  public.service_type not null,
  period        public.service_period not null,
  event_type    text not null check (event_type in (
                  'escalado', 'confirmado', 'realizado', 'cancelado', 'desvinculado', 'reaberto')),
  occurred_at   timestamptz not null default now(),
  created_by    uuid references auth.users (id) on delete set null default auth.uid()
);

create index preacher_events_preacher_idx on public.preacher_events (preacher_id, occurred_at desc);

alter table public.preacher_events enable row level security;
create policy "preacher_events: leitura" on public.preacher_events
  for select to authenticated using (true);
-- Sem políticas de escrita: apenas o trigger (security definer) insere.

create or replace function public.services_log_preacher_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event text;
begin
  -- Evento correspondente ao status atual
  v_event := case new.status
    when 'convidado'  then 'escalado'
    when 'confirmado' then 'confirmado'
    when 'realizado'  then 'realizado'
    when 'cancelado'  then 'cancelado'
    else 'reaberto'
  end;

  if tg_op = 'INSERT' then
    if new.preacher_id is not null then
      insert into preacher_events (preacher_id, service_id, service_date, service_type, period, event_type)
      values (new.preacher_id, new.id, new.service_date, new.service_type, new.period, v_event);
    end if;
    return new;
  end if;

  if new.preacher_id is distinct from old.preacher_id then
    if old.preacher_id is not null then
      insert into preacher_events (preacher_id, service_id, service_date, service_type, period, event_type)
      values (old.preacher_id, old.id, old.service_date, old.service_type, old.period, 'desvinculado');
    end if;
    if new.preacher_id is not null then
      insert into preacher_events (preacher_id, service_id, service_date, service_type, period, event_type)
      values (new.preacher_id, new.id, new.service_date, new.service_type, new.period, v_event);
    end if;
  elsif new.status is distinct from old.status and new.preacher_id is not null then
    insert into preacher_events (preacher_id, service_id, service_date, service_type, period, event_type)
    values (new.preacher_id, new.id, new.service_date, new.service_type, new.period, v_event);
  end if;
  return new;
end;
$$;

create trigger services_log_preacher_events
  after insert or update of preacher_id, status on public.services
  for each row execute function public.services_log_preacher_events();

-- ----------------------------------------------------------------------------
-- Pregação "realizada" só no passado
-- ----------------------------------------------------------------------------
create or replace function public.services_realized_not_future()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'realizado' and new.service_date > public.church_today() then
    raise exception 'Um culto futuro não pode ser marcado como realizado.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger services_realized_not_future
  before insert or update of status, service_date on public.services
  for each row execute function public.services_realized_not_future();

-- ----------------------------------------------------------------------------
-- Visão consolidada dos pregadores
--   last_preached_on / total_preached: apenas cultos "realizado" até hoje
--   (convites recusados, cancelamentos e escalas futuras não contam)
-- ----------------------------------------------------------------------------
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
  where a.preacher_id = p.id and a.end_date >= public.church_today()
  order by a.start_date
  limit 1
) av on true;

-- ----------------------------------------------------------------------------
-- Modelo de mensagem do WhatsApp (editável em Configurações)
--   Variáveis: {nome}, {primeiro_nome}, {igreja}
-- ----------------------------------------------------------------------------
alter table public.church_settings
  add column whatsapp_template text not null default
    'Olá, {primeiro_nome}! Tudo bem? Aqui é da secretaria da {igreja}. Gostaríamos de conversar com você sobre a escala de pregações. Você teria disponibilidade?';
