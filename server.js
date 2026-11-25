// TempoSlide: sirve el frontend y convierte presentaciones (PPTX/PPT/ODP/KEY → PDF) con LibreOffice.
// Sin estado: el archivo se convierte en un directorio temporal y se borra al responder.
// Las presentaciones y ensayos viven en el navegador del usuario (IndexedDB, ver src/store.js).
import express from 'express';
import multer from 'multer';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const run = promisify(execFile);
const PORT = process.env.PORT || 3000;
const app = express();
const upload = multer({ dest: os.tmpdir(), limits: { fileSize: 100 * 1024 * 1024 } });
const LO_PROFILE = `file://${path.join(os.tmpdir(), 'lo-profile')}`;
let queue = Promise.resolve(); // ponytail: LibreOffice no admite conversiones paralelas con un mismo perfil; cola global

app.post('/api/convert', upload.single('file'), async (req, res) => {
  const f = req.file;
  if (!f) return res.status(400).json({ error: 'Falta el archivo' });
  const ext = path.extname(f.originalname).toLowerCase();
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ts-'));
  try {
    if (!['.pptx', '.ppt', '.odp', '.key', '.pps', '.ppsx'].includes(ext)) return res.status(400).json({ error: 'Formato no soportado. Usa PPTX, PPT, ODP, KEY o PDF.' });
    const src = path.join(dir, 'source' + ext);
    await fs.rename(f.path, src);
    const job = queue.then(() => run('soffice', ['--headless', `-env:UserInstallation=${LO_PROFILE}`, '--convert-to', 'pdf', '--outdir', dir, src], { timeout: 120_000 }));
    queue = job.catch(() => {});
    await job;
    res.type('application/pdf').send(await fs.readFile(path.join(dir, 'source.pdf')));
  } catch (e) {
    res.status(422).json({ error: 'No se pudo convertir la presentación. Prueba a exportarla a PDF.', detail: String(e.message).slice(0, 300) });
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
    await fs.rm(f.path, { force: true });
  }
});

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use(express.static('dist'));
app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.resolve('dist/index.html')));

app.listen(PORT, () => console.log(`TempoSlide → http://localhost:${PORT}`));
