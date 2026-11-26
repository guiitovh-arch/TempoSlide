// De archivos subidos a { pdf, notes, main }: 1 archivo (PPTX/KEY/PDF…) o 2 (PDF para las diapositivas + PPTX para las notas).
import { pptxNotes } from './pptx.js';

export const ACCEPT = '.pptx,.ppt,.key,.odp,.pdf';
const ext = (f) => f.name.toLowerCase().split('.').pop();

export async function filesToDeck(list) {
  const files = [...(list || [])];
  if (!files.length) throw new Error('Elige un archivo.');
  const pdfFile = files.find((f) => ext(f) === 'pdf');
  const src = files.find((f) => ext(f) !== 'pdf');
  if (src && !['pptx', 'ppt', 'key', 'odp', 'pps', 'ppsx'].includes(ext(src))) throw new Error('Formato no soportado. Usa PPTX, PPT, KEY, ODP o PDF.');
  const notes = src && ext(src) === 'pptx' ? await pptxNotes(await src.arrayBuffer()).catch(() => []) : [];
  let pdf = pdfFile;
  if (!pdf) {
    if (src.size > 4.4 * 1024 * 1024) throw new Error('Este archivo pesa más de 4,4 MB y no se puede convertir en el servidor. Expórtalo a PDF desde PowerPoint/Keynote y arrastra el PDF junto al PPTX (así conservamos tus notas).');
    const fd = new FormData();
    fd.append('file', src);
    const r = await fetch('/api/convert', { method: 'POST', body: fd });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `Error al convertir (${r.status})`);
    pdf = await r.blob();
  }
  return { pdf, notes, main: src || pdfFile, hasNotes: !!src && ext(src) === 'pptx' };
}
