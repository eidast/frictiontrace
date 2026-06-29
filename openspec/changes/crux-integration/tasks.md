# Tasks — crux-integration

Implementation checklist for CrUX data integration. Tasks are ordered by dependency.

## 1. Configuración de sitios y URLs

- [x] 1.1 Crear `engine/crux-pages.yaml` con los 28 sitios del benchmark (`docs/sites.md`), agrupados por `walmart_propios`, `walmart_subsidiarias`, `otros`, con `url: null` para checkout, PLP, y PDP (solo homepage pre-poblada)
- [x] 1.2 Definir schema Zod en `engine/src/crux/config-schema.ts` para validar `crux-pages.yaml` (tipos `CruxSiteConfig`, `CruxPageEntry`, grupos válidos, page types válidos)

## 2. Storage layer (crux.db)

- [x] 2.1 Implementar `engine/src/crux/types.ts` con interfaces para cada tabla (`CruxOriginRow`, `CruxQueryRow`, `CruxCollectionRow`, `CruxHistoryRow`)
- [x] 2.2 Implementar `engine/src/crux/schema.ts` con el DDL de 4 tablas (`crux_origins`, `crux_queries`, `crux_collections`, `crux_history`) con constraints UNIQUE y 3 índices: `(metric_name, collection_end)`, `(query_id, form_factor, metric_name)`, `(query_level, metric_name)`
- [x] 2.3 Implementar `engine/src/crux/db.ts` con `openCruxDb()` y `closeCruxDb()` apuntando a `data/crux.db`, aplicando el schema con WAL mode y foreign keys. Crear directorio `data/` si no existe.
- [x] 2.4 Implementar DAOs en `engine/src/crux/daos.ts`: `cruxOriginsRepo` (upsert), `cruxQueriesRepo` (upsert por origin_id+url+page_type), `cruxCollectionsRepo` (insert), `cruxHistoryRepo` (insert con INSERT OR IGNORE)
- [x] 2.5 Crear `.gitattributes` con `data/crux.db binary` para evitar conflictos de merge

## 3. Descubrimiento de URLs

- [x] 3.1 Implementar `scripts/crux-discover.ts` que lee `engine/crux-pages.yaml`, itera sitios con `url: null`, y lanza Playwright para cada uno
- [x] 3.2 Implementar lógica de descubrimiento de checkout: navegar homepage → buscar `a[href*='cart']`, `a[href*='carrito']`, `a[href*='checkout']`, `a[href*='pagar']`, iconos de carrito (`[data-testid='cart-icon']`)
- [x] 3.3 Implementar lógica de descubrimiento de PLP: detectar navegación de categorías (navbar, mega-menu), priorizar "abarrotes"/"despensa", fallback al primer link de categoría
- [x] 3.4 Implementar lógica de descubrimiento de PDP: navegar al PLP → hacer click en el primer producto (`a[href*='/product']`, `a[href*='/p/']`, `[data-testid='product-card'] a`)
- [x] 3.5 Implementar escritura de vuelta a `engine/crux-pages.yaml` preservando entradas existentes y actualizando solo las URLs descubiertas
- [x] 3.6 Agregar manejo de errores: timeout por sitio (30s), log de sitios fallidos, continuar con el siguiente

## 4. Sync con CrUX History API

- [x] 4.1 Implementar `scripts/crux-sync.ts` que lee `engine/crux-pages.yaml` (validando con Zod schema) y `CRUX_API_KEY` del entorno
- [x] 4.2 Implementar cliente HTTP para CrUX History API: `POST https://chromeuxreport.googleapis.com/v1/records:queryHistoryRecord?key=API_KEY` con body `{url, formFactor, collectionPeriodCount: 40}` o `{origin, formFactor, collectionPeriodCount: 40}`
- [x] 4.3 Implementar retry con exponential backoff: hasta 3 intentos con delays de 1s, 2s, 4s. Solo reintentar errores transitorios (429, timeout, 5xx). No reintentar 403, 404.
- [x] 4.4 Implementar iteración de queries: para cada sitio, iterar page types con URL non-null, para cada uno iterar form factors (PHONE, DESKTOP)
- [x] 4.5 Implementar fallback origin: si la query por URL devuelve error HTTP (404, 400), reintentar con `origin` en vez de `url` y marcar `query_level='origin'`
- [x] 4.6 Implementar `parseHistoryResponse(responseJson)` como función pura que:
  - Convierte `collectionPeriods[].{firstDate,lastDate}` a strings `YYYY-MM-DD` (zero-padded)
  - Itera en paralelo `collectionPeriods[i]`, `histogramTimeseries[bin].densities[i]`, `percentilesTimeseries.p75s[i]`
  - Para cada métrica y cada período `i`, produce un objeto `{metric_name, collection_start, collection_end, p75_value, good_pct, ni_pct, poor_pct}`
  - Convierte `"NaN"` → `null`, `null` → `null`
  - Maneja métricas faltantes (skip) y períodos sin datos (row con NULLs)
- [x] 4.7 Implementar persistencia: insertar/upsert en `crux_origins`, `crux_queries`, y luego insertar en `crux_collections` + `crux_history` en una transacción por query
- [x] 4.8 Agregar reporte de sync: al finalizar, loguear queries exitosas/fallidas, cuántas ventanas nuevas se insertaron vs duplicadas ignoradas, y un summary JSON

## 5. Query helpers para analytics

- [x] 5.1 Implementar `engine/src/crux/queries.ts` con `getMetricsByGroup(db, groupName)` — agrega métricas (AVG de p75, good_pct) por grupo
- [x] 5.2 Implementar `getMetricsByPageType(db, pageType)` — agrega métricas por tipo de página
- [x] 5.3 Implementar `getTimeSeries(db, origin, metricName, formFactor)` — tendencia histórica para un sitio, ordenada por `collection_end`
- [x] 5.4 Implementar `getLatestSnapshot(db)` — último período de colección para todos los sitios, con preferencia por `query_level='url'` sobre `'origin'`

## 6. Tests

- [x] 6.1 Configurar `engine/vitest.config.ts` para incluir `tests/unit/crux/` (si no está ya cubierto)
- [x] 6.2 Escribir `tests/unit/crux/schema.test.ts` — crear DB in-memory, aplicar schema, verificar que las 4 tablas y 3 índices existen
- [x] 6.3 Escribir `tests/unit/crux/daos.test.ts` — insert/query round-trip para los 4 DAOs, verificar INSERT OR IGNORE para duplicados
- [x] 6.4 Escribir `tests/unit/crux/parse-history.test.ts` — usar un fixture JSON de una respuesta real de `queryHistoryRecord`, verificar que `parseHistoryResponse` produce las filas esperadas (incluyendo casos con `"NaN"`, `null`, métricas faltantes)
- [x] 6.5 Escribir `tests/unit/crux/sync.test.ts` — mockear `fetch` para simular respuestas de la API, verificar fallback URL→origin, retry en 429, skip en 403

## 7. Script de analytics (uso inicial)

- [x] 7.1 Implementar `scripts/crux-analyze.ts` que abre `data/crux.db`, ejecuta las queries analíticas más relevantes, y produce una salida legible (tabla en consola o markdown):
  - Top 5 peores checkouts mobile (por LCP p75)
  - Comparativa Walmart propios vs subsidiarias vs otros (todas las métricas, último snapshot)
  - Tendencia de INP mobile para los 3 peores sitios (últimos 6 meses)
- [x] 7.2 Ejecutar `scripts/crux-analyze.ts` después del primer sync para validar que los datos son accionables

## 8. Integración y documentación

- [x] 8.1 Agregar `.env.example` al repo con `CRUX_API_KEY=` (sin valor)
- [x] 8.2 Asegurar que `data/crux.db` NO esté en `.gitignore` (se versiona)
- [x] 8.3 Documentar en `README.md` la sección "CrUX Data" explicando cómo ejecutar descubrimiento, sync, y analytics
- [x] 8.4 Agregar entry en `CONTRIBUTING.md` sobre cómo agregar un nuevo sitio al benchmark
- [ ] 8.5 Ejecutar descubrimiento real contra los 28 sitios y committear `crux-pages.yaml` resultante
- [x] 8.6 Ejecutar sync real contra la CrUX History API y committear `data/crux.db` con datos iniciales (hasta 40 semanas de historia)
- [x] 8.7 Ejecutar analytics script sobre los datos reales y documentar hallazgos iniciales
