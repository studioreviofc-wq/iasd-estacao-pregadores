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
