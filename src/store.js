// Biblioteca local en IndexedDB: cada usuario guarda sus presentaciones y ensayos en su navegador.
// ponytail: sin cuentas ni sincronización; añadir backend + auth cuando haga falta multi-dispositivo.
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

export const listDecks = async () => ((await tx('decks', 'readonly', (s) => s.getAll())) || []).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
export const getDeck = (id) => tx('decks', 'readonly', (s) => s.get(id));
export const getPdf = (id) => tx('pdfs', 'readonly', (s) => s.get(id));
export const putDeck = (d) => tx('decks', 'readwrite', (s) => s.put(d)).then(() => d);
export const updateDeck = async (id, patch) => putDeck({ ...(await getDeck(id)), ...patch });
export const deleteDeck = async (id) => { await tx('decks', 'readwrite', (s) => s.delete(id)); await tx('pdfs', 'readwrite', (s) => s.delete(id)); };
export const addSession = async (id, s) => {
  const d = await getDeck(id);
  const session = { id: crypto.randomUUID(), at: new Date().toISOString(), ...s };
  await putDeck({ ...d, sessions: [...d.sessions, session] });
  return session;
};

export async function createDeck({ title, fileName, pdf, notes, targetMinutes }) {
  const id = crypto.randomUUID();
  await tx('pdfs', 'readwrite', (s) => s.put(pdf, id));
  return putDeck({ id, title, fileName, createdAt: new Date().toISOString(), targetMinutes, wpm: 130, notes, slideTargets: null, skipped: [], slideCount: null, sessions: [] });
}
