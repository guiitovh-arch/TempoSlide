// Datos de Eventos, Ponentes, Organizador y Pósteres (Supabase; ver supabase/002_eventos.sql).
// Solo con cuenta: estas herramientas nunca guardan solo en el navegador.
import { useEffect, useState } from 'react';
import { supabase, currentUser } from './supabase.js';
import { listDecks } from './store.js';
import { deckSlides, simulate } from './lib.js';

const must = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
const db = async () => { const sb = await supabase(); if (!sb) throw new Error('Las cuentas no están activadas.'); return sb; };

export const listEvents = async () => must(await (await db()).from('events').select('*').order('starts_on', { ascending: false }));
export const saveEvent = async (e) => must(await (await db()).from('events').upsert(e).select().single());
export const deleteEvent = async (id) => must(await (await db()).from('events').delete().eq('id', id));

// Todo lo de un evento en una llamada lógica (pocos datos): se une en el cliente.
export async function loadEvent(eventId) {
  const sb = await db();
  const [event, speakers, sessions, panels, posters] = await Promise.all([
    sb.from('events').select('*').eq('id', eventId).maybeSingle().then(must),
    sb.from('speakers').select('*').eq('event_id', eventId).order('name').then(must),
    sb.from('sessions').select('*').eq('event_id', eventId).order('day').order('start_min').then(must),
    sb.from('panels').select('*').eq('event_id', eventId).order('label').then(must),
    sb.from('posters').select('*').eq('event_id', eventId).order('title').then(must),
  ]);
  const ids = sessions.map((s) => s.id);
  const talks = ids.length ? must(await sb.from('talks').select('*').in('session_id', ids).order('position')) : [];
  const tids = talks.map((t) => t.id);
  const ts = tids.length ? must(await sb.from('talk_speakers').select('*').in('talk_id', tids)) : [];
  for (const t of talks) t.speakers = ts.filter((x) => x.talk_id === t.id).map((x) => x.speaker_id);
  return { event, speakers, sessions, talks, panels, posters };
}

export const eventCounts = async (eventId) => {
  const d = await loadEvent(eventId);
  return { sessions: d.sessions.length, talks: d.talks.length, speakers: d.speakers.length, panels: d.panels.length, posters: d.posters.length };
};

const table = (name) => ({
  save: async (row) => must(await (await db()).from(name).upsert(row).select().single()),
  update: async (id, patch) => must(await (await db()).from(name).update(patch).eq('id', id).select().single()),
  insertMany: async (rows) => must(await (await db()).from(name).insert(rows).select()),
  remove: async (id) => must(await (await db()).from(name).delete().eq('id', id)),
});
export const Speakers = table('speakers');
export const Sessions = table('sessions');
export const Talks = table('talks');
export const Panels = table('panels');
export const Posters = table('posters');

export async function setTalkSpeakers(talkId, speakerIds) {
  const sb = await db();
  must(await sb.from('talk_speakers').delete().eq('talk_id', talkId));
  if (speakerIds.length) must(await sb.from('talk_speakers').insert(speakerIds.map((speaker_id) => ({ talk_id: talkId, speaker_id }))));
}
export async function moveTalk(talks, index, dir) {
  const a = talks[index], b = talks[index + dir];
  if (!a || !b) return;
  await Promise.all([Talks.update(a.id, { position: b.position }), Talks.update(b.id, { position: a.position })]);
}

// Duración prevista de cada presentación propia: mediana (p50) de la misma simulación del Analizador.
export async function deckForecasts() {
  const decks = await listDecks();
  return Object.fromEntries(decks.map((d) => [d.id, { title: d.title, p50: d.slideCount ? simulate({ seconds: deckSlides(d, d.slideCount).map((s) => s.plan), ctx: d.context }).p50 : null }]));
}

// Evento activo compartido entre Organizador, Ponentes y Pósteres (?evento= o el último usado).
export function useActiveEvent() {
  const [events, setEvents] = useState(null);
  const [err, setErr] = useState('');
  const initial = new URLSearchParams(location.search).get('evento') || (() => { try { return localStorage.getItem('ts-event'); } catch { return null; } })();
  const [id, setIdState] = useState(initial);
  useEffect(() => { currentUser().then((u) => (u ? listEvents().then(setEvents) : setEvents([]))).catch((e) => { setErr(e.message); setEvents([]); }); }, []);
  const setId = (v) => { setIdState(v); try { localStorage.setItem('ts-event', v); } catch {} const u = new URL(location.href); u.searchParams.set('evento', v); history.replaceState(null, '', u); };
  const active = events?.find((e) => e.id === id) || events?.[0] || null;
  return { events, active, setId, err, reload: () => listEvents().then(setEvents) };
}

export const eventDays = (e) => {
  const out = [];
  for (let d = new Date(`${e.starts_on}T12:00:00Z`); d <= new Date(`${e.ends_on}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) out.push(d.toISOString().slice(0, 10));
  return out;
};
export const dayLabel = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
