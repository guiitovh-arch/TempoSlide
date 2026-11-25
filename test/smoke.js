// Comprobación mínima: lógica de tiempos + extracción de notas del PPTX de prueba.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { fmt, estimateSlides, budgets, band, pace, phase, perSlide } from '../src/lib.js';
import { pptxNotes } from '../server.js';

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

const n = await pptxNotes(await fs.readFile(new URL('./tfm-demo.pptx', import.meta.url)));
assert.equal(n.length, 6);
assert.match(n[0], /^Buenos días, tribunal/);
console.log('✓ smoke OK');
