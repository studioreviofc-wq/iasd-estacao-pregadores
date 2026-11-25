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
