// Biblioteca de presentaciones.
// - Con sesión de Supabase: tabla `decks` (jsonb) + PDF en Storage `slides/<user>/<deck>.pdf` (ver supabase/schema.sql).
// - Sin sesión (modo invitado): todo en IndexedDB, en este navegador.
// En ambos casos el PDF se cachea en IndexedDB para no descargarlo en cada visita.
import { supabase, currentUser } from './supabase.js';

const open = () =>
  new Promise((res, rej) => {
    const r = indexedDB.open('temposlide', 1);
    r.onupgradeneeded = () => { r.result.createObjectStore('decks', { keyPath: 'id' }); r.result.createObjectStore('pdfs'); };
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
  return putDeck({ id, title, fileName, createdAt: new Date().toISOString(), targetMinutes, wpm: 130, notes, slideTargets: null, skipped: [], slideCount: null, sessions: [] });
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
  return zip.generateAsync({ type: 'blob' });
}

// Borrar la cuenta: PDF de Storage → usuario (los decks caen en cascada) → caché local.
export async function deleteAccount() {
  const r = await remote();
  if (!r) throw new Error('No hay sesión');
  const files = must(await r.sb.storage.from('slides').list(r.user.id, { limit: 1000 }));
  if (files.length) must(await r.sb.storage.from('slides').remove(files.map((f) => `${r.user.id}/${f.name}`)));
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
