// Biblioteca de presentaciones.
// - Con sesión de Supabase: tabla `decks` (jsonb) + PDF en Storage `slides/<user>/<deck>.pdf` (ver supabase/schema.sql).
// - Sin sesión (modo invitado): todo en IndexedDB, en este navegador.
// En ambos casos el PDF se cachea en IndexedDB para no descargarlo en cada visita.
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
const pdfPath = (user, id) => `${user.id}/${id}.pdf`;

export const listLocalDecks = async () => ((await tx('decks', 'readonly', (s) => s.getAll())) || []).sort(byDate);

export async function listDecks() {
  const r = await remote();
  if (!r) return listLocalDecks();
  return must(await r.sb.from('decks').select('data').order('created_at', { ascending: false })).map((x) => x.data);
}

export async function getDeck(id) {
  const r = await remote();
  if (!r) return tx('decks', 'readonly', (s) => s.get(id));
  return must(await r.sb.from('decks').select('data').eq('id', id).maybeSingle())?.data;
}

export async function putDeck(d) {
  const r = await remote();
  if (!r) await tx('decks', 'readwrite', (s) => s.put(d));
  else must(await r.sb.from('decks').upsert({ id: d.id, data: d, updated_at: new Date().toISOString() }));
  return d;
}

export async function getPdf(id) {
  const cached = await tx('pdfs', 'readonly', (s) => s.get(id));
  if (cached) return cached;
  const r = await remote();
  if (!r) return null;
  const blob = must(await r.sb.storage.from('slides').download(pdfPath(r.user, id)));
  await tx('pdfs', 'readwrite', (s) => s.put(blob, id));
  return blob;
}

export const updateDeck = async (id, patch) => putDeck({ ...(await getDeck(id)), ...patch });

export async function deleteDeck(id) {
  const r = await remote();
  if (r) {
    const d = await getDeck(id);
    const audios = (d?.sessions || []).map((x) => x.audio?.path).filter(Boolean);
    if (audios.length) await r.sb.storage.from(AUDIO).remove(audios);
    must(await r.sb.from('decks').delete().eq('id', id));
    await r.sb.storage.from('slides').remove([pdfPath(r.user, id)]);
  } else await tx('decks', 'readwrite', (s) => s.delete(id));
  await tx('pdfs', 'readwrite', (s) => s.delete(id));
}

export const addSession = async (id, s) => {
  const d = await getDeck(id);
  const session = { id: crypto.randomUUID(), at: new Date().toISOString(), ...s };
  await putDeck({ ...d, sessions: [...d.sessions, session] });
  return session;
};

async function savePdf(id, pdf) {
  const r = await remote();
  if (r) must(await r.sb.storage.from('slides').upload(pdfPath(r.user, id), pdf, { contentType: 'application/pdf', upsert: true }));
  await tx('pdfs', 'readwrite', (s) => s.put(pdf, id));
}

export async function createDeck({ title, fileName, pdf, notes, targetMinutes }) {
  const id = crypto.randomUUID();
  await savePdf(id, pdf);
  return putDeck({ id, title, fileName, createdAt: new Date().toISOString(), targetMinutes, notes, plan: null, skipped: [], slideCount: null, sessions: [] });
}

// Al iniciar sesión: sube a la cuenta las presentaciones creadas como invitado y las quita del modo local.
export async function importLocalDecks() {
  const local = await listLocalDecks();
  for (const d of local) {
    const pdf = await tx('pdfs', 'readonly', (s) => s.get(d.id));
    if (pdf) await savePdf(d.id, pdf);
    await putDeck(d);
    await tx('decks', 'readwrite', (s) => s.delete(d.id));
  }
  return local.length;
}

// Al cerrar sesión: borrar la caché local de PDFs de la cuenta (privacidad en equipos compartidos).
export const clearPdfCache = () => tx('pdfs', 'readwrite', (s) => s.clear());

// Exportar mis datos: ZIP con un JSON de presentaciones/ensayos y los PDF.
export async function exportData(user) {
  const { default: JSZip } = await import('jszip');
  const decks = await listDecks();
  const zip = new JSZip();
  zip.file('temposlide.json', JSON.stringify({ exportedAt: new Date().toISOString(), user: user && { id: user.id, email: user.email, name: user.user_metadata?.full_name || null }, decks }, null, 2));
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

// Borrar la cuenta: PDF de Storage → usuario (los decks caen en cascada) → caché local.
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

// Duplicar: misma presentación (PDF, notas, plan) sin ensayos.
export async function duplicateDeck(id) {
  const d = await getDeck(id);
  const pdf = await getPdf(id);
  const copy = await createDeck({ title: `${d.title} (copia)`, fileName: d.fileName, pdf, notes: d.notes, targetMinutes: d.targetMinutes });
  const { id: _i, createdAt: _c, sessions: _s, title: _t, ...rest } = d;
  return putDeck({ ...copy, ...rest });
}

export async function downloadPdf(d) {
  const blob = await getPdf(d.id);
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `${d.title}.pdf` });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ─── Grabaciones de ensayos ──────────────────────────────────────────────────
// Bucket privado rehearsal-audio/{user}/{ensayo}.webm|m4a. Solo lo escucha quien lo grabó (URL firmada de 1 h).
// ponytail: el cupo se comprueba en el cliente; con planes de pago, comprobarlo en el servidor.
const AUDIO = 'rehearsal-audio';
export const AUDIO_QUOTA = 300 * 1024 * 1024;
const listAudio = async (r) => must(await r.sb.storage.from(AUDIO).list(r.user.id, { limit: 1000 }));
export async function audioUsage() {
  const r = await remote();
  if (!r) return null;
  return (await listAudio(r)).reduce((a, f) => a + (f.metadata?.size || 0), 0);
}
export const audioUrl = async (path) => must(await (await supabase()).storage.from(AUDIO).createSignedUrl(path, 3600)).signedUrl;
export const downloadAudio = async (path) => must(await (await supabase()).storage.from(AUDIO).download(path));

async function setSessionAudio(deckId, sessionId, audio) {
  const d = await getDeck(deckId);
  return putDeck({ ...d, sessions: d.sessions.map((x) => (x.id === sessionId ? { ...x, audio } : x)) });
}

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

// Borrar un ensayo borra su grabación.
export async function deleteSession(deckId, sessionId) {
  const d = await getDeck(deckId);
  const x = d.sessions.find((s) => s.id === sessionId);
  if (x?.audio?.path) await (await supabase())?.storage.from(AUDIO).remove([x.audio.path]);
  return putDeck({ ...d, sessions: d.sessions.filter((s) => s.id !== sessionId) });
}

// Reemplazar el archivo: nuevo PDF; si trae notas (PPTX) sustituyen a las anteriores. El plan y los ensayos se conservan.
export async function replaceDeckFile(id, { pdf, notes, hasNotes, main }) {
  await savePdf(id, pdf);
  return updateDeck(id, { fileName: main.name, slideCount: null, ...(hasNotes && { notes }) });
}
