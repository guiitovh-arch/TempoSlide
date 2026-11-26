// Comprobación mínima: lógica de tiempos + extracción de notas del PPTX de prueba.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { fmt, estimateSlides, budgets, band, pace, phase, perSlide, cuts, markedTimes, rehearsalStats, analyze, trimPlan } from '../src/lib.js';
import { pptxNotes } from '../src/pptx.js';

assert.equal(fmt(65_000), '01:05');
assert.equal(fmt(-5_000), '−00:05');
assert.equal(fmt(5_000, true), '+00:05');

const notes = ['uno dos tres', '', 'a '.repeat(130)];
const est = estimateSlides(notes, 3);
assert.equal(est[1], 15); // mínimo por diapositiva
assert.ok(Math.abs(est[2] - 68) < 0.01); // 130 palabras a 130 ppm = 60 s + 8 s

const b = budgets({ notes, targetMinutes: 2, slideTargets: null }, 3);
assert.ok(Math.abs(b.reduce((a, x) => a + x, 0) - 120) <= 1); // reparto suma el objetivo
assert.deepEqual(budgets({ notes, targetMinutes: 2, slideTargets: [1, 2, 3] }, 3), [1, 2, 3]);

assert.equal(band(100, 200).key, 'short');
assert.equal(band(200, 200).key, 'tight');
assert.equal(band(250, 200).key, 'over');

assert.equal(pace([10, 10], 1, 5_000, 15_000), 0); // justo en plan
assert.equal(pace([10, 10], 1, 5_000, 20_000), -5_000); // 5 s tarde
assert.equal(phase(-1, 100), 'over');
assert.equal(phase(5, 100), 'danger');
assert.equal(phase(20, 100), 'warn');
assert.deepEqual(perSlide([{ index: 0, ms: 5 }, { index: 1, ms: 3 }, { index: 0, ms: 2 }], 2), [7, 3]);

const sk = budgets({ notes, targetMinutes: 2, slideTargets: null, skipped: [false, true, false] }, 3);
assert.equal(sk[1], 0); // omitida
assert.ok(Math.abs(sk[0] + sk[2] - 120) <= 1);
assert.deepEqual(cuts([10, 10, 10], [10_000, 25_000, 14_000]).map((c) => c.index), [1, 2]);

assert.deepEqual(markedTimes(['(1,5 min) hola', '(10 seg) x', 'nada']), [90, 10, 0]);
assert.equal(markedTimes(['sin marcas']), null);

// Deck real del usuario (no versionado): solo si está presente.
const tfmPath = new URL('./PraxiaJob_Defensa_TFM.pptx', import.meta.url);
if (await fs.stat(tfmPath).catch(() => null)) {
  const tfm = await pptxNotes(await fs.readFile(tfmPath));
  assert.equal(tfm.length, 33);
  const marks = markedTimes(tfm);
  assert.deepEqual(marks.slice(0, 3), [20, 5, 35]);
  assert.equal(marks[32], 0); // anexo sin marca
  console.log('✓ deck TFM: 33 diapositivas, notas y marcas de tiempo');
}


const n = await pptxNotes(await fs.readFile(new URL('./tfm-demo.pptx', import.meta.url)));
assert.equal(n.length, 6);
assert.match(n[0], /^Buenos días, tribunal/);
const st = rehearsalStats([
  { sessions: [{ at: '2026-11-26T10:00:00Z', totalMs: 600_000, targetMs: 600_000 }, { at: '2026-11-25T10:00:00Z', totalMs: 660_000, targetMs: 600_000 }] },
  { sessions: [{ at: '2026-11-23T10:00:00Z', totalMs: 300_000, targetMs: 600_000 }] },
], new Date('2026-11-26T20:00:00Z'));
assert.deepEqual([st.decks, st.sessions, st.best, st.streak], [2, 3, 0, 2]); // racha 25-26, rota el 24
assert.equal(rehearsalStats([{ sessions: [{ at: '2026-11-25T10:00:00Z', totalMs: 1, targetMs: 1 }] }], new Date('2026-11-26T09:00:00Z')).streak, 1); // ayer cuenta
assert.equal(rehearsalStats([]).best, null);
const a = analyze(600, 600);
assert.equal(a.verdict, 'tight');
assert.ok(Math.abs(a.pOver - 0.5) < 0.01); // justo en el límite: 50 %
assert.ok(analyze(400, 600).pOver < 0.01 && analyze(400, 600).verdict === 'short');
assert.ok(analyze(800, 600).pOver > 0.95 && analyze(800, 600).verdict === 'over');
assert.equal(analyze(600, 600, 'reunion').mid, 690);
const tp = trimPlan(['a '.repeat(100), 'b '.repeat(300), 'c '.repeat(50)], [false, false, false], 60, 130, 2);
assert.equal(tp.toCut, 130);
assert.deepEqual(tp.slides.map((x) => [x.index, x.cut]), [[1, 98], [0, 33]]);
assert.equal(tp.rest, 0);
const big = trimPlan(['a '.repeat(100)], [false], 600); // 1300 palabras sobre 100 disponibles
assert.deepEqual([big.slides[0].cut, big.rest], [40, 1260]); // nunca más del 40 % de una diapositiva
console.log('✓ smoke OK');
