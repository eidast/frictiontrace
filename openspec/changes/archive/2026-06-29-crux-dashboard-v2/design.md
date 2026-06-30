# Design — crux-dashboard-v2

## Context

El dashboard CrUX v1 funciona en modo build (HTML autocontenido) pero tiene 4 bugs bloqueantes en modo serve y carece de features de UX para el flujo de exploración de datos. El usuario necesita una herramienta que soporte el pipeline masajeo → entendimiento → insights.

La arquitectura actual es: servidor Node (`crux-dashboard.ts`) con API REST sobre SQLite (`better-sqlite3`) + frontend vanilla HTML/CSS/JS con D3.js v7. No hay frameworks, build tools, ni dependencias externas de red.

## Goals / Non-Goals

**Goals:**
- Corregir los 4 bugs bloqueantes (D3 no cargado, métrica vacía, timeseries flat, presets sin reset)
- Agregar date presets (1m, 2m, 4m, 6m, Todo) en el sidebar
- Implementar estados de carga y chips de filtros activos
- Agregar drill-down en gráficos de barras y scatter
- Persistir estado de filtros/tab en URL query params
- Agregar líneas de threshold CWV en gráficos
- Detectar y resaltar anomalías (>20% desviación)
- Mejorar accesibilidad con patrones de textura en barras
- Agregar indicador de frescura y cobertura de datos
- Flechas de tendencia ▲/▼ en Resumen
- Export con metadatos de contexto

**Non-Goals:**
- Autenticación o multi-usuario
- Responsive design mobile (el dashboard es para escritorio 1280px+)
- Backend de analítica o persistencia de sesiones de usuario
- Integración con el analyzer de FrictionTrace
- Tests automatizados para el frontend (el dashboard es vanilla JS sin framework de test)
- WebSockets o actualizaciones en tiempo real

## Decisions

### D1. Agrupación de timeseries en el frontend

**Choice:** Agrupar las filas planas de `/api/timeseries` en `renderTendencia()` antes de pasarlas a `drawLineChart()`, replicando la lógica de `filterTimeseries()` que ya existe para build mode.

**Why:** No modificar el endpoint del servidor (evita breaking change en API). La función `filterTimeseries()` ya agrupa correctamente por `origin|form_factor`. Extraer esa lógica a una función compartida `groupTimeseries(rows)` que usen tanto `renderTendencia()` (serve) como `filterTimeseries()` (build). El servidor sigue devolviendo filas planas que son más fáciles de consumir para otros clientes.

**Alternatives considered:**
- Modificar el endpoint para devolver series agrupadas: requeriría cambiar el contrato de API, y el formato agrupado es menos estándar para consumidores externos.
- Agrupar en el servidor con un flag `?grouped=true`: agrega complejidad innecesaria al servidor.

### D2. Drill-down por click en gráficos

**Choice:** Agregar event listeners de click en barras (grouped bars), círculos (scatter), y puntos (line chart) que llamen a `drillDown(dimension, value)`. Esta función actualiza `state` y los dropdowns del sidebar, luego llama a `applyFilters()`. Feedback visual: cursor pointer + highlight al hover.

```
click en barra "walmart_subsidiarias"
  → drillDown('group', 'walmart_subsidiarias')
    → state.group = 'walmart_subsidiarias'
    → updateFilterUI({group: 'walmart_subsidiarias'})
    → applyFilters()
```

**Why:** Convierte los gráficos de elementos pasivos a controles interactivos. El usuario puede navegar los datos sin tocar el sidebar. La implementación es mínima: reutiliza `updateFilterUI()` y `applyFilters()` existentes.

**Alternatives considered:**
- Doble-click: menos descubrible.
- Menú contextual (right-click): complejidad innecesaria para este contexto.

### D3. URL state persistence

**Choice:** Usar `history.pushState()` + evento `popstate` para sincronizar filtros con query params. Al cambiar cualquier filtro, se actualiza `window.location.search`. Al cargar la página (o navegar hacia atrás), se leen los params y se aplican.

```
state → URL:
  state.group = 'walmart_propios'
  state.metric = 'largest_contentful_paint'
  state.activeTab = 'grupos'
  → ?group=walmart_propios&metric=largest_contentful_paint&tab=grupos

URL → state (on load / popstate):
  new URLSearchParams(window.location.search)
  → state.group = params.get('group') || ''
  → state.activeTab = params.get('tab') || 'resumen'
```

**Why:** Permite compartir links con contexto ("mirá el LCP de walmart propios"), bookmarkear vistas específicas, y navegar hacia atrás/adelante con los botones del navegador. Implementación vanilla sin librerías.

**Alternatives considered:**
- `hashchange` con `#`: más feo, interfiere con scroll.
- LocalStorage: no permite compartir links.

### D4. Detección de anomalías

**Choice:** Calcular en el frontend, sobre los datos ya filtrados. Para cada sitio+métrica+FF, comparar el valor actual contra el promedio del grupo. Si la diferencia es >20%, marcar con borde naranja/rojo y un ícono ⚠.

Algoritmo:
```
for each row in filtered data:
  groupAvg = average(good_pct) for all rows with same group_name + metric_name + form_factor
  deviation = abs(row.good_pct - groupAvg) / groupAvg
  if deviation > 0.20:
    mark as anomaly
```

**Why:** Detección simple y efectiva sin necesidad de backend. El threshold de 20% es conservador pero captura desviaciones significativas. Se aplica en la tabla de Datos, en tooltips, y como borde en barras del gráfico.

### D5. Date presets como botones

**Choice:** Agregar una fila de botones debajo de los inputs de fecha en el sidebar: `[1m] [2m] [4m] [6m] [Todo]`. Cada botón llama a `setDatePreset(n)` que calcula `dateFrom = monthsAgo(n)`, `dateTo = today`, actualiza los inputs y dispara `applyFilters()`. El botón "Todo" limpia ambos campos.

```
<div class="date-presets">
  <button data-months="1">1m</button>
  <button data-months="2">2m</button>
  <button data-months="4">4m</button>
  <button data-months="6">6m</button>
  <button data-months="0">Todo</button>
</div>
```

**Why:** La función `monthsAgo()` ya existe. Es puramente aditivo. Los botones son más rápidos que los date inputs nativos para rangos comunes.

**Alternatives considered:**
- Dropdown con opciones: menos visible, requiere dos clicks.
- Date range picker custom: overkill, implementación compleja.

### D6. Chips de filtros activos

**Choice:** Renderizar chips/pills en la barra superior (entre el título y los botones de export) que muestren cada filtro activo. Cada chip tiene un botón X para remover ese filtro individualmente. Se actualizan en cada `applyFilters()`.

```
[CrUX Dashboard]  [LCP ✕] [PHONE ✕] [walmart_propios ✕]  [Presets ▾] [CSV] [JSON]
```

Chips visibles para: group, sites (si ≤3, sino "3 sitios"), pageType, metric, formFactor, queryLevel, date range.

**Why:** El usuario pierde contexto de qué filtros están activos al explorar. Los chips dan visibilidad inmediata y permiten remover filtros sin ir al sidebar.

### D7. Líneas de threshold CWV

**Choice:** Dibujar líneas horizontales en gráficos de barras (eje Y secundario o rectángulos de fondo) y líneas en gráficos de tendencia con los thresholds oficiales de Core Web Vitals:

| Métrica | Good | Needs Improvement | Poor |
|---------|------|-------------------|------|
| LCP | ≤ 2500ms | ≤ 4000ms | > 4000ms |
| CLS | ≤ 0.1 | ≤ 0.25 | > 0.25 |
| INP | ≤ 200ms | ≤ 500ms | > 500ms |
| FCP | ≤ 1800ms | ≤ 3000ms | > 3000ms |
| TTFB | ≤ 800ms | ≤ 1800ms | > 1800ms |

Para el gráfico de barras (grupos/sitios) que muestra good/ni/poor %, no aplican thresholds. Para el gráfico de tendencia (p75 vs tiempo), se dibujan líneas horizontales punteadas en los valores de threshold con etiquetas "Good" / "NI".

**Why:** Sin thresholds, los valores absolutos de p75 no tienen significado. 2800ms de LCP no le dice nada al usuario sin contexto. Las líneas anclan la interpretación.

### D8. Patrones de accesibilidad en barras

**Choice:** Agregar patrones SVG (`<pattern>`) a las barras Good/NI/Poor además del color:
- Good: color sólido `#3fb950`
- NI: líneas diagonales sobre `#d29922`
- Poor: cuadrícula sobre `#f85149`

```svg
<pattern id="pattern-ni" width="4" height="4" patternTransform="rotate(45)">
  <line x1="0" y1="0" x2="0" y2="4" stroke="#fff" stroke-width="0.5" opacity="0.3"/>
</pattern>
```

**Why:** ~8% de hombres tienen daltonismo rojo-verde. El patrón + color garantiza que las categorías sean distinguibles para todos. Es un cambio puramente aditivo en el SVG generado por D3.

### D9. Indicador de frescura y cobertura

**Choice:** En la barra superior, mostrar "Datos: 29 Jun 2026" (fecha del último `collection_end` en la DB). En el tab Resumen, agregar una sección "Cobertura" con:
- % de queries con datos URL vs Origin
- Número de períodos disponibles
- Sitios con datos faltantes

Los datos de cobertura se obtienen de `/api/summary` (extendiendo el endpoint) o calculando sobre los datos ya cargados.

**Why:** El usuario necesita confiar en los datos. Sin indicador de frescura, no sabe si está viendo datos de hoy o de hace 2 meses.

### D10. Flechas de tendencia en Resumen

**Choice:** En los scorecards del Resumen, comparar el promedio actual (último período) contra el promedio del período anterior. Mostrar:
- ▲ rojo si empeoró >5% (p75 aumentó o good% bajó)
- ▼ verde si mejoró >5%
- → gris si cambio ≤5%

El período de comparación es el mes calendario anterior (collection_end entre monthsAgo(2) y monthsAgo(1) vs monthsAgo(1) y today).

**Why:** El Resumen actual es estático. Las flechas dan contexto temporal inmediato sin necesidad de navegar al tab Tendencia.

### D11. Export con metadatos

**Choice:** Agregar una sección de metadatos al inicio del CSV (como comentarios `#`) y como campo `_metadata` en el JSON:

```csv
# CrUX Dashboard Export
# Date: 2026-06-29
# Filters: metric=LCP, group=walmart_propios, ff=PHONE
# Source: data/crux.db
Site,Origin,Group,Metric,FF,p75,Good%,NI%,Poor%
...
```

```json
{
  "_metadata": {
    "exported_at": "2026-06-29T10:30:00Z",
    "filters": {"metric": "LCP", "group": "walmart_propios"},
    "source": "crux.db",
    "record_count": 245
  },
  "data": [...]
}
```

**Why:** Un CSV sin contexto es inútil en 2 semanas. Los metadatos hacen el archivo auto-documentado.

### D12. Métrica por defecto

**Choice:** Cambiar `state.metric` de `''` a `'largest_contentful_paint'`. El dropdown de métrica muestra "LCP" seleccionado al cargar. Si el usuario selecciona "Todas las métricas" (value=""), las funciones de render muestran datos de todas las métricas en vez de filtrar a cero.

Para Resumen con "todas": mostrar 5 scorecards, uno por métrica.
Para Grupos/Sitios con "todas": mostrar solo LCP (es la métrica principal) y un aviso "Seleccioná una métrica específica para ver comparativas".

**Why:** LCP es la métrica más relevante de CWV y un buen punto de partida. Evita la experiencia de "pantalla vacía" en la carga inicial.

### D13. Loading state

**Choice:** Agregar un overlay semi-transparente con spinner CSS en el área de contenido principal durante fetches. Implementación:
1. `showLoading()`: agrega div con clase `loading-overlay` al `#main`
2. `hideLoading()`: remueve el overlay
3. Llamar en `fetchData()` antes/después del fetch

```css
.loading-overlay {
  position: absolute; inset: 0;
  background: rgba(13,17,23,0.7);
  display: flex; align-items: center; justify-content: center;
}
.loading-spinner {
  width: 32px; height: 32px;
  border: 3px solid #30363d;
  border-top-color: #58a6ff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
```

**Why:** Sin feedback visual, el usuario no sabe si el dashboard está procesando o roto.

### D14. Búsqueda en lista de sitios y seleccionar todo

**Choice:** Agregar un `<input type="text" placeholder="Buscar sitio...">` arriba de los checkboxes que filtra la lista en tiempo real. Agregar dos botones pequeños: "Todos" y "Ninguno" para selección masiva.

**Why:** Con 19+ sitios, la lista de checkboxes es difícil de navegar. El filtro de búsqueda reduce la fricción drásticamente.

## Risks / Trade-offs

- **[Risk] URL state puede generar URLs muy largas con muchos sitios seleccionados.** → Mitigación: si hay >5 sitios, comprimir o usar "sites=all". Si hay 0 sitios, omitir el param (equivale a todos).
- **[Risk] La detección de anomalías en frontend puede ser lenta con muchos datos.** → Mitigación: solo se ejecuta sobre datos ya filtrados (no sobre todo el dataset). El threshold es configurable pero fijo en 20%.
- **[Risk] El drill-down puede confundir al usuario si no sabe que las barras son clickeables.** → Mitigación: cursor pointer + tooltip que diga "Click para filtrar por este grupo" al hover.
- **[Risk] Los patrones SVG de textura pueden no renderizar en todos los navegadores.** → Mitigación: probar en Chrome, Firefox, Safari. Si falla, el color sigue siendo el fallback principal.
- **[Risk] Modificar el endpoint `/api/timeseries` o su consumo puede romper build mode.** → Mitigación: No se modifica el endpoint. La agrupación ocurre solo en el frontend, en una función compartida que usan serve y build mode.

## Open Questions

- ¿El indicador de frescura debe consultar la DB cada vez que se carga la página o se puede cachear?
- ¿Los thresholds de CWV deberían ser configurables (archivo de configuración) o hardcodeados?
- ¿El export con metadatos debe ser opt-in (checkbox "incluir metadatos") o siempre activo?
