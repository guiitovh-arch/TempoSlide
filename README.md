# TempoSlide ⏱️

Plataforma para ensayar y presentar a tiempo: sube tu presentación y usa **temporizador**, **cronómetro por diapositiva** y **teleprompter** desde el navegador.

## Arrancar

Requisitos: Node 20+ y LibreOffice (`soffice` en el PATH, para convertir PPTX/PPT/KEY/ODP a PDF). O con Docker: `docker build -t temposlide . && docker run -p 8080:80 temposlide`.

```bash
npm install
npm run build
npm start          # http://localhost:3000
```

Desarrollo con recarga: `npm run dev` (Vite en :5173 con proxy a la API en :3000).
Tests: `npm test`. Deck de prueba: `test/tfm-demo.pptx` (regenerar con `python3 test/make_test_pptx.py`).

## Despliegue (Vercel)

El `Dockerfile` se despliega con el runtime Container de Vercel (preset de framework **Container**): una sola imagen sirve el frontend y `/api/convert`. Límite de Vercel: 4,5 MB por petición, así que los decks más pesados se suben como **PDF + PPTX** (el PDF se renderiza en el navegador y del PPTX solo se leen las notas, sin pasar por el servidor).

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

- `server.js` — Express sin estado: `POST /api/convert` (PPTX/PPT/KEY/ODP → PDF con LibreOffice) y el frontend compilado.
- `src/store.js` — biblioteca en IndexedDB: presentaciones (PDF + notas + plan) y ensayos viven en el navegador del usuario.
- `src/pptx.js` — notas del orador del PPTX (JSZip, en el navegador).
- `src/lib.js` — lógica de tiempos: estimación, reparto, ritmo, marcas `(30 s)` en las notas, recortes (probada en `test/smoke.js`).
- `src/` — React + Vite; diapositivas renderizadas con pdf.js. `fonts/` — Poppins para conversiones fieles.

Si las notas empiezan con una marca de tiempo — `(30 s)`, `(1 min)` — se usan como plan por diapositiva; las diapositivas sin marca se tratan como anexo (0 s, fuera del plan).

Limitaciones conocidas (prototipo): sin cuentas ni pagos reales; los datos no se sincronizan entre dispositivos; la pantalla de público funciona en el mismo navegador (BroadcastChannel).
