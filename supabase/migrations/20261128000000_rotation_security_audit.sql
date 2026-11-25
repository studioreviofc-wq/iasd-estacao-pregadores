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
