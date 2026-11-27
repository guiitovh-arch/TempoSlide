-- Mueve los datos existentes al nuevo modelo (idempotente; decks.data se conserva como respaldo).
insert into public.deck_members (deck_id, user_id, role, name, avatar_url)
select d.id, d.user_id, 'owner',
  coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', split_part(u.email, '@', 1)),
  u.raw_user_meta_data ->> 'avatar_url'
from public.decks d join auth.users u on u.id = d.user_id
on conflict do nothing;

insert into public.slides (deck_id, idx, notes, plan_seconds, type, omitted)
select d.id, i,
  coalesce(d.data -> 'notes' ->> i, ''),
  (select case when v is null then null else least(600, greatest(0, v::numeric::int)) end from (select coalesce(d.data -> 'plan' ->> i, d.data -> 'slideTargets' ->> i) v) x),
  nullif(d.data -> 'types' ->> i, 'null'),
  coalesce((d.data -> 'skipped' ->> i)::boolean, false)
from public.decks d,
  generate_series(0, greatest(coalesce((d.data ->> 'slideCount')::int, 0), coalesce(jsonb_array_length(case when jsonb_typeof(d.data -> 'notes') = 'array' then d.data -> 'notes' end), 0)) - 1) i
on conflict do nothing;

insert into public.rehearsals (id, deck_id, user_id, at, data)
select (s ->> 'id')::uuid, d.id, d.user_id, (s ->> 'at')::timestamptz, s
from public.decks d, jsonb_array_elements(case when jsonb_typeof(d.data -> 'sessions') = 'array' then d.data -> 'sessions' else '[]'::jsonb end) s
on conflict do nothing;
