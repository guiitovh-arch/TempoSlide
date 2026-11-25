# SlideTempo — Análisis completo (25 nov 2026)

Revisado con la cuenta FREE del usuario en `app.slidetempo.com` + web pública `slidetempo.com`.
Producto en **BETA**. Lema: *"¿Se cumplirá el horario?"* / *"Will it run to time?"*

---

## 1. Propuesta de valor

Dos públicos:
- **Ponente** → "¿Cuánto dura de verdad mi presentación y qué recorto?" → Analizador.
- **Organizador** → "¿Se sostendrá la jornada y dónde se desvía el programa?" → Organizador / Ponentes / Pósteres / Eventos.

Mensaje central: convierte una presentación en los minutos que de verdad necesita (1.000 ensayos simulados, Monte Carlo) y un programa en un horario realista.

Cifras de la landing: 4 herramientas · 1.000 simulaciones por análisis · <2 s de análisis · 4 idiomas.

---

## 2. Mapa de rutas

| Ruta | Página | Acceso |
|---|---|---|
| `slidetempo.com/` | Landing (Cómo funciona, Características, Precios, FAQ) | Público |
| `slidetempo.com/for-organizers` | Landing para organizadores | Público |
| `/home` | Inicio (dashboard) | Login |
| `/app` | Analizador | Login (la landing dice "sin registro") |
| `/decks` | Biblioteca de presentaciones (carpetas y etiquetas) | Login |
| `/decks/{id}` | Presentación: visor, notas editables, omitir diapositivas, análisis por diapositiva | Login |
| `/decks/{id}/prompter` | Teleprónter | Login |
| `/app?upload={id}` | Resultado del análisis | Login |
| `/events` | Eventos | Login |
| `/organizer` | Organizador de programa | Gratis, guarda en localStorage |
| `/organizer/preview` | Vista previa imprimible del programa | Gratis |
| `/speakers` | CRM de ponentes | Gratis |
| `/posters` | Diseñador de sala de pósteres | **Pro** (paywall) |
| `/account` | Mi cuenta | Login |
| `/subscribe?plan=pro` | Checkout Pro (Plan → Cuenta → Pago) | Login |
| `/trial` | Prueba Pro 3 meses | Login |
| `/t/{código}` | Temporizador compartible (ej. `/t/K7Q2`) | Público, sin cuenta |
| `/p/…` | Programa público para asistentes | Público (Pro para publicarlo) |
| `/privacy`, `/terms`, configuración de cookies | Legales | Público |

**Navegación superior (app):** Logo + badge BETA · Inicio · Analizador · Presentaciones · [grupo organizador: Eventos · Organizador · Ponentes · Pósteres] · selector de idioma · menú de usuario (nombre + badge plan).

**Menú de usuario:** nombre, email, badge FREE · Mi cuenta · Inicio · Prueba Pro gratis… · Cerrar sesión.

**Idiomas:** English, Deutsch, Español, Ελληνικά (i18next; clave `i18nextLng`). Ojo: hay cadenas sin traducir en `/account` ("Security", "Danger Zone", "Set a password", "Limited preview…").

**Footer:** © 2026 SlideTempo · Inicio · Mi cuenta · Privacidad · Términos · Configuración de cookies.

---

## 3. Herramientas

### 3.1 Inicio (`/home`)
- Saludo "Hola de nuevo, {nombre}".
- Dropzone: "Suelta presentaciones aquí" — .pptx o .pdf, hasta 50 MB. Se guarda la presentación + vistas previas; el usuario decide si analiza ahora o más tarde (subida y análisis desacoplados).
- Tarjeta "Planificar un programa" → Abrir organizador.
- "Presentaciones recientes" con vistas previas (estado vacío con texto guía).

### 3.2 Analizador (`/app`)
Formulario de configuración:
1. **Subir archivo** .pptx/.pdf (≤50 MB).
2. **¿Dónde presentas?** (5 contextos, cada uno con una línea que explica el ajuste):
   - Conferencia — "Formal, sin interrupciones"
   - Reunión de equipo — "Interactiva, esperar preguntas"
   - Pitch de inversores — "Alto riesgo, algo de Q&A"
   - Clase / Conferencia — "Educativa, preguntas ocasionales"
   - Otro — "Sin ajustes por contexto" (por defecto)
3. **Tiempo límite y tu estimación** (opcional, acordeón):
   - "Mi tiempo es __ min" (vacío = sin límite fijo)
   - "Creo que dura __ min" (para comparar tu estimación con la real)
4. Botón "Elige un archivo para empezar" (deshabilitado hasta subir).

#### Pantalla de resultados (probada con `deck-prueba.pptx`: 10 diapositivas, notas en 3, 1 gráfico de columnas, 1 tabla; contexto Reunión, 8 min de límite, estimación 10 min)
Tarda ~2 s. La URL pasa a `/app?upload={id}`. Layout: panel izquierdo de configuración (editable, botón "Ejecutar de nuevo", "Limpiar") + lista "Tus presentaciones" con % y papelera; a la derecha el resultado.

**Barra superior:** nombre · "10 slides · 8 min slot · meeting" · **Guardar versión** · **Añadir al organizador** (añade la charla al programa con su duración) · **Temporizador compañero** · **Teleprónter** · **Nuevo análisis**.

**Tarjeta veredicto:**
- Badge "Demasiado corta" → "Tu charla dura unos 2.9 min · 2.4 – 3.5 min según el ritmo"
- "Solo ocupa el 37% de tus 8 min — 5.1 min sin usar" + consejo ("Añade contenido, reserva tiempo para preguntas o pide un espacio más corto")
- Bloque estimación: "Estimaste 10 min. Dura 2.9 min. Planificas 7.1 min de más: el 71% del tiempo reservado."
- "0 de 1000 simulaciones superaron tus 8 min"
- Anillo con 2.9 min / 37% de tus 8 min
- Sugerencia: "Podrías hacerlo en 5 minutos — un tiempo de 5 min basta aproximadamente la mitad de las veces" + botón **Usar 5 min y recalcular**

**Métricas clave:** Duración mediana · Intervalo de confianza 90% (P5–P95: 2.3–3.6) · Mejor caso orador rápido (P10: 2.4) · Peor caso orador lento (P90: 3.5).

**Distribución de timing:** histograma de las 1.000 simulaciones (azul dentro del tiempo, rojo excedido) con más rápido / mediana / más lento.

**Desglose por diapositiva:** barra horizontal por diapositiva coloreada por tipo (Título · Sección · Contenido · Datos/Gráficos · Medios · Cierre), segundos ± desviación (ej. 18s ±6s).

**Asignación de tiempo extra** (cuando sobra; si te pasas sale la versión de recortes): "Presupuesto de tiempo" en barra Base / Extra / Seguridad (Base 2.9 + 4.6 distribuidos + 0.5 margen de seguridad). Por diapositiva: miniatura, tipo, tiempo actual → sugerido, +delta, % del extra y un consejo ("Open the floor for questions…", "Engage the audience with a question or anecdote", "Briefly recap the previous section…" — consejos sin traducir, en inglés).

**Lo que se ve del modelo (debilidades útiles para ti):**
- Clasificó como "section" diapositivas de contenido, el gráfico y la tabla: no detectó Datos/Gráficos en mi PPTX hecho con python-pptx.
- Las diapositivas con ~55 palabras de notas salieron en 20 s (≈165 ppm ya serían 20 s, así que sí parece contar notas, pero sin margen extra).
- Todas las diapositivas quedan en 15–20 s: la varianza entre diapositivas es baja.
- El "extra" se reparte con reglas fijas: 33% al cierre (Q&A), 13% al título y el resto igual.

#### Página de presentación (`/decks/{id}`)
- Cabecera: nombre · "10 diapositivas · 8 min · mediana 2.9 min" · % · Abrir análisis · Teleprónter · **Ejecutar análisis** · Más acciones (Compartir · Carpeta y etiquetas · Subir una versión nueva · Descargar original · Quitar del historial · Eliminar presentación).
- 3 paneles: miniaturas de diapositivas (plegable) · visor con ←/→ · panel derecho con pestañas:
  - **Notas del orador:** "Omitir esta diapositiva", editor de notas con recuento de palabras, origen "Del archivo"; "Las notas determinan la estimación: una diapositiva con guion se cronometra por el guion, no por sus viñetas."
  - **Análisis:** tipo de diapositiva, tiempo estimado ± desviación, palabras en la diapositiva, asignación sugerida y consejo.
- **Ejecutar análisis** abre un diálogo (Tiempo en min + Contexto); con el gratis semanal ya usado muestra: "Ya ha usado el análisis gratuito de esta semana…" → **Desbloquear esta presentación — $3.99**.
- **Subir una versión nueva:** conserva lo pagado ("una versión nueva no vuelve a cobrarse"), pero borra notas editadas y diapositivas omitidas y reinicia el análisis.
- **Carpeta y etiquetas:** diálogo con Carpeta (ej. "ICIS 2026") y etiquetas separadas por comas.
- Tarjeta en la biblioteca: miniatura, badge "~2.9 min", nº diapositivas, % , "1 análisis · 0 versiones guardadas", Ver 10 diapositivas.

#### Teleprónter (`/decks/{id}/prompter`)
Pantalla oscura a pantalla completa: "Diapositiva X de N" + título · cuenta atrás de la diapositiva (asignado) · total transcurrido/presupuesto (0:00 / 7:29) · estado "EN HORA" / "1:28 POR DELANTE" · interruptor **Avance automático** · Salir. Texto grande con las notas (o "Sin notas en esta diapositiva.") + consejo en cursiva · a la derecha la diapositiva actual y la siguiente · barra de progreso segmentada por diapositiva · controles ← Iniciar → · Editar notas · Reiniciar · Tamaño del texto A−/A+ · atajos: Espacio reproducir/pausar, ←/→, F pantalla completa · "Ritmo según su asignación de tiempo".

#### Temporizador compañero (`/t/{código}`)
Popover: "Ábrelo en tu teléfono mientras presentas…" · código de 6 caracteres (ej. 3WDMSA) que **expira en 48 h** · URL + Copiar + Abrir · compartir por **WhatsApp** y **Viber**. Página móvil oscura: nombre del archivo · "8:00 restante" · Diapositiva 1 de 10 + título + tipo · cuenta atrás grande "0:54 de 0:54 presupuesto" · barra · ◀ ▶(play) ▶ · Reiniciar temporizador · puntos de paginación. Funciona sin login.

Qué promete además la landing:
- **Duración probable + rango** (ej. "Durará unos 16:12 · 12:24–19:06 según el ritmo"), mediana y **P90**.
- **4 veredictos:** Demasiado corta · Cómoda · Justa · Probable exceso.
- **Tiempo por diapositiva**; las diapositivas con gráficos/datos/tablas reciben más tiempo, los separadores de sección ~5 s.
- **Usa las notas del ponente** si existen (PPTX) en vez del texto en pantalla.
- **Recortar o rellenar:** recortes ordenados por tiempo ganado vs. peso narrativo ("Recorta 45 s de las diapositivas 7–9"); si sobra tiempo, dónde poner los minutos.
- **Tu estimación medida:** diferencia entre lo que crees y lo simulado.
- Modelo: distribución de probabilidad con variación del ritmo, complejidad de diapositiva, pausas e interacción con el público según contexto.
- PPTX es más preciso (notas, gráficos, tablas, layouts); el PDF tiene menos metadatos.
- Iterar: editar notas, omitir diapositivas y volver a analizar (de pago).

### 3.3 Presentaciones (`/decks`)
"Todas las presentaciones de tu biblioteca, organizadas por carpetas y etiquetas." Enlace "← Volver a tus presentaciones".

### 3.4 Eventos (`/events`)
Contenedor que agrupa programa + sala de pósteres + identidad visual.
Formulario "Nuevo evento":
- Nombre
- Tipo: **Congreso** (uno o varios días seguidos) | **Serie periódica** (seminarios, grupos de lectura, coloquios)
  - Serie: Se repite (cada semana / cada dos semanas / cada mes) · Primera reunión (fecha) · Empieza a las (hora) · Fin por "N reuniones" o "Hasta fecha" → vista previa de las fechas generadas ("12 reuniones: mié 25 nov, mié 2 dic …").
- ☐ Este evento tiene sesión de pósteres (añade sala de pósteres: paneles, pósteres, etiquetas)
- Descripción
- Identidad: color del texto · color de acento · logotipo (se aplica a todo lo que se imprime o publica)
- Crear evento / Cancelar

### 3.5 Organizador de programa (`/organizer`) — el núcleo para organizadores
**Arranque** (3 opciones): Importar el que ya existe · Usar un congreso de ejemplo · Empezar el mío.
"Su programa se guarda en este navegador" (localStorage), aunque la landing dice que vive en la cuenta.

**Barra superior:** Vista previa · Ponentes (n) · Asistente **PRO** · Guardar punto de control (checkpoints con nombre, ej. "v4 after chairs' feedback") · Compartir/exportar · Más (Importar programa, Vaciar el programa).

**Cabecera:** nombre del programa · selector de Evento · Salas (definir salas/sedes una vez y elegir en cada sesión) · Días (chips por fecha) + "Añadir un día".

**Banner de previsión:** "Este día termina hacia las 15:02, previsto 15:05 · entre 14:57 y 15:04 · 9 de 11 medidos con una presentación real".

**Barra lateral del día:** fecha, nº sesiones y horario · "Día completo" · lista de sesiones con hora, nº elementos, nº salas y badge de desvío (+15m rojo / "a tiempo" verde) · botones + Sesión · Pausa.

**Vista Día completo:** Gantt por sesión con eje horario; cada sesión muestra sus charlas (asignado vs exceso en rojo), tracks paralelos, huecos ("Hueco de 2h 15m"), avisos ("2 sesiones se pasan de su tiempo", "Fin previsto 15:03, a tiempo"). Arrastrar una sesión sobre otra para hacerlas paralelas. Debajo, "Orden del día" en lista con desvío y duración por charla.

**Vista Sesión:** hora de inicio · Editar (nombre, hora, moderadores, sala, descripción, nombre del track, añadir sesión paralela, eliminar) · + Charla · Pausa · vistas **Lista / Dividido / Línea temporal** · "En paralelo": pestañas por track con nº de charlas · mini-Gantt comparando tracks · "Uno después del otro" (convierte paralelo en secuencial) · resumen (n charlas, asignado, previsto, desvío).
- Editor de charla inline: título · ponentes (chips, multi) · inicio–fin · Tiempo (min) asignado · **Vincular una presentación** (buscador de tus análisis; la mediana rellena la duración prevista) · Duración estimada · desvío (+1m/0m) · botones notas, añadir debajo, subir, bajar, eliminar.
- Panel Gantt por track con leyenda: Tiempo asignado · Duración estimada · Exceso · Pausa; drag & drop "Arrastre una ponencia aquí"; "Fin de sesión 11:15 · previsto 11:25 (+10m)".

**Compartir / exportar:**
- Exportar a Excel (hoja de tabla + hoja de gráfico por vía, editable)
- Exportar a Word: Hoja de planificación (horarios, tiempos previstos y desvío)
- Exportar a Word: Programa para asistentes (horas, títulos, ponentes)
- Exportar a Word: Cartel para la puerta (letra grande)
- Calendario (.ics) — PRO (una entrada por charla)
- Enlace para asistentes — PRO (página móvil + cartel QR)
- Copiar como texto
- Nota: "Las vistas previas son gratis. Las descargas, el enlace para asistentes y el archivo de calendario necesitan Pro."

**Asistente de programa (PRO):** IA para el programa; 100 solicitudes/mes, se reinician el día 1. "El planificador es gratuito. El asistente es la única parte que cuesta cada vez que se ejecuta."

**Importar programa:** pestañas Archivo (.xlsx, .csv, Word o página guardada, máx. 8 MB) · Pegar · Dirección web; nombre del congreso opcional; "No se guarda nada hasta que usted lo guarde".

**Vista previa** (`/organizer/preview`): programa limpio por día/sesión/track con horas, títulos, ponentes y duraciones; pie "Hecho con SlideTempo" + fecha.

### 3.6 Ponentes (`/speakers`) — mini-CRM
- Acciones: Resumen · Copiar correos · Exportar la lista · Añadir ponente · "Completar N datos de contacto".
- Contadores: n ponentes · n charlas · n requieren atención.
- Filtros: Todos · Sin correo · Se pasa · Sin confirmar · Sin institución · Sin país · buscador por nombre/afiliación.
- Lista: iniciales, nombre, fecha/hora, nº charlas, minutos, badge de desvío o "Sin presentación".
- Panel "El registro de un vistazo": QUÉ LO IMPIDE (sin correo, previsión de pasarse, no confirmados, sin institución, sin país) · KPIs (ponentes, ponencias + total horas, sesiones presididas, países) · Confirmaciones (Sin confirmar / Confirmado / Ha llegado) · De dónde vienen · Instituciones · Más tiempo en el programa · Ponencias por ponente.
- Ficha: estado (Sin confirmar / Confirmado / Ha llegado) · Editar · alertas (previsión +13m, sin correo, sin presentación analizada) · correo · afiliación · país · "Marcar como contactado" · teléfono o nota · "En el programa" con sus charlas (asignado vs previsto) · Copiar sus horarios · Ver la ponencia.

### 3.7 Pósteres (`/posters`) — Pro
Bloqueado en FREE. Según la landing: definir espacios con medidas reales (A0, A1, vertical/horizontal), asignaciones de un vistazo con huecos libres, plano de la sala dibujable, paneles, etiquetas, planos imprimibles, exportación a Word/Excel ("Sala de pósteres · 28 paneles · 10/28 asignados").

### 3.8 Temporizador (`/t/{código}`)
Cada análisis y cada programa genera una cuenta atrás compartible por enlace, WhatsApp o Viber; sin instalar ni cuenta; progreso en vivo frente a la duración analizada; programa de la sesión a mano para moderadores (ej. "SESSION A — TALK 3 · 12:40 of 20:00 remaining").

### 3.9 Mi cuenta (`/account`)
Perfil (nombre editable, email, "Signed in with Google") · Seguridad: añadir contraseña para entrar sin Google · Suscripción: plan, **Créditos de presentación**, **Análisis guardados**, botones Prueba Pro 3 meses / Comprar una presentación / Hazte Pro · listado de análisis guardados · Danger Zone: borrar cuenta.

---

## 4. Precios y pagos

Monedas: GBP / EUR / USD (selector, se guarda en `slidetempo_currency`).

| Plan | Precio | Incluye |
|---|---|---|
| **Gratis** | €0 | 1 análisis completo por semana (desglose entero, no muestra) · tiempos por diapositiva, recortes y margen · presentaciones guardadas en biblioteca · ✗ re-analizar tras editar · ✗ segundo análisis en la misma semana |
| **Una presentación** ("Más popular") | €3,99 / presentación (pago único) | Todo lo de Gratis para esa presentación · análisis ilimitados sin límite semanal · editar notas, omitir diapositivas y re-analizar · ensayar hasta que encaje · suya para siempre |
| **Pro** | €9,99/mes · $9,99/mes · £8,99/mes — Anual €99,90 · $99,90 · £89,90 ("12 meses al precio de 10") | Todo lo de Una presentación, para todas · presentaciones y análisis ilimitados · planificador de programas de congreso · enlace para asistentes + cartel QR imprimible · diseñador de pósteres · exportación a Word y Excel · .ics · Asistente IA (100/mes) |
| **Prueba Pro** | Gratis 3 meses | Sin tarjeta; termina sola y vuelve a Free conservando presentaciones y programas |

Modelo: la palanca de pago es **re-analizar la misma presentación** (créditos por presentación) y, para organizadores, **exportar/publicar** (planificar es gratis, exportar no).

**Checkout** (`/subscribe?plan=pro`): pasos Plan → Cuenta → Pago · toggle Mensual/Anual · moneda · datos de facturación: nombre en la factura, ☐ "Es para una organización" → campo Organización (el NIF/IVA se pide en la pantalla siguiente, validado por Stripe por país) · "Continuar al pago" · Stripe gestiona tarjeta y dirección · cancelar cuando quieras desde la cuenta (sigue hasta el final del periodo pagado).

---

## 5. FAQ (resumen)
- **Precisión:** distribución de probabilidad, 1.000 simulaciones (ritmo, complejidad, pausas, interacción) → intervalo de confianza.
- **Formatos:** .pptx (mejor: notas, gráficos, tablas, layouts) y .pdf.
- **Almacenamiento:** análisis gratuitos en memoria y se borran; usuarios registrados pueden guardar.
- **vs. contador de palabras:** no asume tiempo igual por diapositiva; modela datos, separadores, contexto y ritmo.
- **¿Gratis?** Sí, 1 análisis completo/semana; se paga por re-analizar o por Pro.

---

## 6. Detalles técnicos observados
- SPA **React + Vite** (bundle `/assets/index-*.js`), i18next, Google Analytics (gtag), Stripe, login con Google (+ contraseña opcional).
- localStorage: `slidetempo_programme`, `slidetempo_programme_created`, `slidetempo_organizer_view`, `slidetempo_assistant_docked`, `slidetempo_currency`, `i18nextLng`.
- **Modelo de datos del programa** (de `slidetempo_programme`):

```ts
Programme {
  title: string
  speakers: { id, name, affiliation, country, email, phone, notes, status }[]
  rooms: Room[]
  days: {
    id, date,
    sessions: {
      id, name, startTime, description,
      chairs: string, chairIds: string[],
      room: string, roomId: string | null,
      joinUrl: string,
      tracks: {
        id, name, description, sponsorId: string | null,
        items: {
          id, type: 'talk' | 'break', title, description,
          speaker: string, speakerId: string, speakerIds: string[],
          allocatedMin: number, estimatedMin: number,
          analysisId: string | null   // enlace a una presentación analizada
        }[]
      }[]
    }[]
  }[]
}
```
- Las horas de cada charla no se guardan: se derivan de `session.startTime` + suma de `allocatedMin` por track. El desvío = `estimatedMin − allocatedMin`, acumulado.
- Campos que apuntan a funciones futuras: `joinUrl` (sesiones online), `sponsorId` (patrocinador por track).

## 7. Huecos / oportunidades para tu plataforma
- Incoherencias: la landing dice "sin registro" pero `/app` exige login; dice "programas viven en tu cuenta" pero el organizador guarda en el navegador.
- Traducción incompleta en Mi cuenta.
- No hay colaboración multiusuario visible (comités, chairs editando a la vez).
- No hay call for papers / envío de abstracts / revisión.
- No hay ensayo con voz (medir tu ritmo real con micro) — solo simulación.
- No hay integración directa con Google Slides / Keynote.
- Pósteres y exportaciones solo en Pro: hueco para un plan intermedio "Organizador".
