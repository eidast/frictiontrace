# Design — crux-dashboard

## Context

FrictionTrace ya tiene `data/crux.db` con 40 semanas de Core Web Vitals para 19 sitios de e-commerce, organizados en 3 grupos y 4 page types por sitio. El módulo `engine/src/crux/` expone `openCruxDb()`, DAOs, y query helpers. El proyecto ya genera reportes HTML autocontenidos con templates y assets locales.

El dashboard requiere ser una herramienta de exploración interactiva, funcionar sin dependencias externas de red (D3 local, no CDN), y ser portable tanto en local como en contenedor.

## Goals / Non-Goals

**Goals:**
- Servidor HTTP local (`--serve`) con API REST + archivos estáticos servidos desde `engine/src/crux/`
- Modo `--build` que genera HTML autocontenido con todos los datos disponibles embebidos
- D3.js v7 descargado localmente (`engine/src/crux/d3.v7.min.js`), sin dependencia de CDN
- Dashboard con 5 vistas: Resumen Ejecutivo, Comparativa por Grupo, Comparativa por Sitio, Tendencia Histórica, Datos
- Filtros globales: grupo, sitio(s) multiselect, page type, métrica, form factor, rango fechas, query_level (url/origin/mixed)
- Gráficos D3 con tooltips hover: barras, líneas, scatter
- Presets: "Walmart vs Otros", "Top 5 peores checkouts", "Tendencia 6 meses"
- Exportación CSV/JSON como botón global (siempre visible)
- Estados vacíos con mensajes descriptivos (sin datos, sin matches, DB faltante)
- Funciona en local y en contenedor sin configuración adicional

**Non-Goals:**
- Autenticación, multi-usuario, persistencia de filtros
- Responsive design mobile
- Animaciones complejas
- Hosted/deployable públicamente
- Integración con el analyzer de FrictionTrace

## Decisions

### D1. D3.js v7 como archivo local

**Choice:** `engine/src/crux/d3.v7.min.js` se commitea al repo. El script `crux-dashboard.ts` verifica su existencia al iniciar; si no existe, lo descarga de `https://d3js.org/d3.v7.min.js` una sola vez.

**Why:** Elimina la dependencia de CDN (riesgo de indisponibilidad, latencia, entornos sin internet). El archivo pesa ~150KB y se versiona. En modo serve se sirve como static asset. En modo build se inyecta inline en el HTML. Funciona en contenedores sin acceso a internet después del primer `npm install`/clone.

### D2. Archivos separados: HTML, CSS, JS

**Choice:** El dashboard se compone de 4 archivos en `engine/src/crux/`:

```
engine/src/crux/
  dashboard.html     ← estructura HTML, tabs, sidebar
  dashboard.css      ← tema oscuro, layout, tooltips
  dashboard.js       ← lógica: filtros, fetch, D3 charts, presets, export
  d3.v7.min.js       ← D3 library (descargado/commiteado)
```

**Alternatives considered:**
- **Template string en TS:** difícil de mantener sin syntax highlighting/linting. El JS del dashboard va a ser extenso (500+ líneas con D3).
- **Handlebars:** agrega complejidad innecesaria para contenido mayormente estático.

**Why:** Archivos separados permiten editar HTML/CSS/JS con las herramientas adecuadas. En `--serve`, el servidor los sirve como archivos estáticos. En `--build`, el script los lee y los combina en un solo HTML (CSS inline en `<style>`, JS inline en `<script>`).

### D3. Modos `--serve` y `--build`

**Choice:**

- `--serve`: levanta HTTP server en `:3000`. Sirve archivos estáticos desde `engine/src/crux/`. API en `/api/*`. `crux.db` se consulta en vivo.
- `--build`: lee todo `crux_history` (o el snapshot actual), embeble los datos como JSON en `<script>`, genera `reports/crux-dashboard.html` autocontenido.

**Why:** Serve para exploración interactiva con datos live. Build para compartir un snapshot portable (email, Slack). Build mode embeble **todos los datos disponibles** (no solo último snapshot); los filtros de fecha se aplican en memoria en el frontend.

### D4. Layout: tabs + sidebar + barra superior

```
┌──────────────────────────────────────────────────────────┐
│ CrUX Dashboard           [Presets ▾]  [CSV] [JSON]       │
├──────────┬───────────────────────────────────────────────┤
│ Filtros  │ [Resumen] [Grupos] [Sitios] [Tendencia] [Datos]│
│          ├───────────────────────────────────────────────┤
│ Grupo ▾  │                                               │
│ Sitio ▾  │                                               │
│ Page  ▾  │        Contenido de la vista activa            │
│ Métrica ▾│        (gráficos D3, tablas, scorecards)      │
│ FF     ▾ │                                               │
│ Nivel  ▾ │                                               │
│ Desde ▾  │                                               │
│ Hasta ▾  │                                               │
└──────────┴───────────────────────────────────────────────┘
```

**Why:** La barra superior tiene presets y export siempre visibles. El sidebar izquierdo contiene todos los filtros. Los tabs controlan la vista principal. El layout funciona bien en pantallas 1280px+.

### D5. API REST

| Endpoint | Query Params | Respuesta |
|---|---|---|
| `GET /api/sites` | — | `[{origin, label, group, country}]` |
| `GET /api/summary` | `group?, metric, ff?, dateFrom?, dateTo?, level?` | `{avg_good, avg_poor, worst5, best5, by_group[]}` |
| `GET /api/compare` | `group?, sites?, metric, ff?, page?, dateFrom?, dateTo?, level?` | `[{label, p75, good, ni, poor, group, ff, level}]` |
| `GET /api/timeseries` | `sites[], metric, ff?, dateFrom?, dateTo?, level?` | `[{collection_end, site, ff, p75, good, ni, poor, level}]` |
| `GET /api/export/csv` | mismos que compare | `text/csv` |
| `GET /api/export/json` | mismos que compare | `application/json` |

El parámetro `level` filtra por `query_level`: `url`, `origin`, o `mixed` (default, ambos).

### D6. Manejo de CLS como string

**Choice:** La API devuelve `p75_value` como string (tal cual viene de `crux_history`). El frontend aplica `parseFloat()` antes de pasar datos a D3. Para CLS, el eje Y se escala a [0, 1] en vez de milisegundos.

**Why:** El schema usa `TEXT` porque CLS es string decimal y el resto son enteros. La conversión ocurre en el frontend, que es quien sabe qué métrica está graficando y puede elegir la escala correcta.

### D7. Estados vacíos y de error

| Condición | Mensaje |
|---|---|
| Sitio sin datos en CrUX | "Este sitio no tiene datos disponibles en CrUX. Intentá capturar la información y volvé más tarde." |
| Filtros sin resultados | "No se encontraron resultados para los filtros seleccionados. Probá con otros criterios." |
| `crux.db` no existe | "Base de datos no encontrada. Ejecutá `npx tsx scripts/crux-sync.ts` para reconstruir la información o contactá al administrador." |
| API error (5xx) | "Error del servidor. Revisá la consola para más detalles." |

### D8. Filtro de query_level

**Choice:** Dropdown con 3 opciones: "Todos" (mixed), "URL" (solo datos a nivel página), "Origin" (solo datos a nivel dominio). Cada fila en la tabla de datos y cada punto en gráficos incluye una etiqueta visual (`[U]` o `[O]`) para identificar la procedencia.

**Why:** Los datos de checkout/PLP/PDP frecuentemente caen a nivel origin. El usuario necesita saber si está viendo datos específicos de la página o agregados del dominio. El filtro permite elegir.

### D9. Presets

Botón "Presets" en la barra superior con opciones predefinidas que configuran filtros automáticamente:

| Preset | Configura |
|---|---|
| "Walmart vs Otros" | group=Todos, metric=LCP, muestra comparativa por grupo |
| "Top 5 peores checkouts" | page=checkout, metric=LCP, ff=PHONE, ordena por p75 desc |
| "Tendencia 6 meses" | cambia a vista Tendencia, dateFrom=hace 6 meses, dateTo=hoy |
| "Mobile vs Desktop" | limpia filtro FF, muestra ambas en vista Comparativa |

### D10. Botón de exportación global

**Choice:** Los botones CSV y JSON están en la barra superior, siempre visibles. Exportan los datos correspondientes a los filtros actuales, independientemente de la vista activa. El nombre del archivo incluye timestamp: `crux-export-2026-06-29.csv`.

**Why:** Acceso rápido sin cambiar de vista. Mejor práctica: el botón de export siempre disponible, no escondido en un tab específico.

### D11. Resumen Ejecutivo adaptativo

**Choice:** Los scorecards del Resumen Ejecutivo muestran la métrica seleccionada en el filtro global (o todas si no hay filtro). Si el filtro es LCP, muestra 3 cards: good%, needs-improvement%, poor% promedio para el grupo seleccionado. Si no hay filtro de métrica, muestra una card por cada métrica (5 cards). El semáforo por grupo siempre muestra todas las métricas.

### D12. Tema oscuro minimalista

**Choice:** Fondo `#0d1117`, texto `#c9d1d9`, acentos `#58a6ff`. Colores good/ni/poor: `#3fb950` / `#d29922` / `#f85149`. Consistente con FrictionTrace.

### D13. Comparación mobile vs desktop + tooltips

**Choice:** Barras side-by-side PHONE/DESKTOP cuando FF="Todos". Líneas sólidas (PHONE) y dashed (DESKTOP) en tendencia. Tooltips al hover con fecha, p75, y good/ni/poor %.

## Riesgos

- **[Risk] D3 tiene curva de aprendizaje.** → Mitigación: 3 tipos de gráficos con helpers encapsulados.
- **[Risk] Build mode HTML con todos los datos puede pesar 2-3 MB.** → Mitigación: aceptable para descarga local. Si es muy grande, se agrega flag `--build --latest` que solo embeble último snapshot.
- **[Risk] `node:http` verboso para routing.** → Mitigación: solo 8 rutas (1 HTML + 1 CSS + 1 JS + 1 D3 + 4 API). `switch` + `URLSearchParams` suficiente.
- **[Risk] Separar HTML/CSS/JS en archivos complica build mode.** → Mitigación: el script lee los 3 archivos y los combina. Build mode es una función `buildHtml()` que inyecta CSS en `<style>`, JS en `<script>`, y datos en `<script>`.
- **[Risk] Si `d3.v7.min.js` no existe y no hay internet, el dashboard no funciona.** → Mitigación: se commitea al repo. Solo se descarga si no existe.

## Project Layout

```
engine/src/crux/
  dashboard.html        ← HTML template con placeholders
  dashboard.css         ← estilos oscuros
  dashboard.js          ← lógica D3 + filtros + presets
  d3.v7.min.js          ← D3 library (commiteado)
  db.ts / schema.ts / daos.ts / queries.ts  ← ya existen

scripts/
  crux-dashboard.ts     ← servidor HTTP + build mode

reports/
  crux-dashboard.html   ← generado por --build (.gitignore)
```
