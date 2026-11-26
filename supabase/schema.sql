-- TempoSlide · esquema Supabase. Ejecutar una vez en el SQL Editor del proyecto.
-- Cada presentación es una fila (metadatos + notas + ensayos en jsonb); el PDF va a Storage.

create table if not exists public.decks (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists decks_user_idx on public.decks (user_id, created_at desc);

-- Solo usuarios con sesión (las políticas RLS limitan cada fila a su dueño). Los proyectos nuevos no conceden permisos por defecto.
grant select, insert, update, delete on public.decks to authenticated;

alter table public.decks enable row level security;
drop policy if exists "decks propios" on public.decks;
create policy "decks propios" on public.decks
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- PDFs privados: slides/<user_id>/<deck_id>.pdf
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('slides', 'slides', false, 52428800, array['application/pdf'])
on conflict (id) do nothing;

drop policy if exists "slides propios: leer" on storage.objects;
drop policy if exists "slides propios: subir" on storage.objects;
drop policy if exists "slides propios: actualizar" on storage.objects;
drop policy if exists "slides propios: borrar" on storage.objects;
create policy "slides propios: leer" on storage.objects for select
  using (bucket_id = 'slides' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "slides propios: subir" on storage.objects for insert
  with check (bucket_id = 'slides' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "slides propios: actualizar" on storage.objects for update
  using (bucket_id = 'slides' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "slides propios: borrar" on storage.objects for delete
  using (bucket_id = 'slides' and (storage.foldername(name))[1] = auth.uid()::text);

-- Borrar la propia cuenta (zona peligrosa del perfil). La app borra antes los PDF de Storage;
-- al borrar el usuario, sus filas de decks caen en cascada.
create or replace function public.delete_account() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sin sesión'; end if;
  delete from auth.users where id = auth.uid();
end;
$$;
revoke all on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;
