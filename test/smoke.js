// Comprobaciones de la lógica pura (src/lib.js) y de la lectura de notas del PPTX.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as L from '../src/lib.js';
import { pptxNotes } from '../src/pptx.js';

assert.equal(L.fmt(65_000), '01:05');
assert.equal(L.fmt(-5_000), '−00:05');
assert.equal(L.fmt(5_000, true), '+00:05');

// 7.4 · campo de plan: "15" es 15, nunca "015"; vacío = sin plan manual; tope 600 s
assert.equal(L.cleanPlanInput('015'), '15');
assert.equal(L.cleanPlanInput('0'), '0');
assert.equal(L.cleanPlanInput('1a5s'), '15');
assert.equal(L.parsePlan('15'), 15);
assert.equal(L.parsePlan(''), null);
assert.equal(L.parsePlan('999'), 600);

// 7.3 · el plan manual manda; sin él se propone por notas (150 ppm + 2 s) o por tipo
const deck = { notes: ['', 'a '.repeat(150), 'b '.repeat(300), ''], plan: [null, null, 45, null], skipped: [false, false, false, false] };
let sl = L.deckSlides(deck, 4);
assert.deepEqual(sl.map((s) => s.plan), [10, 62, 45, 15]); // título 10 s · 150 palabras = 60+2 · manual 45 · cierre 15
assert.equal(L.deckSlides({ ...deck, notes: ['', 'a '.repeat(150), 'x '.repeat(999), ''] }, 4)[2].plan, 45); // cambiar notas no pisa el manual
assert.equal(L.deckSlides({ ...deck, skipped: [false, true, false, false] }, 4)[1].plan, 0); // omitida
assert.equal(L.deckSlides({ notes: ['x'], slideTargets: [30] }, 1)[0].plan, 30); // formato antiguo
assert.equal(L.requiredPpm(300, 45), 400);
assert.equal(L.deckPpm(sl), Math.round(450 / ((62 + 45) / 60))); // sin notas no cuenta para el ritmo
assert.equal(L.ppmHint(190), 'Muy rápido para este plan');
assert.equal(L.ppmHint(100), 'Te sobra tiempo');
assert.equal(L.ppmHint(150), null);

// 7.6 · cronómetro: total = suma por diapositiva; reiniciar 0:50 resta 0:50 y deshacer lo recupera
let c = L.resumeClock(L.newClock(10, 8), 0);
c = L.goTo(c, 9, 350_000);           // 5:50 en la diapositiva 9
const before = c, at = 400_000;      // 0:50 en la 10ª (índice 9) → total 6:40
assert.equal(L.totalMs(c, at), 400_000);
c = L.resetSlide(c, at);
assert.equal(L.totalMs(c, at), 350_000);
assert.equal(L.slideMs(c, at), 0);
assert.equal(c.resets[9], 1);
const undone = L.undoReset(before, c, at);
assert.equal(L.totalMs(undone, at + 2_000), 402_000); // recupera 0:50 y conserva lo corrido después
assert.equal(undone.resets[9], 0);
const paused = L.pauseClock(L.resumeClock(L.newClock(2), 0), 5_000);
assert.equal(L.totalMs(paused, 99_000), 5_000); // en pausa no corre

// Analizador · determinista, percentiles ordenados
const sim = L.simulate({ seconds: [60, 120, 90], maxSec: 270 });
assert.deepEqual(sim, L.simulate({ seconds: [60, 120, 90], maxSec: 270 }));
assert.ok(sim.p10 < sim.p50 && sim.p50 < sim.p90);
assert.ok(Math.abs(sim.p50 - 270) < 15);
assert.ok(sim.over > 300 && sim.over < 700);
assert.equal(L.verdict(0.5), 'short');
assert.equal(L.verdict(1), 'tight');
assert.equal(L.verdict(1.2), 'over');
assert.equal(L.histogram(sim.totals, 270).reduce((a, b) => a + b.count, 0), 1000);
const cs = L.cutSuggestions([{ type: 'titulo', plan: 99 }, { type: 'contenido', plan: 30 }, { type: 'contenido', plan: 60 }, { type: 'cierre', plan: 99 }], 50);
assert.deepEqual(cs.map((s) => s.plan), [60]); // sin portada ni cierre, las más largas primero
const sp = L.spareAllocation([{ plan: 30 }, { plan: 90 }], 100);
assert.deepEqual([sp.margin, sp.extra], [10, [23, 68]]);

// Organizador · charla de 15 min con presentación de 18 → +3 min y la sesión acaba más tarde
const ses = { day: '2027-06-01', room: 'A', start: 9 * 60, talks: [{ id: 't1', minutes: 15, predicted: 18 * 60, speakers: ['p1'] }, { id: 't2', minutes: 15, speakers: ['p2'] }] };
assert.deepEqual(L.timeline(ses).map((t) => [t.start, t.end]), [[540, 555], [555, 570]]);
assert.equal(L.forecast(ses), 573);
const other = { day: '2027-06-01', room: 'A', start: 9 * 60 + 10, talks: [{ id: 't3', minutes: 10, speakers: ['p1'] }] };
assert.deepEqual(L.conflicts([ses, other]).map((c) => c.type).sort(), ['ponente', 'sala', 'sala', 'se-pasa']); // t3 pisa t1 y t2 en la sala A
assert.equal(L.hhmm(573), '09:33');

// CSV · evita fórmulas
assert.equal(L.toCsv([['=SUM(A1)', 'a,b', '@x', 'ok']]), `'=SUM(A1),"a,b",'@x,ok`);

// Estadísticas y marcas
assert.deepEqual(L.markedTimes(['(1,5 min) hola', '(10 seg) x', 'nada']), [90, 10, 0]);
assert.equal(L.markedTimes(['sin marcas']), null);
const st = L.rehearsalStats([
  { sessions: [{ at: '2026-11-26T10:00:00Z', totalMs: 600_000, targetMs: 600_000 }, { at: '2026-11-25T10:00:00Z', totalMs: 660_000, targetMs: 600_000 }] },
  { sessions: [{ at: '2026-11-23T10:00:00Z', totalMs: 300_000, targetMs: 600_000 }] },
], new Date('2026-11-26T20:00:00Z'));
assert.deepEqual([st.decks, st.sessions, st.best, st.streak], [2, 3, 0, 2]);
assert.deepEqual(L.perSlide([{ index: 0, ms: 5 }, { index: 1, ms: 3 }, { index: 0, ms: 2 }], 2), [7, 3]);
assert.equal(L.phase(-1, 100), 'over');
assert.equal(L.phase(5, 100), 'danger');

// PPTX
const n = await pptxNotes(await fs.readFile(new URL('./tfm-demo.pptx', import.meta.url)));
assert.equal(n.length, 6);
assert.match(n[0], /^Buenos días, tribunal/);
const tfmPath = new URL('./PraxiaJob_Defensa_TFM.pptx', import.meta.url);
if (await fs.stat(tfmPath).catch(() => null)) {
  const tfm = await pptxNotes(await fs.readFile(tfmPath));
  assert.equal(tfm.length, 33);
  assert.deepEqual(L.markedTimes(tfm).slice(0, 3), [20, 5, 35]);
  console.log('✓ deck TFM: 33 diapositivas, notas y marcas de tiempo');
}
console.log('✓ smoke OK');
