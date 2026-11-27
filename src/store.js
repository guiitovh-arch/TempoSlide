// Biblioteca de presentaciones.
// - Con sesión (Supabase): decks (metadatos en jsonb) + slides (una fila por diapositiva) + rehearsals
//   (una fila por ensayo) + deck_members/deck_presenters (grupos). PDF en Storage slides/<propietario>/<deck>.pdf.
//   Ver supabase/schema.sql, 003_grupales.sql. La base de datos impone quién edita qué (RLS).
// - Sin sesión (modo invitado): todo en IndexedDB, en este navegador, con la misma forma.
// La app trabaja siempre con el mismo objeto de presentación:
//   { id, title, targetMinutes, …metadatos, notes[], plan[], types[], skipped[], presenterOf[], notesMeta[],
//     presenters[], members[], ownerId, isOwner, sessions (mis ensayos), groupSessions (todos) }
import { supabase, currentUser } from './supabase.js';

const open = () =>
  new Promise((res, rej) => {
    const r = indexedDB.open('temposlide', 2);
    r.onupgradeneeded = (e) => {
      if (e.oldVersion < 1) { r.result.createObjectStore('decks', { keyPath: 'id' }); r.result.createObjectStore('pdfs'); }
      if (e.oldVersion < 2) r.result.createObjectStore('pendingAudio'); // grabaciones que no se pudieron subir
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
const tx = async (store, mode, fn) => {
  const db = await open();
  return new Promise((res, rej) => {
    const t = db.transaction(store, mode);
    const req = fn(t.objectStore(store));
    t.oncomplete = () => res(req?.result);
    t.onerror = () => rej(t.error);
  });
};
const byDate = (a, b) => b.createdAt.localeCompare(a.createdAt);
const must = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
const remote = async () => { const user = await currentUser(); return user ? { sb: await supabase(), user } : null; };
const pdfPath = (ownerId, id) => `${ownerId}/${id}.pdf`;
const AUDIO = 'rehearsal-audio';

const META = ['title', 'fileName', 'createdAt', 'targetMinutes', 'folder', 'tags', 'context', 'guessMinutes', 'slideCount', 'timesFromNotes'];
const pick = (o, keys) => Object.fromEntries(keys.filter((k) => k in o).map((k) => [k, o[k]]));
const ARRAYS = { notes: 'notes', plan: 'plan_seconds', types: 'type', skipped: 'omitted', presenterOf: 'presenter_id' };
const slideCountOf = (d) => Math.max(d.slideCount || 0, ...Object.keys(ARRAYS).map((k) => d[k]?.length || 0));

// ─── Ensamblado del objeto de presentación desde las tablas ──────────────────
function assemble(row, slides, members, presenters, rehearsals, me) {
  const n = Math.max(row.data?.slideCount || 0, ...slides.map((s) => s.idx + 1));
  const at = (f, def) => Array.from({ length: n }, (_, i) => { const s = slides.find((x) => x.idx === i); return s ? f(s) : def; });
  const mine = rehearsals.filter((x) => x.user_id === me).map((x) => x.data).sort((a, b) => a.at.localeCompare(b.at));
  return {
    ...pick(row.data || {}, META), id: row.id, ownerId: row.user_id, isOwner: row.user_id === me,
    createdAt: row.data?.createdAt || row.created_at,
    notes: at((s) => s.notes, ''), plan: at((s) => s.plan_seconds, null), types: at((s) => s.type, null),
    skipped: at((s) => s.omitted, false), presenterOf: at((s) => s.presenter_id, null),
    notesMeta: at((s) => ({ by: s.notes_updated_by, at: s.notes_updated_at }), null),
    members: members.map(({ user_id, role, name, avatar_url }) => ({ user_id, role, name, avatar_url })),
    presenters: presenters.map(({ id, name, user_id }) => ({ id, name, user_id })),
    sessions: mine,
    groupSessions: rehearsals.map((x) => ({ ...x.data, userId: x.user_id })).sort((a, b) => a.at.localeCompare(b.at)),
    _rows: slides.map((x) => x.idx), // filas que existen en la base de datos
  };
}

async function loadMany(r, ids) {
  if (!ids.length) return [];
  const q = (t, f = 'deck_id') => r.sb.from(t).select('*').in(f, ids).then(must);
  const [rows, slides, members, presenters, rehearsals] = await Promise.all([q('decks', 'id'), q('slides'), q('deck_members'), q('deck_presenters'), q('rehearsals')]);
  return rows.map((row) => assemble(row, slides.filter((s) => s.deck_id === row.id), members.filter((m) => m.deck_id === row.id), presenters.filter((p) => p.deck_id === row.id), rehearsals.filter((x) => x.deck_id === row.id), r.user.id));
}

const localDeck = (d) => d && { presenters: [], presenterOf: [], ...d, members: [], isOwner: true, groupSessions: d.sessions };
// Campos derivados que no se guardan en el modo invitado.
const stripDerived = ({ groupSessions, members, isOwner, ownerId, _rows, notesMeta, ...d }) => d;

export const listLocalDecks = async () => ((await tx('decks', 'readonly', (s) => s.getAll())) || []).map(localDeck).sort(byDate);

export async function listDecks() {
  const r = await remote();
  if (!r) return listLocalDecks();
  const ids = must(await r.sb.from('decks').select('id')).map((x) => x.id);
  return (await loadMany(r, ids)).sort(byDate);
}

export async function getDeck(id) {
  const r = await remote();
  if (!r) return localDeck(await tx('decks', 'readonly', (s) => s.get(id)));
  return (await loadMany(r, [id]))[0];
}

// Guarda las diferencias entre dos versiones: metadatos (solo propietario) y diapositivas cambiadas.
async function saveDiff(r, cur, next) {
  const meta = pick(next, META);
  if (cur.isOwner && JSON.stringify(pick(cur, META)) !== JSON.stringify(meta)) {
    must(await r.sb.from('decks').update({ data: meta, updated_at: new Date().toISOString() }).eq('id', cur.id));
  }
  const n = slideCountOf(next), have = new Set(cur._rows || []);
  const ops = [];
  for (let i = 0; i < n; i++) {
    const patch = {};
    for (const [k, col] of Object.entries(ARRAYS)) {
      const a = cur[k]?.[i] ?? null, b = next[k]?.[i] ?? null;
      if (k in next && JSON.stringify(a) !== JSON.stringify(b)) patch[col] = col === 'notes' ? b || '' : col === 'omitted' ? !!b : b;
    }
    if (!have.has(i) && cur.isOwner) ops.push(r.sb.from('slides').upsert({ deck_id: cur.id, idx: i, notes: next.notes?.[i] || '', plan_seconds: next.plan?.[i] ?? null, type: next.types?.[i] ?? null, omitted: !!next.skipped?.[i], presenter_id: next.presenterOf?.[i] ?? null }).then(must));
    else if (have.has(i) && Object.keys(patch).length) ops.push(r.sb.from('slides').update(patch).eq('deck_id', cur.id).eq('idx', i).select('idx').then((res) => {
      if (!must(res).length) throw new Error(`No puedes editar la diapositiva ${i + 1}: está asignada a otra persona.`);
    }));
  }
  await Promise.all(ops);
}

export async function putDeck(d) {
  const r = await remote();
  if (!r) { const clean = stripDerived(d); await tx('decks', 'readwrite', (s) => s.put(clean)); return localDeck(clean); }
  await saveDiff(r, await getDeck(d.id), d);
  return getDeck(d.id);
}

export async function updateDeck(id, patch) {
  const r = await remote();
  const cur = await getDeck(id);
  if (!r) return putDeck({ ...cur, ...patch });
  await saveDiff(r, cur, { ...cur, ...patch });
  return getDeck(id);
}

export async function getPdf(id) {
  const cached = await tx('pdfs', 'readonly', (s) => s.get(id));
  if (cached) return cached;
  const r = await remote();
  if (!r) return null;
  const owner = must(await r.sb.from('decks').select('user_id').eq('id', id).maybeSingle())?.user_id;
  if (!owner) throw new Error('Presentación no encontrada');
  const blob = must(await r.sb.storage.from('slides').download(pdfPath(owner, id)));
  await tx('pdfs', 'readwrite', (s) => s.put(blob, id));
  return blob;
}

async function savePdf(id, pdf, ownerId) {
  const r = await remote();
  if (r) must(await r.sb.storage.from('slides').upload(pdfPath(ownerId || r.user.id, id), pdf, { contentType: 'application/pdf', upsert: true }));
  await tx('pdfs', 'readwrite', (s) => s.put(pdf, id));
}

export async function createDeck({ title, fileName, pdf, notes, targetMinutes }) {
  const id = crypto.randomUUID();
  const base = { id, title, fileName, createdAt: new Date().toISOString(), targetMinutes, notes, plan: [], types: [], skipped: [], presenterOf: [], presenters: [], slideCount: null, sessions: [] };
  const r = await remote();
  await savePdf(id, pdf);
  if (!r) return putDeck(base);
  must(await r.sb.from('decks').insert({ id, user_id: r.user.id, data: pick(base, META) }));
  if (notes.length) must(await r.sb.from('slides').insert(notes.map((t, idx) => ({ deck_id: id, idx, notes: t || '' }))));
  return getDeck(id);
}

export async function deleteDeck(id) {
  const r = await remote();
  if (r) {
    const d = await getDeck(id);
    const audios = d.sessions.map((x) => x.audio?.path).filter(Boolean);
    if (audios.length) await r.sb.storage.from(AUDIO).remove(audios);
    must(await r.sb.from('decks').delete().eq('id', id));
    await r.sb.storage.from('slides').remove([pdfPath(d.ownerId, id)]);
  } else await tx('decks', 'readwrite', (s) => s.delete(id));
  await tx('pdfs', 'readwrite', (s) => s.delete(id));
}

// ─── Ensayos ─────────────────────────────────────────────────────────────────
export const addSession = async (id, s) => {
  const session = { id: crypto.randomUUID(), at: new Date().toISOString(), ...s };
  const r = await remote();
  if (r) must(await r.sb.from('rehearsals').insert({ id: session.id, deck_id: id, data: session }));
  else { const d = await getDeck(id); await putDeck({ ...d, sessions: [...d.sessions, session] }); }
  return session;
};

async function setSessionAudio(deckId, sessionId, audio) {
  const r = await remote();
  if (!r) { const d = await getDeck(deckId); return putDeck({ ...d, sessions: d.sessions.map((x) => (x.id === sessionId ? { ...x, audio } : x)) }); }
  const row = must(await r.sb.from('rehearsals').select('data').eq('id', sessionId).single());
  must(await r.sb.from('rehearsals').update({ data: { ...row.data, audio } }).eq('id', sessionId));
  return getDeck(deckId);
}

// Borrar un ensayo borra su grabación.
export async function deleteSession(deckId, sessionId) {
  const r = await remote();
  const d = await getDeck(deckId);
  const x = d.sessions.find((s) => s.id === sessionId);
  if (x?.audio?.path) await (await supabase())?.storage.from(AUDIO).remove([x.audio.path]);
  if (r) { must(await r.sb.from('rehearsals').delete().eq('id', sessionId)); return getDeck(deckId); }
  return putDeck({ ...d, sessions: d.sessions.filter((s) => s.id !== sessionId) });
}

// Al iniciar sesión: sube a la cuenta las presentaciones creadas como invitado y las quita del modo local.
export async function importLocalDecks() {
  const local = await listLocalDecks();
  const r = await remote();
  for (const d of local) {
    const pdf = await tx('pdfs', 'readonly', (s) => s.get(d.id));
    const created = await createDeck({ title: d.title, fileName: d.fileName, pdf, notes: d.notes || [], targetMinutes: d.targetMinutes });
    const { id: _i, createdAt: _c, sessions, presenters, ...rest } = d;
    await updateDeck(created.id, { ...rest, presenterOf: [] }); // los presentadores locales no se migran
    for (const s of sessions || []) must(await r.sb.from('rehearsals').insert({ id: s.id, deck_id: created.id, data: s }));
    await tx('decks', 'readwrite', (s) => s.delete(d.id));
    await tx('pdfs', 'readwrite', (s) => s.delete(d.id));
  }
  return local.length;
}

// Al cerrar sesión: borrar la caché local de PDFs de la cuenta (privacidad en equipos compartidos).
export const clearPdfCache = () => tx('pdfs', 'readwrite', (s) => s.clear());

// Duplicar: misma presentación (PDF, notas, plan) sin ensayos ni grupo.
export async function duplicateDeck(id) {
  const d = await getDeck(id);
  const pdf = await getPdf(id);
  const copy = await createDeck({ title: `${d.title} (copia)`, fileName: d.fileName, pdf, notes: d.notes, targetMinutes: d.targetMinutes });
  return updateDeck(copy.id, { ...pick(d, META), title: copy.title, createdAt: copy.createdAt, plan: d.plan, types: d.types, skipped: d.skipped });
}

export async function downloadPdf(d) {
  const blob = await getPdf(d.id);
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `${d.title}.pdf` });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// Reemplazar el archivo (solo propietario): nuevo PDF; si trae notas (PPTX) sustituyen a las anteriores.
export async function replaceDeckFile(id, { pdf, notes, hasNotes, main }) {
  const d = await getDeck(id);
  if (!d.isOwner) throw new Error('Solo el propietario puede reemplazar el archivo.');
  await savePdf(id, pdf, d.ownerId);
  return updateDeck(id, { fileName: main.name, slideCount: null, ...(hasNotes && { notes }) });
}

// ─── Grupos: miembros, invitaciones y presentadores ──────────────────────────
export async function createInvite(deckId) {
  const r = await remote();
  return must(await r.sb.from('deck_invites').insert({ deck_id: deckId }).select().single());
}
export const listInvites = async (deckId) => must(await (await supabase()).from('deck_invites').select('*').eq('deck_id', deckId).eq('revoked', false).gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }));
export const revokeInvite = async (token) => must(await (await supabase()).from('deck_invites').update({ revoked: true }).eq('token', token));
export const acceptInvite = async (token) => must(await (await supabase()).rpc('accept_deck_invite', { t: token }));
export const memberEmails = async (deckId) => must(await (await supabase()).rpc('deck_member_emails', { d: deckId }));
export const removeMember = async (deckId, userId) => must(await (await supabase()).from('deck_members').delete().eq('deck_id', deckId).eq('user_id', userId));

export async function addPresenter(deckId, name, userId = null) {
  const r = await remote();
  if (!r) { const d = await getDeck(deckId); return putDeck({ ...d, presenters: [...d.presenters, { id: crypto.randomUUID(), name, user_id: null }] }); }
  must(await r.sb.from('deck_presenters').insert({ deck_id: deckId, name, user_id: userId }));
  return getDeck(deckId);
}
export async function updatePresenter(deckId, presenterId, patch) {
  const r = await remote();
  if (!r) { const d = await getDeck(deckId); return putDeck({ ...d, presenters: d.presenters.map((p) => (p.id === presenterId ? { ...p, ...patch } : p)) }); }
  must(await r.sb.from('deck_presenters').update(patch).eq('id', presenterId));
  return getDeck(deckId);
}
export async function deletePresenter(deckId, presenterId) {
  const r = await remote();
  if (!r) { const d = await getDeck(deckId); return putDeck({ ...d, presenters: d.presenters.filter((p) => p.id !== presenterId), presenterOf: (d.presenterOf || []).map((x) => (x === presenterId ? null : x)) }); }
  must(await r.sb.from('deck_presenters').delete().eq('id', presenterId));
  return getDeck(deckId);
}
export async function assignPresenter(deckId, idxs, presenterId) {
  const d = await getDeck(deckId);
  const p = Array.from({ length: slideCountOf(d) }, (_, i) => d.presenterOf?.[i] ?? null);
  for (const i of idxs) p[i] = presenterId;
  return updateDeck(deckId, { presenterOf: p });
}

// Cambios de otros miembros en vivo (Supabase Realtime; respeta RLS).
export async function subscribeDeck(deckId, onChange) {
  const sb = await supabase();
  if (!sb || !(await currentUser())) return () => {};
  const ch = sb.channel(`deck-${deckId}`);
  for (const table of ['slides', 'deck_presenters', 'deck_members']) ch.on('postgres_changes', { event: '*', schema: 'public', table, filter: `deck_id=eq.${deckId}` }, (p) => onChange(table, p));
  ch.subscribe();
  return () => sb.removeChannel(ch);
}

// ─── Exportar y borrar cuenta ────────────────────────────────────────────────
// Exportar mis datos: ZIP con un JSON de presentaciones/ensayos/eventos, los PDF y las grabaciones.
export async function exportData(user) {
  const { default: JSZip } = await import('jszip');
  const decks = await listDecks();
  const zip = new JSZip();
  let events = [];
  const r = await remote();
  if (r) {
    const q = async (t) => must(await r.sb.from(t).select('*'));
    const [ev, sp, se, ta, ts, pa, po] = await Promise.all(['events', 'speakers', 'sessions', 'talks', 'talk_speakers', 'panels', 'posters'].map((t) => q(t).catch(() => [])));
    events = ev.map((e) => ({ ...e, speakers: sp.filter((x) => x.event_id === e.id), sessions: se.filter((x) => x.event_id === e.id).map((x) => ({ ...x, talks: ta.filter((t) => t.session_id === x.id).map((t) => ({ ...t, speakers: ts.filter((y) => y.talk_id === t.id).map((y) => y.speaker_id) })) })), panels: pa.filter((x) => x.event_id === e.id), posters: po.filter((x) => x.event_id === e.id) }));
  }
  const plain = decks.map(({ groupSessions, members, ...d }) => d);
  zip.file('temposlide.json', JSON.stringify({ exportedAt: new Date().toISOString(), user: user && { id: user.id, email: user.email, name: user.user_metadata?.full_name || null }, decks: plain, events }, null, 2));
  for (const d of decks) {
    const pdf = await getPdf(d.id).catch(() => null);
    if (pdf) zip.file(`presentaciones/${d.title.replace(/[\\/:*?"<>|]/g, '_')}-${d.id.slice(0, 8)}.pdf`, pdf);
  }
  for (const d of decks) for (const x of d.sessions || []) {
    if (!x.audio?.path) continue;
    const blob = await downloadAudio(x.audio.path).catch(() => null);
    if (blob) zip.file(`grabaciones/${x.at.slice(0, 16).replace(/[:T]/g, '-')}-${x.id.slice(0, 8)}.${x.audio.path.split('.').pop()}`, blob);
  }
  return zip.generateAsync({ type: 'blob' });
}

// Borrar la cuenta: PDF y audios de Storage → usuario (presentaciones, ensayos y membresías caen en cascada).
export async function deleteAccount() {
  const r = await remote();
  if (!r) throw new Error('No hay sesión');
  const files = must(await r.sb.storage.from('slides').list(r.user.id, { limit: 1000 }));
  if (files.length) must(await r.sb.storage.from('slides').remove(files.map((f) => `${r.user.id}/${f.name}`)));
  const audio = await listAudio(r);
  if (audio.length) must(await r.sb.storage.from(AUDIO).remove(audio.map((f) => `${r.user.id}/${f.name}`)));
  must(await r.sb.from('decks').delete().eq('user_id', r.user.id));
  must(await r.sb.rpc('delete_account'));
  await clearPdfCache();
  await r.sb.auth.signOut({ scope: 'local' });
}

// ─── Grabaciones de ensayos ──────────────────────────────────────────────────
// Bucket privado rehearsal-audio/{user}/{ensayo}.webm|m4a. Solo lo escucha quien lo grabó (URL firmada de 1 h),
// también en presentaciones grupales: la política de Storage es por carpeta de usuario.
// ponytail: el cupo se comprueba en el cliente; con planes de pago, comprobarlo en el servidor.
export const AUDIO_QUOTA = 300 * 1024 * 1024;
const listAudio = async (r) => must(await r.sb.storage.from(AUDIO).list(r.user.id, { limit: 1000 }));
export async function audioUsage() {
  const r = await remote();
  if (!r) return null;
  return (await listAudio(r)).reduce((a, f) => a + (f.metadata?.size || 0), 0);
}
export const audioUrl = async (path) => must(await (await supabase()).storage.from(AUDIO).createSignedUrl(path, 3600)).signedUrl;
export const downloadAudio = async (path) => must(await (await supabase()).storage.from(AUDIO).download(path));

// Sube la grabación de un ensayo. Si falla (red), queda pendiente en IndexedDB y se reintenta al abrir la app.
export async function saveRehearsalAudio(deckId, sessionId, blob, meta) {
  const r = await remote();
  if (!r) throw new Error('Inicia sesión para guardar grabaciones en tu cuenta.');
  const used = await audioUsage();
  if (used + blob.size > AUDIO_QUOTA) throw Object.assign(new Error('Has llenado tu espacio de grabaciones (300 MB). Borra grabaciones antiguas desde Ensayos para guardar esta.'), { quota: true });
  const ext = blob.type.includes('mp4') ? 'm4a' : 'webm';
  const path = `${r.user.id}/${sessionId}.${ext}`;
  try {
    must(await r.sb.storage.from(AUDIO).upload(path, blob, { contentType: blob.type.split(';')[0], upsert: true }));
  } catch (e) {
    await tx('pendingAudio', 'readwrite', (s) => s.put({ deckId, sessionId, blob, meta }, sessionId));
    throw Object.assign(new Error('No se pudo subir la grabación. Queda pendiente y se subirá al volver a abrir TempoSlide.'), { pending: true });
  }
  return setSessionAudio(deckId, sessionId, { path, bytes: blob.size, ...meta });
}

export async function retryPendingAudio() {
  const r = await remote();
  if (!r) return 0;
  const keys = (await tx('pendingAudio', 'readonly', (s) => s.getAllKeys())) || [];
  let ok = 0;
  for (const k of keys) {
    const p = await tx('pendingAudio', 'readonly', (s) => s.get(k));
    try {
      await tx('pendingAudio', 'readwrite', (s) => s.delete(k));
      await saveRehearsalAudio(p.deckId, p.sessionId, p.blob, p.meta);
      ok++;
    } catch { /* vuelve a quedar pendiente dentro de saveRehearsalAudio */ }
  }
  return ok;
}
export const pendingAudioCount = async () => ((await tx('pendingAudio', 'readonly', (s) => s.count())) || 0);

export async function deleteSessionAudio(deckId, sessionId) {
  const d = await getDeck(deckId);
  const x = d.sessions.find((s) => s.id === sessionId);
  if (x?.audio?.path) must(await (await supabase()).storage.from(AUDIO).remove([x.audio.path]));
  return setSessionAudio(deckId, sessionId, null);
}
