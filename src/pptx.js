// Notas del orador de un .pptx, en el orden real de las diapositivas (navegador y Node).
import JSZip from 'jszip';

const decode = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const paragraphs = (xml) =>
  (xml.match(/<a:p>[\s\S]*?<\/a:p>|<a:p [\s\S]*?<\/a:p>/g) || [])
    .map((p) => decode((p.match(/<a:t>([^<]*)<\/a:t>/g) || []).map((t) => t.slice(5, -6)).join('')))
    .filter(Boolean);
const dirname = (p) => p.slice(0, p.lastIndexOf('/'));
const basename = (p) => p.slice(p.lastIndexOf('/') + 1);
const normalize = (p) => p.split('/').reduce((a, s) => (s === '..' ? a.slice(0, -1) : s && s !== '.' ? [...a, s] : a), []).join('/');

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
      const rels = await read(`ppt/${dirname(slide)}/_rels/${basename(slide)}.rels`);
      const notes = rels.match(/Target="([^"]*notesSlide[^"]*)"/)?.[1];
      if (!notes) return '';
      const xml = await read(normalize(`ppt/${dirname(slide)}/${notes}`));
      // Solo el placeholder "body" (el resto es nº de diapositiva / miniatura).
      const body = (xml.match(/<p:sp>[\s\S]*?<\/p:sp>/g) || []).find((sp) => /<p:ph [^>]*type="body"/.test(sp));
      return paragraphs(body || '').join('\n');
    })
  );
}
