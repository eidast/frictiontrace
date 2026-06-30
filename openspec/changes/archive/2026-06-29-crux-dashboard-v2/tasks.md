## 1. Bug fixes — Críticos

- [x] 1.1 Agregar `<script src="d3.v7.min.js">` antes de `<script src="dashboard.js">` en `dashboard.html` para que D3 se cargue en modo serve
- [x] 1.2 Cambiar `state.metric` de `''` a `'largest_contentful_paint'` para que la vista inicial muestre LCP en vez de vacío
- [x] 1.3 Modificar `renderGrupos()` y `renderSitios()` para que cuando `state.metric === ''` (Todas las métricas) muestren LCP con un aviso, en vez de filtrar a cero resultados
- [x] 1.4 Extraer lógica de agrupación de `filterTimeseries()` a función `groupTimeseries(rows)` y usarla en `renderTendencia()` para agrupar filas planas de `/api/timeseries` antes de llamar a `drawLineChart()`
- [x] 1.5 Modificar `applyPreset()` para que cada preset resetee todos los filtros a defaults antes de aplicar su configuración específica

## 2. Date presets

- [x] 2.1 Agregar botones de date preset en `dashboard.html` en la sección de rango de fechas del sidebar: "1m", "2m", "4m", "6m", "Todo"
- [x] 2.2 Agregar estilos CSS para los botones de date preset en `dashboard.css`
- [x] 2.3 Implementar `bindDatePresets()` y `setDatePreset(n)` en `dashboard.js` que calculen `monthsAgo(n)` y `ymd(today)`, actualicen los inputs y disparen `applyFilters()`
- [x] 2.4 Implementar highlight visual del botón de preset activo basado en `state.dateFrom` y `state.dateTo`
- [x] 2.5 Llamar `bindDatePresets()` desde `init()`

## 3. Loading state

- [x] 3.1 Agregar CSS para `.loading-overlay` y `.loading-spinner` con animación en `dashboard.css`
- [x] 3.2 Implementar `showLoading()` y `hideLoading()` en `dashboard.js`
- [x] 3.3 Modificar `applyFilters()` en modo serve para llamar `showLoading()` antes de `fetchData()` y `hideLoading()` al recibir respuesta o error

## 4. Active filter chips

- [x] 4.1 Agregar contenedor `#active-filters` en la barra superior de `dashboard.html` entre el título y los botones de export
- [x] 4.2 Agregar estilos CSS para chips con botón X en `dashboard.css`
- [x] 4.3 Implementar `renderActiveFilters()` en `dashboard.js` que lea `state` y genere chips para cada filtro activo (group, sites, pageType, metric, formFactor, queryLevel, dateRange)
- [x] 4.4 Implementar `removeFilter(type)` que resetee un filtro individual y llame a `applyFilters()`
- [x] 4.5 Llamar `renderActiveFilters()` al final de `applyFilters()` (después de renderizar la vista)

## 5. URL state persistence

- [x] 5.1 Implementar `stateToUrl()` que actualice `window.location.search` vía `history.pushState()` con los filtros activos no-default
- [x] 5.2 Implementar `urlToState()` que lea `URLSearchParams` y popule `state` al cargar la página
- [x] 5.3 Agregar listener `window.addEventListener('popstate', ...)` que llame a `urlToState()` + `syncFilterUI()` + `applyFilters()`
- [x] 5.4 Llamar `stateToUrl()` en `applyFilters()` después de aplicar cambios de estado
- [x] 5.5 Llamar `urlToState()` en `init()` si hay query params, antes de `applyFilters()`

## 6. Threshold lines en gráficos

- [x] 6.1 Definir constantes de thresholds CWV en `dashboard.js`: `CWV_THRESHOLDS = { lcp_good: 2500, lcp_ni: 4000, cls_good: 0.1, cls_ni: 0.25, inp_good: 200, inp_ni: 500, fcp_good: 1800, fcp_ni: 3000, ttfb_good: 800, ttfb_ni: 1800 }`
- [x] 6.2 Modificar `drawLineChart()` para dibujar líneas horizontales punteadas con etiquetas en los valores de threshold cuando la métrica activa es LCP/CLS/INP/FCP/TTFB
- [x] 6.3 Modificar `drawScatter()` para dibujar líneas de threshold en los ejes correspondientes

## 7. Accesibilidad — Patrones de textura en barras

- [x] 7.1 Agregar definiciones de `<pattern>` SVG (diagonal para NI, grid para Poor) en `drawGroupedBars()`
- [x] 7.2 Asignar `fill` con referencia al pattern correspondiente según la categoría (good/ni/poor)

## 8. Drill-down en gráficos

- [x] 8.1 Implementar `drillDown(dimension, value)` que actualice `state[dimension]`, `updateFilterUI()`, y llame a `applyFilters()`
- [x] 8.2 Modificar `drawGroupedBars()` para agregar `.on('click', ...)` en las barras que llame a `drillDown('group', value)` o `drillDown('sites', [value])` según el contexto
- [x] 8.3 Modificar `drawScatter()` para agregar `.on('click', ...)` en los círculos que llame a `drillDown('sites', [d.origin])`
- [x] 8.4 Agregar cursor `pointer` y tooltip hint "Click para filtrar" en los elementos clickeables

## 9. Detección de anomalías

- [x] 9.1 Implementar `detectAnomalies(rows)` que calcule promedios por grupo+métrica+FF y marque filas con desviación >20%
- [x] 9.2 Modificar `renderDatos()` para agregar ícono ⚠ y borde naranja en filas anómalas
- [x] 9.3 Modificar `drawGroupedBars()` para agregar borde dashed naranja en barras con datos anómalos
- [x] 9.4 Modificar tooltips de charts para incluir indicador de anomalía y % de desviación

## 10. Data freshness y coverage

- [x] 10.1 Agregar consulta SQL en `crux-dashboard.ts` al endpoint `/api/sites` o nuevo endpoint `/api/meta` que devuelva `MAX(collection_end)` y conteos de cobertura
- [x] 10.2 Modificar `loadSites()` o agregar `loadMeta()` en `dashboard.js` para obtener y guardar datos de frescura/cobertura
- [x] 10.3 Renderizar indicador "Datos al <fecha>" en la barra superior
- [x] 10.4 Agregar sección de cobertura en el tab Resumen con % URL vs Origin, número de períodos, y sitios con datos

## 11. Trend arrows en Resumen

- [x] 11.1 Modificar `renderResumen()` (o `renderScorecards()`) para calcular el promedio del período anterior (collection_end entre monthsAgo(2) y monthsAgo(1)) y compararlo con el período actual
- [x] 11.2 Agregar flechas ▲ (rojo, empeoró >5%), ▼ (verde, mejoró >5%), → (gris, cambio ≤5%) en los scorecards
- [x] 11.3 En modo serve, extender `/api/summary` para incluir datos del período anterior; en modo build, calcular sobre `CRUX_DATA`

## 12. Site search y selección masiva

- [x] 12.1 Agregar `<input type="text" placeholder="Buscar sitio...">` arriba de `#site-checkboxes` en `dashboard.html`
- [x] 12.2 Agregar botones "Todos" y "Ninguno" junto al buscador
- [x] 12.3 Implementar `bindSiteSearch()` que filtre checkboxes en tiempo real según el texto ingresado
- [x] 12.4 Implementar handlers para "Todos" (seleccionar todos los checkboxes visibles) y "Ninguno" (desseleccionar todos)

## 13. Reset filters button

- [x] 13.1 Agregar botón "Limpiar filtros" en el sidebar o barra superior en `dashboard.html`
- [x] 13.2 Implementar `resetAllFilters()` que restaure `state` a defaults, llame a `updateFilterUI()` con valores default, y dispare `applyFilters()`

## 14. Export con metadatos

- [x] 14.1 Modificar `exportData()` y funciones relacionadas para incluir metadatos: en CSV como líneas de comentario `#`, en JSON como campo `_metadata`
- [x] 14.2 Los metadatos deben incluir: fecha de exportación, filtros activos (human-readable), fuente (`crux.db` o `static build`), y cantidad de registros
- [x] 14.3 Modificar `toCSV()` para aceptar y prepender líneas de metadatos como comentarios

## 15. Verificación final

- [x] 15.1 Probar modo serve: levantar servidor, verificar que D3 carga, gráficos renderizan, presets funcionan, date presets responden
- [x] 15.2 Probar modo build: generar HTML, abrir en navegador, verificar que todo funciona offline con datos embebidos
- [x] 15.3 Verificar URL state: cambiar filtros, refrescar página, confirmar que estado persiste; probar back/forward del navegador
- [x] 15.4 Verificar drill-down: click en barras y scatter, confirmar filtros se actualizan
- [x] 15.5 Verificar anomalías: identificar datos con >20% desviación manualmente y confirmar que se resaltan en UI
- [x] 15.6 Verificar export: descargar CSV y JSON con filtros activos, confirmar metadatos presentes
