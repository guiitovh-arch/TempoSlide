// TempoSlide API: subida de presentaciones (PPTX/PPT/ODP/KEY → PDF vía LibreOffice), notas del orador y ensayos.
// ponytail: almacenamiento en disco (data/<id>/meta.json) sin cuentas; pasar a una BD + auth cuando haya multiusuario real.
import express from 'express';
import multer from 'multer';
import JSZip from 'jszip';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const run = promisify(execFile);
const DATA = path.resolve(process.env.DATA_DIR || 'data');
const PORT = process.env.PORT || 3000;
await fs.mkdir(DATA, { recursive: true });

const app = express();
app.use(express.json({ limit: '2mb' }));
const upload = multer({ dest: path.join(DATA, 'tmp'), limits: { fileSize: 100 * 1024 * 1024 } });

const dir = (id) => {
  if (!/^[0-9a-f-]{36}$/.test(id)) throw Object.assign(new Error('id inválido'), { status: 400 });
  return path.join(DATA, id);
};
const readMeta = async (id) => JSON.parse(await fs.readFile(path.join(dir(id), 'meta.json'), 'utf8'));
const writeMeta = (m) => fs.writeFile(path.join(dir(m.id), 'meta.json'), JSON.stringify(m, null, 2));

const decode = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const paragraphs = (xml) =>
  (xml.match(/<a:p>[\s\S]*?<\/a:p>|<a:p [\s\S]*?<\/a:p>/g) || [])
    .map((p) => decode((p.match(/<a:t>([^<]*)<\/a:t>/g) || []).map((t) => t.slice(5, -6)).join('')))
    .filter(Boolean);

// Notas del orador de un .pptx, en el orden real de las diapositivas.
export async function pptxNotes(buf) {
  const zip = await JSZip.loadAsync(buf);
  const read = (f) => zip.file(f)?.async('string') ?? '';
  const pres = await read('ppt/presentation.xml');
  const presRels = await read('ppt/_rels/presentation.xml.rels');
  const target = (rels, rid) => rels.match(new RegExp(`Id="${rid}"[^>]*Target="([^"]+)"`))?.[1] || rels.match(new RegExp(`Target="([^"]+)"[^>]*Id="${rid}"`))?.[1];
  const rids = [...pres.matchAll(/<p:sldId [^>]*r:id="([^"]+)"/g)].map((m) => m[1]);
  return Promise.all(
    rids.map(async (rid) => {
      const slide = target(presRels, rid)?.replace(/^\/?(ppt\/)?/, '');
      if (!slide) return '';
      const rels = await read(`ppt/${path.posix.dirname(slide)}/_rels/${path.posix.basename(slide)}.rels`);
      const notes = rels.match(/Target="([^"]*notesSlide[^"]*)"/)?.[1];
      if (!notes) return '';
      const xml = await read(path.posix.normalize(`ppt/${path.posix.dirname(slide)}/${notes}`));
      // Solo el placeholder "body" (el resto es nº de diapositiva / miniatura).
      const body = (xml.match(/<p:sp>[\s\S]*?<\/p:sp>/g) || []).find((sp) => /<p:ph [^>]*type="body"/.test(sp));
      return paragraphs(body || '').join('\n');
    })
  );
}

app.get('/api/presentations', async (_req, res) => {
  const ids = (await fs.readdir(DATA)).filter((d) => d.length === 36);
  const all = (await Promise.all(ids.map((id) => readMeta(id).catch(() => null)))).filter(Boolean);
  res.json(all.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
});

app.get('/api/presentations/:id', async (req, res) => res.json(await readMeta(req.params.id)));

app.get('/api/presentations/:id/slides.pdf', (req, res) => res.sendFile(path.join(dir(req.params.id), 'slides.pdf')));

app.post('/api/presentations', upload.single('file'), async (req, res) => {
  const f = req.file;
  if (!f) return res.status(400).json({ error: 'Falta el archivo' });
  const ext = path.extname(f.originalname).toLowerCase();
  if (!['.pptx', '.ppt', '.odp', '.key', '.pdf'].includes(ext)) {
    await fs.rm(f.path, { force: true });
    return res.status(400).json({ error: 'Formato no soportado. Usa PPTX, PPT, ODP, KEY o PDF.' });
  }
  const id = randomUUID();
  const d = path.join(DATA, id);
  await fs.mkdir(d);
  const src = path.join(d, 'source' + ext);
  await fs.rename(f.path, src);
  try {
    if (ext === '.pdf') await fs.copyFile(src, path.join(d, 'slides.pdf'));
    else {
      await run('soffice', ['--headless', `-env:UserInstallation=file://${path.join(DATA, 'lo-profile')}`, '--convert-to', 'pdf', '--outdir', d, src], { timeout: 120_000 });
      await fs.rename(path.join(d, 'source.pdf'), path.join(d, 'slides.pdf'));
    }
  } catch (e) {
    await fs.rm(d, { recursive: true, force: true });
    return res.status(422).json({ error: 'No se pudo convertir la presentación', detail: String(e.message).slice(0, 300) });
  }
  const notes = ext === '.pptx' ? await pptxNotes(await fs.readFile(src)).catch(() => []) : [];
  const meta = {
    id,
    title: req.body.title?.trim() || path.basename(f.originalname, ext),
    fileName: f.originalname,
    createdAt: new Date().toISOString(),
    targetMinutes: Number(req.body.targetMinutes) || 10,
    notes, // índice = diapositiva; se completa con el nº real de páginas desde el cliente
    slideTargets: null, // segundos por diapositiva; null = reparto automático
    sessions: [],
  };
  await writeMeta(meta);
  res.status(201).json(meta);
});

app.patch('/api/presentations/:id', async (req, res) => {
  const m = await readMeta(req.params.id);
  for (const k of ['title', 'targetMinutes', 'notes', 'slideTargets', 'slideCount']) if (k in req.body) m[k] = req.body[k];
  await writeMeta(m);
  res.json(m);
});

app.delete('/api/presentations/:id', async (req, res) => {
  await fs.rm(dir(req.params.id), { recursive: true, force: true });
  res.status(204).end();
});

app.post('/api/presentations/:id/sessions', async (req, res) => {
  const m = await readMeta(req.params.id);
  const { totalMs, slides, targetMs, mode } = req.body;
  if (!Number.isFinite(totalMs) || !Array.isArray(slides)) return res.status(400).json({ error: 'Ensayo inválido' });
  const s = { id: randomUUID(), at: new Date().toISOString(), totalMs, targetMs, mode: mode || 'ensayo', slides: slides.map((x) => ({ index: +x.index, ms: +x.ms })) };
  m.sessions.push(s);
  await writeMeta(m);
  res.status(201).json(s);
});

app.delete('/api/presentations/:id/sessions/:sid', async (req, res) => {
  const m = await readMeta(req.params.id);
  m.sessions = m.sessions.filter((s) => s.id !== req.params.sid);
  await writeMeta(m);
  res.status(204).end();
});

// Frontend compilado (npm run build)
app.use(express.static('dist'));
app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.resolve('dist/index.html')));

app.use((err, _req, res, _next) => res.status(err.status || (err.code === 'ENOENT' ? 404 : 500)).json({ error: err.message }));

if (process.argv[1] === new URL(import.meta.url).pathname) app.listen(PORT, () => console.log(`TempoSlide → http://localhost:${PORT}`));
export default app;
