-- ============================================================================
-- IASD Estação — instalação completa do banco (gerado por scripts/build-setup-sql.mjs)
-- Cole TODO este arquivo no SQL Editor do Supabase e clique em Run (uma única vez,
-- num projeto novo). Não edite à mão: altere as migrações e gere de novo.
-- Migrações incluídas: 7
-- ============================================================================

-- >>>>>>>>>> 20261124000000_initial_schema.sql
-- ============================================================================
-- IASD Estação — Gestão de Pregadores
-- Migração inicial: tipos, tabelas, índices, gatilhos e políticas RLS.
-- Execute no SQL Editor do Supabase ou via `supabase db push`.
-- Nenhum dado fictício é inserido; apenas a linha única de configurações.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- Tipos enumerados
-- ----------------------------------------------------------------------------
create type public.user_role as enum ('administrador', 'secretario', 'leitor');

create type public.preacher_category as enum (
  'pastor', 'anciao', 'diacono', 'membro', 'convidado', 'outro'
);

create type public.service_type as enum (
  'sabado_manha', 'sabado_tarde', 'domingo_noite', 'quarta_noite', 'especial'
);

-- Ciclo de vida de um culto na escala
--   aberto     → sem pregador definido (vaga)
--   convidado  → convite enviado, aguardando resposta
--   confirmado → pregador confirmou
--   realizado  → pregação aconteceu (entra no histórico)
--   cancelado  → culto cancelado
create type public.service_status as enum (
  'aberto', 'convidado', 'confirmado', 'realizado', 'cancelado'
);

create type public.contact_channel as enum (
  'whatsapp', 'telefone', 'email', 'presencial', 'outro'
);

create type public.contact_outcome as enum (
  'aguardando', 'aceito', 'recusado', 'sem_resposta'
);

-- ----------------------------------------------------------------------------
-- Função utilitária: updated_at automático
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- Perfis de usuários (vinculados ao Supabase Auth)
-- ----------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null default '',
  role        public.user_role not null default 'leitor',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Cria o perfil automaticamente quando um usuário se cadastra
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Papel do usuário atual (usado nas políticas)
create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
as $$
  select coalesce(public.current_user_role() in ('administrador', 'secretario'), false);
$$;

-- ----------------------------------------------------------------------------
-- Configurações da igreja (linha única)
-- ----------------------------------------------------------------------------
create table public.church_settings (
  id                   smallint primary key default 1 check (id = 1),
  church_name          text not null default 'Igreja Adventista do Sétimo Dia da Estação',
  district             text,
  city                 text,
  timezone             text not null default 'America/Sao_Paulo',
  default_service_types public.service_type[] not null default array['sabado_manha']::public.service_type[],
  invite_lead_days     integer not null default 30 check (invite_lead_days between 0 and 365),
  updated_at           timestamptz not null default now()
);

create trigger church_settings_updated_at before update on public.church_settings
  for each row execute function public.set_updated_at();

insert into public.church_settings (id) values (1) on conflict do nothing;

-- ----------------------------------------------------------------------------
-- Pregadores
-- ----------------------------------------------------------------------------
create table public.preachers (
  id            uuid primary key default gen_random_uuid(),
  full_name     text not null check (char_length(trim(full_name)) > 1),
  category      public.preacher_category not null default 'membro',
  phone         text,
  whatsapp      text,
  email         text,
  home_church   text,           -- igreja/distrito de origem
  notes         text,
  is_active     boolean not null default true,
  created_by    uuid references auth.users (id) on delete set null default auth.uid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index preachers_active_name_idx on public.preachers (is_active, full_name);

create trigger preachers_updated_at before update on public.preachers
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Cultos / escala de pregação
-- Cada linha representa um culto com (ou sem) pregador escalado.
-- ----------------------------------------------------------------------------
create table public.services (
  id               uuid primary key default gen_random_uuid(),
  service_date     date not null,
  start_time       time,
  service_type     public.service_type not null default 'sabado_manha',
  title            text,          -- ex.: "Culto Jovem", "Santa Ceia"
  status           public.service_status not null default 'aberto',
  preacher_id      uuid references public.preachers (id) on delete set null,
  sermon_title     text,
  bible_reference  text,
  notes            text,
  invited_at       timestamptz,
  confirmed_at     timestamptz,
  created_by       uuid references auth.users (id) on delete set null default auth.uid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint services_unique_slot unique (service_date, service_type),
  -- Status que exigem pregador definido
  constraint services_preacher_required check (
    status in ('aberto', 'cancelado') or preacher_id is not null
  )
);

create index services_date_idx on public.services (service_date);
create index services_status_date_idx on public.services (status, service_date);
create index services_preacher_idx on public.services (preacher_id);

create trigger services_updated_at before update on public.services
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Disponibilidades futuras
-- ----------------------------------------------------------------------------
create table public.availabilities (
  id               uuid primary key default gen_random_uuid(),
  preacher_id      uuid not null references public.preachers (id) on delete cascade,
  start_date       date not null,
  end_date         date not null,
  service_types    public.service_type[] not null default '{}', -- vazio = qualquer
  notes            text,
  created_by       uuid references auth.users (id) on delete set null default auth.uid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint availabilities_valid_range check (end_date >= start_date)
);

create index availabilities_range_idx on public.availabilities (start_date, end_date);
create index availabilities_preacher_idx on public.availabilities (preacher_id);

create trigger availabilities_updated_at before update on public.availabilities
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Controle de contatos (registro de cada convite/contato)
-- ----------------------------------------------------------------------------
create table public.contact_logs (
  id             uuid primary key default gen_random_uuid(),
  preacher_id    uuid not null references public.preachers (id) on delete cascade,
  service_id     uuid references public.services (id) on delete set null,
  channel        public.contact_channel not null default 'whatsapp',
  outcome        public.contact_outcome not null default 'aguardando',
  contacted_at   timestamptz not null default now(),
  follow_up_on   date,
  notes          text,
  created_by     uuid references auth.users (id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index contact_logs_preacher_idx on public.contact_logs (preacher_id, contacted_at desc);
create index contact_logs_outcome_idx on public.contact_logs (outcome);

create trigger contact_logs_updated_at before update on public.contact_logs
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- View: histórico de pregações (cultos realizados)
-- ----------------------------------------------------------------------------
create or replace view public.preaching_history
with (security_invoker = true) as
select
  s.id,
  s.service_date,
  s.service_type,
  s.title,
  s.sermon_title,
  s.bible_reference,
  s.preacher_id,
  p.full_name as preacher_name,
  p.category  as preacher_category
from public.services s
join public.preachers p on p.id = s.preacher_id
where s.status = 'realizado';

-- ----------------------------------------------------------------------------
-- Row Level Security
--   leitura: qualquer usuário autenticado
--   escrita: administradores e secretários
--   perfis: cada usuário vê/edita o próprio; administradores gerenciam todos
-- ----------------------------------------------------------------------------
alter table public.profiles        enable row level security;
alter table public.church_settings enable row level security;
alter table public.preachers       enable row level security;
alter table public.services        enable row level security;
alter table public.availabilities  enable row level security;
alter table public.contact_logs    enable row level security;

create policy "profiles: leitura própria ou admin" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.current_user_role() = 'administrador');

create policy "profiles: admin atualiza" on public.profiles
  for update to authenticated
  using (public.current_user_role() = 'administrador')
  with check (public.current_user_role() = 'administrador');

create policy "settings: leitura" on public.church_settings
  for select to authenticated using (true);
create policy "settings: admin atualiza" on public.church_settings
  for update to authenticated
  using (public.current_user_role() = 'administrador')
  with check (public.current_user_role() = 'administrador');

-- Tabelas operacionais: mesmo padrão
do $$
declare
  t text;
begin
  foreach t in array array['preachers', 'services', 'availabilities', 'contact_logs'] loop
    execute format(
      'create policy "%1$s: leitura" on public.%1$I for select to authenticated using (true);', t);
    execute format(
      'create policy "%1$s: equipe insere" on public.%1$I for insert to authenticated with check (public.is_staff());', t);
    execute format(
      'create policy "%1$s: equipe atualiza" on public.%1$I for update to authenticated using (public.is_staff()) with check (public.is_staff());', t);
    execute format(
      'create policy "%1$s: equipe remove" on public.%1$I for delete to authenticated using (public.is_staff());', t);
  end loop;
end;
$$;

-- >>>>>>>>>> 20261124000001_profiles_email.sql
-- ============================================================================
-- Etapa 2: e-mail no perfil (para a gestão de usuários em Configurações)
-- ============================================================================

alter table public.profiles add column if not exists email text;

update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id and p.email is null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), new.email);
  return new;
end;
$$;

-- Usuário pode editar o próprio nome (o papel continua restrito ao administrador)
create policy "profiles: usuário edita o próprio nome" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = public.current_user_role());

-- >>>>>>>>>> 20261125000000_regular_schedule.sql
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

-- >>>>>>>>>> 20261126000000_preacher_registry.sql
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

-- >>>>>>>>>> 20261127000000_contacts_availability.sql
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

-- >>>>>>>>>> 20261128000000_rotation_security_audit.sql
-- ============================================================================
-- Etapa 6: rotatividade, segurança e integridade
--   • configuração do intervalo mínimo e da regra de meses consecutivos
--   • bloqueio de escalas simultâneas (mesmo pregador, mesmo dia e período)
--   • rotation_snapshot(): dados de repetição relativos à data do culto
--   • acesso apenas para usuários aprovados pelo administrador
--   • registro de alterações (audit_log)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Configuração da rotatividade
-- ----------------------------------------------------------------------------
alter table public.church_settings
  add column min_interval_days integer not null default 30 check (min_interval_days between 0 and 365),
  add column consecutive_month_alert boolean not null default true;

-- ----------------------------------------------------------------------------
-- 2. Conflito de escalas simultâneas: bloqueio definitivo
--    (intervalos recomendados geram apenas alertas no app)
-- ----------------------------------------------------------------------------
create or replace function public.services_prevent_conflict()
returns trigger
language plpgsql
as $$
begin
  if new.preacher_id is not null
     and new.status in ('convidado', 'confirmado', 'realizado')
     and exists (
       select 1 from public.services s
       where s.preacher_id = new.preacher_id
         and s.id <> new.id
         and s.service_date = new.service_date
         and s.period = new.period
         and s.status in ('convidado', 'confirmado', 'realizado')
     ) then
    raise exception 'Conflito de escala: este pregador já está escalado neste dia e período.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger services_prevent_conflict
  before insert or update of preacher_id, status, service_date, period on public.services
  for each row execute function public.services_prevent_conflict();

-- ----------------------------------------------------------------------------
-- 3. Situação de cada pregador em relação a uma data de culto
--    Tudo é calculado a partir da data do culto (não da data de hoje).
-- ----------------------------------------------------------------------------
create or replace function public.rotation_snapshot(
  p_date date,
  p_period public.service_period,
  p_exclude_service uuid default null)
returns table (
  preacher_id          uuid,
  last_realized_before date,     -- última pregação realizada antes do culto
  last_before          date,     -- última realizada OU confirmada antes do culto
  next_after           date,     -- próxima escala (aguardando/confirmada) depois do culto
  month_count          integer,  -- escalas do pregador no mês do culto
  prev_month_count     integer,  -- realizadas/confirmadas no mês anterior ao culto
  conflict             boolean,  -- já escalado no mesmo dia e período
  same_day_other       boolean   -- escalado no mesmo dia, em outro período
)
language sql
stable
security invoker
set search_path = public
as $$
  with scoped as (
    select s.*
    from services s
    where s.preacher_id is not null
      and (p_exclude_service is null or s.id <> p_exclude_service)
      and s.status in ('convidado', 'confirmado', 'realizado')
  )
  select
    p.id,
    (select max(s.service_date) from scoped s where s.preacher_id = p.id and s.status = 'realizado' and s.service_date < p_date),
    (select max(s.service_date) from scoped s where s.preacher_id = p.id and s.status in ('realizado', 'confirmado') and s.service_date < p_date),
    (select min(s.service_date) from scoped s where s.preacher_id = p.id and s.status in ('convidado', 'confirmado') and s.service_date > p_date),
    (select count(*)::int from scoped s where s.preacher_id = p.id
       and date_trunc('month', s.service_date) = date_trunc('month', p_date)),
    (select count(*)::int from scoped s where s.preacher_id = p.id and s.status in ('realizado', 'confirmado')
       and date_trunc('month', s.service_date) = date_trunc('month', p_date) - interval '1 month'),
    exists (select 1 from scoped s where s.preacher_id = p.id and s.service_date = p_date and s.period = p_period),
    exists (select 1 from scoped s where s.preacher_id = p.id and s.service_date = p_date and s.period <> p_period)
  from preachers p
  where p.archived_at is null;
$$;

-- ----------------------------------------------------------------------------
-- 4. Acesso somente para usuários aprovados
--    Novos usuários entram como "leitor" e NÃO aprovados: não leem nenhum dado
--    (inclusive telefones) até o administrador liberar o acesso.
-- ----------------------------------------------------------------------------
alter table public.profiles
  add column approved    boolean not null default false,
  add column approved_at timestamptz;

-- Mantém o acesso de quem já administrava o sistema
update public.profiles set approved = true, approved_at = now() where role in ('administrador', 'secretario');

-- Papel efetivo: só existe para usuários aprovados (todas as políticas dependem dele)
create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid() and approved;
$$;

create or replace function public.is_member()
returns boolean
language sql
stable
as $$
  select public.current_user_role() is not null;
$$;

-- Leitura restrita a membros aprovados
drop policy "preachers: leitura" on public.preachers;
drop policy "services: leitura" on public.services;
drop policy "availabilities: leitura" on public.availabilities;
drop policy "contact_logs: leitura" on public.contact_logs;
drop policy "settings: leitura" on public.church_settings;
drop policy "preacher_events: leitura" on public.preacher_events;
drop policy "availability_events: leitura" on public.availability_events;

create policy "preachers: membros leem" on public.preachers for select to authenticated using (public.is_member());
create policy "services: membros leem" on public.services for select to authenticated using (public.is_member());
create policy "availabilities: membros leem" on public.availabilities for select to authenticated using (public.is_member());
create policy "contact_logs: membros leem" on public.contact_logs for select to authenticated using (public.is_member());
create policy "settings: membros leem" on public.church_settings for select to authenticated using (public.is_member());
create policy "preacher_events: membros leem" on public.preacher_events for select to authenticated using (public.is_member());
create policy "availability_events: membros leem" on public.availability_events for select to authenticated using (public.is_member());

-- Nada é público: remove qualquer privilégio do papel anônimo
revoke all on all tables in schema public from anon;
revoke execute on all functions in schema public from anon;

-- ----------------------------------------------------------------------------
-- 5. Registro de alterações relevantes
-- ----------------------------------------------------------------------------
create table public.audit_log (
  id          bigint generated always as identity primary key,
  table_name  text not null,
  record_id   text,
  action      text not null check (action in ('insert', 'update', 'delete')),
  changes     jsonb not null,
  changed_by  uuid default auth.uid(),
  changed_at  timestamptz not null default now()
);

create index audit_log_changed_at_idx on public.audit_log (changed_at desc);
create index audit_log_record_idx on public.audit_log (table_name, record_id);

alter table public.audit_log enable row level security;
create policy "audit_log: administrador lê" on public.audit_log
  for select to authenticated using (public.current_user_role() = 'administrador');
-- Sem políticas de escrita: apenas o trigger (security definer) registra.

create or replace function public.audit_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_changes jsonb;
  v_id text;
begin
  if tg_op = 'INSERT' then
    v_changes := to_jsonb(new) - 'created_at' - 'updated_at';
    v_id := (to_jsonb(new) ->> 'id');
  elsif tg_op = 'DELETE' then
    v_changes := to_jsonb(old) - 'created_at' - 'updated_at';
    v_id := (to_jsonb(old) ->> 'id');
  else
    select jsonb_object_agg(n.key, jsonb_build_array(o.value, n.value))
      into v_changes
    from jsonb_each(to_jsonb(new)) n
    join jsonb_each(to_jsonb(old)) o using (key)
    where n.value is distinct from o.value
      and n.key not in ('updated_at', 'phone_normalized');
    if v_changes is null then
      return new;
    end if;
    v_id := (to_jsonb(new) ->> 'id');
  end if;

  insert into audit_log (table_name, record_id, action, changes)
  values (tg_table_name, v_id, lower(tg_op), v_changes);
  return coalesce(new, old);
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['preachers', 'services', 'availabilities', 'contact_logs', 'church_settings', 'profiles'] loop
    execute format(
      'create trigger %1$s_audit after insert or update or delete on public.%1$I
         for each row execute function public.audit_changes();', t);
  end loop;
end;
$$;

-- >>>>>>>>>> 20261129000000_simple_registry.sql
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
