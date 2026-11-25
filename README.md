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

## Cuentas (Supabase)

Sin configurar, la app funciona en **modo invitado** (todo en el navegador). Para activar cuentas:

1. Crea un proyecto en Supabase y ejecuta `supabase/schema.sql` en el SQL Editor (tabla `decks` con RLS y bucket privado `slides`).
2. En *Authentication → URL Configuration*: **Site URL** `https://temposlide.vercel.app` y en **Redirect URLs** añade `https://temposlide.vercel.app/app` y `http://localhost:3000/app`.
3. (Opcional) *Authentication → Providers → Google* para el botón «Continuar con Google». El enlace mágico por correo funciona sin más.
4. Variables de entorno del servidor (Vercel → Settings → Environment Variables, o local): `SUPABASE_URL` y `SUPABASE_ANON_KEY` (la clave *anon/publishable*, nunca la `service_role`).

El cliente las lee en tiempo de ejecución desde `/api/config`, así no hace falta recompilar. Al iniciar sesión, las presentaciones creadas como invitado se suben automáticamente a la cuenta.

## Arquitectura

- `server.js` — Express sin estado: `POST /api/convert` (PPTX/PPT/KEY/ODP → PDF con LibreOffice) y el frontend compilado.
- `src/store.js` — biblioteca: Supabase (tabla `decks` + Storage) con sesión; IndexedDB en modo invitado. Los PDFs se cachean en IndexedDB.
- `src/supabase.js` — cliente y hook de sesión; `src/Login.jsx` — enlace mágico y Google.
- `src/Demo.jsx` — mini ensayo interactivo de la landing.
- `src/pptx.js` — notas del orador del PPTX (JSZip, en el navegador).
- `src/lib.js` — lógica de tiempos: estimación, reparto, ritmo, marcas `(30 s)` en las notas, recortes (probada en `test/smoke.js`).
- `src/` — React + Vite; diapositivas renderizadas con pdf.js. `fonts/` — Poppins para conversiones fieles.

Si las notas empiezan con una marca de tiempo — `(30 s)`, `(1 min)` — se usan como plan por diapositiva; las diapositivas sin marca se tratan como anexo (0 s, fuera del plan).

Limitaciones conocidas (prototipo): pagos simulados; en modo invitado los datos no salen del navegador; la pantalla de público funciona en el mismo navegador (BroadcastChannel).
