-- TempoSlide · Eventos, ponentes, organizador y pósteres (Postgres 15+).
-- Cada fila es de un usuario (owner_id) y las claves compuestas (id, owner_id) impiden enlazar filas de otro usuario.

-- Una charla solo puede vincular una presentación propia.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'decks_id_user_key') then
    alter table public.decks add constraint decks_id_user_key unique (id, user_id);
  end if;
end $$;

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null check (length(name) between 1 and 120),
  starts_on date not null, ends_on date not null check (ends_on >= starts_on),
  venue text, has_posters boolean not null default false,
  created_at timestamptz not null default now(),
  unique (id, owner_id)
);
create table if not exists public.speakers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  event_id uuid not null,
  name text not null check (length(name) between 1 and 120), email text, affiliation text, country text, note text,
  status text not null default 'sin_confirmar' check (status in ('sin_confirmar','confirmado','ha_llegado')),
  created_at timestamptz not null default now(),
  unique (id, owner_id),
  foreign key (event_id, owner_id) references public.events (id, owner_id) on delete cascade
);
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  event_id uuid not null,
  day date not null, name text not null, room text, chair text,
  start_min int not null check (start_min between 0 and 1439),
  created_at timestamptz not null default now(),
  unique (id, owner_id),
  foreign key (event_id, owner_id) references public.events (id, owner_id) on delete cascade
);
create table if not exists public.talks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  session_id uuid not null,
  position int not null, kind text not null default 'talk' check (kind in ('talk','break')),
  title text not null, minutes int not null check (minutes > 0 and minutes <= 600),
  deck_id uuid,
  unique (id, owner_id),
  foreign key (session_id, owner_id) references public.sessions (id, owner_id) on delete cascade,
  foreign key (deck_id, owner_id) references public.decks (id, user_id) on delete set null (deck_id)
);
create table if not exists public.talk_speakers (
  talk_id uuid not null, speaker_id uuid not null,
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  primary key (talk_id, speaker_id),
  foreign key (talk_id, owner_id) references public.talks (id, owner_id) on delete cascade,
  foreign key (speaker_id, owner_id) references public.speakers (id, owner_id) on delete cascade
);
create table if not exists public.panels (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  event_id uuid not null,
  label text not null, size text not null default 'A0' check (size in ('A0','A1','A2')),
  orientation text not null default 'vertical' check (orientation in ('vertical','horizontal')),
  unique (id, owner_id),
  foreign key (event_id, owner_id) references public.events (id, owner_id) on delete cascade
);
create table if not exists public.posters (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  event_id uuid not null, title text not null, speaker_id uuid, panel_id uuid unique,
  foreign key (event_id, owner_id) references public.events (id, owner_id) on delete cascade,
  foreign key (speaker_id, owner_id) references public.speakers (id, owner_id) on delete set null (speaker_id),
  foreign key (panel_id, owner_id) references public.panels (id, owner_id) on delete set null (panel_id)
);

create index if not exists speakers_event_idx on public.speakers (event_id);
create index if not exists sessions_event_idx on public.sessions (event_id, day, start_min);
create index if not exists talks_session_idx on public.talks (session_id, position);
create index if not exists panels_event_idx on public.panels (event_id);
create index if not exists posters_event_idx on public.posters (event_id);

do $$ declare t text; begin
  foreach t in array array['events','speakers','sessions','talks','talk_speakers','panels','posters'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists owner_all on public.%I', t);
    execute format('create policy owner_all on public.%I for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid())', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;
