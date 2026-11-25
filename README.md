# TempoSlide ⏱️

Plataforma para ensayar y presentar a tiempo: sube tu presentación y usa **temporizador**, **cronómetro por diapositiva** y **teleprompter** desde el navegador.

## Arrancar

Requisitos: Node 20+ y LibreOffice (`soffice` en el PATH, para convertir PPTX/PPT/KEY/ODP a PDF).

```bash
npm install
npm run build
npm start          # http://localhost:3000
```

Desarrollo con recarga: `npm run dev` (Vite en :5173 con proxy a la API en :3000).
Tests: `npm test`. Deck de prueba: `test/tfm-demo.pptx` (regenerar con `python3 test/make_test_pptx.py`).

## Qué incluye

| Ruta | Pantalla |
|---|---|
| `/` | Landing (funciones, calculadora, precios, FAQ) |
| `/app` | Dashboard: subida por arrastre, biblioteca, estadísticas |
| `/app/deck/:id` | Pre-análisis de duración, guion editable por diapositiva, presupuesto de tiempo, historial e informe de ensayos |
| `/present/:id` | Modo presentador: cuenta atrás (arranca con «Iniciar»), cronómetro por diapositiva, ritmo adelantado/tarde, teleprompter (auto-ritmo, espejo, tamaño), pantalla en negro |
| `/audience/:id` | Pantalla de público (proyector), sincronizada con el presentador |

Atajos en el presentador: `→`/`Espacio`/`PgDn` avanzar · `←`/`PgUp` retroceder · `Enter`/`S` iniciar · `P` pausa · `T` teleprompter · `B` negro · `F` pantalla completa. Los mandos de presentación (clickers) funcionan porque envían PgUp/PgDn.

## Arquitectura

- `server.js` — Express: subida (multer), conversión con LibreOffice, extracción de notas del orador del PPTX (JSZip), ensayos. Datos en `data/<id>/` (PDF + `meta.json`).
- `src/` — React + Vite. Las diapositivas se renderizan con pdf.js. `src/lib.js` contiene la lógica de tiempos (probada en `test/smoke.js`).

Limitaciones conocidas (prototipo): sin cuentas de usuario ni pagos reales; la pantalla de público funciona en el mismo navegador (BroadcastChannel).
