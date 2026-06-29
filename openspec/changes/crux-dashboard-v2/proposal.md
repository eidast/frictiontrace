## Why

El dashboard CrUX v1 fue completado pero presenta bugs críticos que impiden su funcionamiento en modo serve (D3 nunca se carga, métrica vacía produce vistas en blanco, presets no resetean filtros) y carece del soporte de exploración temporal rápida que el usuario necesita. Además, la experiencia de usuario actual es pasiva: el dashboard es un visor de datos, no una herramienta de exploración que guíe al analista desde el masajeo de datos hasta la generación de insights accionables.

## What Changes

### Bug fixes (bloqueantes)
- Agregar `<script src="d3.v7.min.js">` en `dashboard.html` para que D3 se cargue en modo serve
- Corregir `state.metric` para que el valor por defecto muestre todas las métricas (LCP por defecto, o todas) en vez de filtrar a cero resultados
- Agrupar filas planas de `/api/timeseries` en series en `renderTendencia()` para que `drawLineChart` funcione en modo serve
- Hacer que `applyPreset()` reseteé todos los filtros relevantes antes de aplicar la configuración del preset

### Exploración temporal (date presets)
- Agregar botones de rango rápido en el sidebar: "1m", "2m", "4m", "6m", "Todo" que setean `dateFrom`/`dateTo` automáticamente

### UX — Masajeo (exploración)
- Indicador de carga (spinner/skeleton) durante fetch de datos
- Botón "Limpiar filtros" para resetear todos los filtros a defaults
- Chips/pills de filtros activos visibles en la barra superior
- Búsqueda/filtro en la lista de checkboxes de sitios
- Botones "Seleccionar todos" / "Deseleccionar todos" en sitios
- Estado inicial: mostrar LCP por defecto al cargar el dashboard

### UX — Entendimiento (comprensión)
- Líneas de threshold de Core Web Vitals en gráficos de barras y líneas (LCP: 2500ms/4000ms, etc.)
- Indicador de frescura de datos (fecha del último sync) en la barra superior
- Flechas de tendencia (▲/▼) en scorecards del Resumen comparando con el período anterior
- Mejora de accesibilidad: patrones de textura + color en barras Good/NI/Poor
- Títulos de gráficos narrativos que resuman el hallazgo principal
- Vista de cobertura de datos: % de queries con datos URL vs Origin, períodos disponibles

### UX — Insights (descubrimiento)
- Drill-down: click en una barra/grupo → filtra el dashboard por esa dimensión
- Detección de anomalías: resaltar sitios/métricas con cambios >20% respecto al promedio
- Persistencia de estado en URL: filtros y tab activo se reflejan en query params
- Baseline de comparación: mostrar el promedio del grupo como referencia en gráficos de sitio
- Export con metadatos: incluir filtros activos, fecha de exportación y fuente en CSV/JSON

## Capabilities

### New Capabilities
- `dashboard-date-presets`: botones de rango rápido (1m, 2m, 4m, 6m, Todo) en el sidebar que configuran dateFrom/dateTo automáticamente
- `dashboard-active-filters`: chips visibles en la barra superior que muestran los filtros activos y permiten removerlos individualmente
- `dashboard-drilldown`: interacción de click en barras/grupos de gráficos que aplica ese valor como filtro
- `dashboard-anomalies`: detección y resaltado visual de métricas con variación >20% respecto al promedio del grupo
- `dashboard-url-state`: los filtros y tab activo se persisten en la URL como query params para compartir y bookmarkear
- `dashboard-data-coverage`: indicador de frescura de datos y vista de cobertura (% URL vs Origin, períodos por sitio)

### Modified Capabilities
- `crux-dashboard`: los siguientes requerimientos de la spec v1 cambian:
  - Requerimiento "D3.js is served from a local file": el HTML debe incluir el tag `<script>` para cargar D3 en modo serve
  - Requerimiento "Global filters control all views": el estado inicial debe mostrar LCP por defecto, los presets deben resetear filtros completos, y el sidebar debe incluir date presets y búsqueda de sitios
  - Requerimiento "API exposes CrUX data with query_level": el endpoint `/api/timeseries` debe devolver datos agrupados por serie (o el frontend debe agruparlos)
  - Requerimiento "Empty and error states": agregar estado de carga (loading) como estado intermedio
  - Requerimiento "D3.js visualizations render with tooltips": agregar líneas de threshold CWV, texturas de accesibilidad, drill-down, y detección de anomalías
  - Requerimiento "Resumen Ejecutivo adapts to metric filter": agregar flechas de tendencia ▲/▼ comparando con período anterior
  - Requerimiento "Export buttons are globally accessible": agregar metadatos de contexto al export

## Impact

- **Archivos modificados:** `dashboard.html`, `dashboard.css`, `dashboard.js` (engine/src/crux/)
- **Archivo modificado:** `scripts/crux-dashboard.ts` (endpoint `/api/timeseries`)
- **Nuevas dependencias:** ninguna. Todo es vanilla JS + D3 existente + CSS
- **Código existente:** sin cambios en `db.ts`, `schema.ts`, `daos.ts`, `queries.ts`, o el motor de FrictionTrace
- **Breaking changes:** ninguno. Todos los cambios son aditivos o correctivos sobre el dashboard existente
