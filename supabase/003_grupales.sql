-- TempoSlide · Presentaciones grupales.
-- Las diapositivas (notas, plan, tipo, omitida, presentador) y los ensayos pasan a filas propias,
-- para que la base de datos imponga quién edita qué. decks.data conserva los metadatos.

-- ─── Tablas ──────────────────────────────────────────────────────────────────
create table if not exists public.deck_members (
  deck_id uuid not null references public.decks on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role text not null default 'member' check (role in ('owner','member')),
  name text, avatar_url text,
  joined_at timestamptz not null default now(),
  primary key (deck_id, user_id)
);
create table if not exists public.deck_presenters (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.decks on delete cascade,
  name text not null check (length(name) between 1 and 60),
  user_id uuid references auth.users on delete set null,
  unique (deck_id, user_id),
  unique (id, deck_id)
);
create table if not exists public.deck_invites (
  token uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.decks on delete cascade,
  created_by uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  revoked boolean not null default false
);
create table if not exists public.slides (
  deck_id uuid not null references public.decks on delete cascade,
  idx int not null check (idx between 0 and 999),
  notes text not null default '',
  plan_seconds int check (plan_seconds between 0 and 600),
  type text check (type in ('titulo','seccion','contenido','grafico','cierre')),
  omitted boolean not null default false,
  presenter_id uuid,
  notes_updated_by uuid references auth.users on delete set null,
  notes_updated_at timestamptz,
  primary key (deck_id, idx),
  foreign key (presenter_id, deck_id) references public.deck_presenters (id, deck_id) on delete set null (presenter_id)
);
create table if not exists public.rehearsals (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.decks on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  at timestamptz not null default now(),
  data jsonb not null
);
create index if not exists rehearsals_deck_idx on public.rehearsals (deck_id, at);
create index if not exists deck_members_user_idx on public.deck_members (user_id);

-- ─── Funciones (security definer evita que las políticas se llamen a sí mismas en bucle) ───
create or replace function public.is_deck_member(d uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from deck_members where deck_id = d and user_id = auth.uid())
$$;
create or replace function public.is_deck_owner(d uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from deck_members where deck_id = d and user_id = auth.uid() and role = 'owner')
$$;
create or replace function public.try_uuid(t text) returns uuid language plpgsql immutable as $$
begin return t::uuid; exception when others then return null; end $$;

-- Nombre y avatar visibles para el grupo; el correo solo lo ve el propietario (deck_member_emails).
create or replace function public.jwt_name() returns text language sql stable as $$
  select coalesce(auth.jwt() -> 'user_metadata' ->> 'full_name', auth.jwt() -> 'user_metadata' ->> 'name', split_part(auth.jwt() ->> 'email', '@', 1))
$$;

create or replace function public.accept_deck_invite(t uuid) returns uuid language plpgsql security definer set search_path = public as $$
declare d uuid;
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  select deck_id into d from deck_invites where token = t and not revoked and expires_at > now();
  if d is null then raise exception 'Invitación caducada o revocada'; end if;
  insert into deck_members (deck_id, user_id, name, avatar_url)
  values (d, auth.uid(), jwt_name(), auth.jwt() -> 'user_metadata' ->> 'avatar_url')
  on conflict do nothing;
  return d;
end $$;

create or replace function public.deck_member_emails(d uuid) returns table (user_id uuid, email text) language sql stable security definer set search_path = public as $$
  select m.user_id, u.email::text from deck_members m join auth.users u on u.id = m.user_id
  where m.deck_id = d and is_deck_owner(d)
$$;

-- Quien crea una presentación pasa a ser su propietario.
create or replace function public.add_deck_owner() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into deck_members (deck_id, user_id, role, name, avatar_url)
  values (new.id, new.user_id, 'owner', jwt_name(), auth.jwt() -> 'user_metadata' ->> 'avatar_url')
  on conflict do nothing;
  return new;
end $$;
drop trigger if exists deck_owner_member on public.decks;
create trigger deck_owner_member after insert on public.decks for each row execute function public.add_deck_owner();

-- Notas: quién y cuándo las editó por última vez (lo pone el servidor, no el cliente).
create or replace function public.stamp_notes() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' or new.notes is distinct from old.notes then
    new.notes_updated_by := auth.uid(); new.notes_updated_at := now();
  end if;
  return new;
end $$;
drop trigger if exists slides_stamp_notes on public.slides;
create trigger slides_stamp_notes before insert or update on public.slides for each row execute function public.stamp_notes();

revoke execute on function public.accept_deck_invite(uuid) from public, anon;
grant execute on function public.accept_deck_invite(uuid) to authenticated;
revoke execute on function public.deck_member_emails(uuid) from public, anon;
grant execute on function public.deck_member_emails(uuid) to authenticated;

-- ─── Seguridad por fila ──────────────────────────────────────────────────────
alter table public.deck_members enable row level security;
alter table public.deck_presenters enable row level security;
alter table public.deck_invites enable row level security;
alter table public.slides enable row level security;
alter table public.rehearsals enable row level security;
grant select, insert, update, delete on public.deck_members, public.deck_presenters, public.deck_invites, public.slides, public.rehearsals to authenticated;

drop policy if exists "decks propios" on public.decks;
drop policy if exists ver on public.decks; drop policy if exists crear on public.decks; drop policy if exists editar on public.decks; drop policy if exists borrar on public.decks;
create policy ver on public.decks for select to authenticated using (public.is_deck_member(id));
create policy crear on public.decks for insert to authenticated with check (user_id = auth.uid());
create policy editar on public.decks for update to authenticated using (public.is_deck_owner(id)) with check (public.is_deck_owner(id));
create policy borrar on public.decks for delete to authenticated using (public.is_deck_owner(id));

drop policy if exists ver on public.deck_members; drop policy if exists salir_o_expulsar on public.deck_members;
create policy ver on public.deck_members for select to authenticated using (public.is_deck_member(deck_id));
create policy salir_o_expulsar on public.deck_members for delete to authenticated
  using (role <> 'owner' and (user_id = auth.uid() or public.is_deck_owner(deck_id)));

drop policy if exists ver on public.deck_presenters; drop policy if exists gestionar on public.deck_presenters;
create policy ver on public.deck_presenters for select to authenticated using (public.is_deck_member(deck_id));
create policy gestionar on public.deck_presenters for all to authenticated using (public.is_deck_member(deck_id)) with check (public.is_deck_member(deck_id));

drop policy if exists owner on public.deck_invites;
create policy owner on public.deck_invites for all to authenticated using (public.is_deck_owner(deck_id)) with check (public.is_deck_owner(deck_id));

drop policy if exists ver on public.slides; drop policy if exists crear on public.slides; drop policy if exists editar on public.slides; drop policy if exists borrar on public.slides;
create policy ver on public.slides for select to authenticated using (public.is_deck_member(deck_id));
create policy crear on public.slides for insert to authenticated with check (public.is_deck_owner(deck_id));
create policy editar on public.slides for update to authenticated using (
  public.is_deck_owner(deck_id)
  or (public.is_deck_member(deck_id) and (presenter_id is null
      or exists (select 1 from public.deck_presenters p where p.id = presenter_id and p.user_id = auth.uid())))
) with check (public.is_deck_member(deck_id));
create policy borrar on public.slides for delete to authenticated using (public.is_deck_owner(deck_id));

drop policy if exists ver on public.rehearsals; drop policy if exists crear on public.rehearsals; drop policy if exists propios on public.rehearsals; drop policy if exists borrar on public.rehearsals;
create policy ver on public.rehearsals for select to authenticated using (public.is_deck_member(deck_id));
create policy crear on public.rehearsals for insert to authenticated with check (user_id = auth.uid() and public.is_deck_member(deck_id));
create policy propios on public.rehearsals for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy borrar on public.rehearsals for delete to authenticated using (user_id = auth.uid());

-- PDF: los miembros pueden leer el PDF de la presentación (slides/<propietario>/<deck>.pdf).
drop policy if exists "slides de grupo: leer" on storage.objects;
create policy "slides de grupo: leer" on storage.objects for select to authenticated
  using (bucket_id = 'slides' and public.is_deck_member(public.try_uuid(split_part(storage.filename(name), '.', 1))));

-- ─── Tiempo real (respeta RLS: solo llegan cambios de presentaciones de las que eres miembro) ───
do $$ begin
  begin alter publication supabase_realtime add table public.slides; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.deck_presenters; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.deck_members; exception when duplicate_object then null; end;
end $$;
