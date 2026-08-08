# Design — crux-integration

## Context

FrictionTrace M0 audita sitios de e-commerce con Playwright y produce reportes de fricción sintética. Los 28 sitios del benchmark están documentados en `docs/sites.md`, organizados en tres grupos: Walmart propios (5), Walmart subsidiarias (8), y otros grupos (6). Cada sitio tiene múltiples tipos de página relevantes para la experiencia de compra: homepage, checkout, PLP (listado de productos), y PDP (detalle de producto).

El proyecto ya usa `better-sqlite3` como capa de storage (per-run), Playwright como navegador, y YAML para configuración de journeys. No existe aún una base de datos transversal ni integración con APIs externas de monitoreo.

Google CrUX expone datos públicos de Core Web Vitals vía REST API (`chromeuxreport.googleapis.com`). El endpoint relevante es `queryHistoryRecord`, que devuelve hasta 40 semanas de historial (~10 meses) con ventanas de 28 días solapadas cada 7 días. La respuesta es un objeto con arrays paralelos: `collectionPeriods[]` (fechas `{year, month, day}`), `histogramTimeseries[]` (densidades por bin por período), y `percentilesTimeseries.p75s[]` (valores p75 por período). El sync descompone estas timeseries en filas individuales por período de colección. La API es gratuita (~150 QPM compartido entre daily y history API). Requiere API key de Google Cloud pasada como query parameter `?key=`. Si una URL no tiene datos, retorna error; si un período específico no tiene datos elegibles, las densidades aparecen como `"NaN"` y los percentiles como `null`.

La CrUX API devuelve datos a nivel origen o URL. Si una URL específica tiene suficiente tráfico para ser incluida en el dataset público, devuelve métricas para esa URL. Si no, devuelve error y hay que caer a nivel origen. Todos los sitios del benchmark son e-commerce de retail con tráfico significativo, por lo que la mayoría debería tener datos a nivel URL.

## Goals / Non-Goals

**Goals:**
- Descubrir y persistir las URLs reales de checkout, PLP y PDP para cada uno de los 28 sitios del benchmark usando Playwright
- Consultar la CrUX History API para cada URL (y su origen como fallback) y almacenar el historial completo de métricas en SQLite
- Marcar cada registro con procedencia (`source`) y nivel de granularidad (`query_level`) para distinguir datos externos no controlados
- Soportar sync incremental: solo insertar ventanas de colección nuevas en ejecuciones subsecuentes del script de sync
- Exponer una interfaz de consulta desde `engine/src/crux/` para que el analyzer y futuros dashboards lean `data/crux.db`

**Non-Goals:**
- Integración con el analyzer o reporte existente (esto es M1+ de crux; primero recolectamos datos)
- Dashboard o visualización de tendencias (consultas SQL ad-hoc son suficientes por ahora)
- Automatización del sync (cron, CI). Se ejecuta manualmente con `npx tsx scripts/crux-sync.ts`
- Autenticación de usuarios en el e-commerce (guest checkout, sin login)
- Soporte para sitios fuera del benchmark definido en `crux-pages.yaml`
- Normalización de URLs entre sesiones de descubrimiento (se asume que el script de descubrimiento se ejecuta una vez por sitio y las URLs son estables)

## Decisions

### D1. SQLite en `data/crux.db` versionado en el repo

**Choice:** Una base SQLite ubicada en `data/crux.db`, commiteada al repositorio.

**Alternatives considered:**
- **DuckDB:** columnar y mejor para analytics, pero agrega una dependencia nueva. Para ~11K filas (28 sitios × 4 page types × ~40 semanas), SQLite es más que suficiente. DuckDB sería overkill.
- **CSV/Parquet:** portable pero sin queries SQL ad-hoc. Perderíamos la capacidad de hacer joins y agregaciones directamente.
- **SQLite fuera del repo (`.gitignore`):** requeriría que cada developer ejecute el sync inicial. Versionarlo en el repo permite clonar y tener datos listos.

**Why:** `better-sqlite3` ya está en el proyecto. El volumen es bajo (~2-3 MB). Versionarlo elimina fricción de onboarding. SQLite permite consultas analíticas directas (`AVG`, `GROUP BY`, window functions) que cubren el caso de uso de comparación cross-site. Se agrega `.gitattributes` con `data/crux.db binary` para evitar conflictos de merge.

### D2. Schema con 4 tablas

**Choice:**

```
crux_origins (1) ──< crux_queries (N) ──< crux_collections (N)
                                            │
                                            ├── crux_history (N)
```

- **`crux_origins`**: metadatos de cada sitio (origin, group_name, label, country). Uno por sitio del benchmark.
- **`crux_queries`**: cada URL consultada a la API (homepage, checkout, PLP, PDP) con su `query_level` (`origin`|`url`). Varios por origen.
- **`crux_collections`**: cada fetch a la API (form_factor + fetched_at). Uno por query por fetch.
- **`crux_history`**: las métricas de cada ventana de colección (p75, good/ni/poor pct). Varios por collection.

**Why esta estructura:** Separa responsabilidades claramente. `crux_queries` es el catálogo de "qué preguntamos", `crux_collections` es "cuándo preguntamos", `crux_history` es "qué respondió la API". La UNIQUE constraint en `(query_id, form_factor, metric_name, collection_end)` hace el sync idempotente.

### D3. UNIQUE constraint como mecanismo de delta sync

**Choice:** La tabla `crux_history` tiene `UNIQUE(query_id, form_factor, metric_name, collection_end)`. El sync usa `INSERT OR IGNORE`. Las fechas `{year, month, day}` de la API se convierten a `TEXT` en formato `YYYY-MM-DD` antes de insertar.

**Alternatives considered:**
- **Trackear `last_collection_end` y filtrar en app code:** más complejo, propenso a errores de lógica.
- **DELETE + re-INSERT:** pierde el historial de `fetched_at`, no escala.
- **UPSERT con `ON CONFLICT DO UPDATE`:** sobreescribe datos que no deberían cambiar (la API no modifica ventanas pasadas). `INSERT OR IGNORE` es más simple y correcto.

**Why:** La CrUX History API siempre devuelve hasta 40 collection periods (semanas), cada uno con 28 días de datos solapados. Las ventanas pasadas son inmutables. La UNIQUE constraint rechaza duplicados automáticamente — solo las ventanas nuevas se insertan. El script es idempotente.

### D9. Descomposición de timeseries en filas individuales

**Choice:** El script de sync descompone la respuesta timeseries de la API en una fila por `(collection_period, metric)`.

La History API devuelve arrays paralelos:

```
collectionPeriods[i]           → un {firstDate, lastDate}
histogramTimeseries[bin].densities[i] → density para ese bin en ese período
percentilesTimeseries.p75s[i]  → p75 para ese período
```

El sync itera `i` de 0 a `N-1` (donde `N = len(collectionPeriods)`) y para cada período + métrica inserta una fila en `crux_history`. Los valores `"NaN"` en densities y `null` en percentiles se convierten a `NULL` en la base de datos, indicando que ese período no tiene datos elegibles para esa métrica.

**Why:** El modelo relacional (una fila por observación) es mucho más consultable que arrays JSON. Permite `WHERE`, `GROUP BY`, `ORDER BY` directamente en SQL sin deserializar JSON en cada query.

### D10. CLS se almacena como TEXT

**Choice:** El campo `p75_value TEXT` en `crux_history` (no `p75_ms REAL`). Para métricas en milisegundos se almacena el número como string numérico; para CLS se almacena el string decimal tal cual lo devuelve la API (ej. `"0.15"`).

**Why:** La CrUX API devuelve CLS como string decimal de 2 posiciones (`"p75s": ["0.15", "0.16"]`). El resto de métricas devuelven enteros (`"p75s": [1362, 1352]`). Unificar en `TEXT` evita problemas de tipo. Las queries analíticas pueden castear con `CAST(p75_value AS REAL)` cuando la métrica es numérica.

### D11. API key como query parameter

**Choice:** La API key se envía como query parameter en la URL: `POST .../records:queryHistoryRecord?key=CRUX_API_KEY`.

**Why:** Así lo define la API de CrUX. La key en query string es segura en HTTPS (el path y query string van encriptados en TLS). La alternativa (header `API-Key`) no es soportada por este endpoint.

### D12. Retry con backoff para rate limiting y errores transitorios

**Choice:** El sync implementa reintentos con exponential backoff: hasta 3 intentos por query, con delay de 1s, 2s, 4s. Si una query falla definitivamente (404, API key inválida, error de schema), se registra y se continúa con la siguiente query. El sync nunca aborta por fallos individuales.

**Why:** 150 QPM es generoso pero compartido con otras aplicaciones que usen la misma key. Un pico de uso podría causar 429. Errores de red (timeout, reset) son transitorios. Abortar todo el sync por un error en un solo sitio obligaría a re-ejecutar queries ya exitosas.

### D4. Descubrimiento de URLs con Playwright

**Choice:** Script `scripts/crux-discover.ts` que usa Playwright (ya instalado) para navegar cada sitio, detectar links de carrito/checkout, navegar a una categoría, hacer click en un producto, y extraer las URLs resultantes.

**Estrategia de selectores:**
- Checkout: busca `a[href*='cart']`, `a[href*='carrito']`, `a[href*='checkout']`, `a[href*='pagar']`, `[data-testid='cart-icon']`
- PLP: busca el primer link de navegación a categorías (navbar, mega-menu). Prioriza "abarrotes" o "despensa". Si no existe, toma la primera categoría disponible.
- PDP: desde el PLP, hace click en el primer producto visible (selector `a[href*='/product']`, `a[href*='/p/']`, `[data-testid='product-card'] a`)

**Why:** Es el mismo stack que FrictionTrace ya usa para journeys. No requiere nuevas dependencias. El script es independiente del engine (no toca `ft run` ni el analyzer).

### D5. Fallback origin cuando una URL no tiene datos en CrUX

**Choice:** Para cada URL definida en `crux-pages.yaml`, el sync intenta `queryHistoryRecord(url=...)`. Si la API responde con error (URL sin suficiente tráfico), intenta `queryHistoryRecord(origin=...)` y persiste el resultado con `query_level='origin'`.

**Why:** No todas las URLs de checkout van a tener tráfico suficiente para aparecer en CrUX (el threshold es bajo pero existe). Caer a nivel origen garantiza que todo sitio tenga al menos datos a ese nivel. El campo `query_level` permite distinguir ambos casos en queries analíticas.

### D6. Archivo de configuración YAML

**Choice:** `engine/crux-pages.yaml` define los sitios y sus URLs por page type, siguiendo el estilo YAML del proyecto.

```yaml
version: 1
sites:
  - origin: www.walmart.com.gt
    group: walmart_propios
    label: Walmart Guatemala
    country: GT
    pages:
      - type: homepage
        url: https://www.walmart.com.gt/
      - type: checkout
        url: https://www.walmart.com.gt/cart
      - type: plp
        url: https://www.walmart.com.gt/abarrotes
      - type: pdp
        url: https://www.walmart.com.gt/aceite-ideal-4500ml/p
```

**Why:** YAML es el formato de configuración del proyecto (journeys). Es legible, versionable, y fácil de editar manualmente. El script de descubrimiento escribe este archivo, y el script de sync lo lee.

### D7. Módulo `engine/src/crux/` como interfaz de consulta

**Choice:** `engine/src/crux/db.ts` exporta funciones `openCruxDb()` y `closeCruxDb()` (análogas a `openRunDb`), y `engine/src/crux/queries.ts` exporta helpers para queries analíticas comunes.

**Why:** Separar el módulo de consulta del script de sync permite que el analyzer (a futuro) lea `data/crux.db` sin acoplarse al formato de la API de CrUX. El módulo es parte del engine (librería), no del CLI. El schema de 4 tablas es interno al módulo — los consumidores usan las funciones de `queries.ts`.

### D8. Campo `source` para procedencia de datos

**Choice:** Tanto `crux_collections` como `crux_history` tienen un campo `source TEXT NOT NULL DEFAULT 'crux_google'`.

**Why:** Todo dato que viene de CrUX es externo y no controlado. Si a futuro FrictionTrace persiste sus propias mediciones sintéticas en la misma base (o en una paralela), el campo `source` permite distinguir el origen. Es un requerimiento explícito del proyecto marcar la procedencia de datos externos.

### D9. Project layout

```
frictiontrace/
├── data/
│   └── crux.db                  # SQLite versionada, schema crux_*
├── engine/
│   ├── crux-pages.yaml           # Configuración de URLs por sitio
│   └── src/
│       └── crux/
│           ├── db.ts             # openCruxDb / closeCruxDb
│           ├── schema.ts         # DDL del schema crux (4 tablas)
│           ├── types.ts          # interfaces CruxOriginRow, CruxQueryRow, etc.
│           ├── daos.ts           # DAOs para insert/query de las 4 tablas
│           └── queries.ts        # helpers de consulta analítica
├── scripts/
│   ├── crux-discover.ts          # Descubre URLs con Playwright
│   └── crux-sync.ts              # Consulta CrUX API y persiste en data/crux.db
├── tests/
│   └── unit/
│       └── crux/
│           ├── schema.test.ts    # Test de creación de tablas e índices
│           ├── daos.test.ts      # Test de insert/query round-trip
│           ├── parse-history.test.ts  # Test de descomposición de timeseries
│           └── sync.test.ts      # Test de fallback, dedup, NaN/null
└── docs/
    └── sites.md                  # Lista de sitios del benchmark (ya existe)
```

## Risks / Trade-offs

- **[Risk] La CrUX API requiere API key de Google Cloud.** → Mitigación: la key se lee de variable de entorno `CRUX_API_KEY`. Se documenta en `.env.example`. La API es gratuita para el volumen que manejamos.

- **[Risk] URLs de checkout/PLP/PDP pueden cambiar entre ejecuciones del descubrimiento.** → Mitigación: el script de descubrimiento pisa `crux-pages.yaml`. Si una URL cambió, la UNIQUE constraint en `crux_queries` maneja la nueva URL como una query distinta. Las queries viejas quedan como datos históricos (no se borran).

- **[Risk] Algunas URLs pueden no tener datos en CrUX (bajo tráfico).** → Mitigación: el fallback a nivel origen (D5) garantiza cobertura. El campo `query_level` permite filtrar o preferir datos a nivel URL en queries.

- **[Risk] La respuesta timeseries de la History API es compleja de parsear.** → Mitigación: el parseo se implementa como una función pura y testeable unitariamente (`parseHistoryResponse`). Se escribe un test con un fixture JSON de respuesta real para validar la descomposición en filas. Casos límite: `"NaN"` en densities, `null` en percentiles, métricas faltantes, collection periods vacíos.

- **[Risk] `data/crux.db` en el repo crece con cada sync.** → Mitigación: a ~11K filas, el archivo pesa ~2-3 MB. Se agrega `.gitattributes` con `data/crux.db binary` para tratar el archivo como binario en git (evita diff y merge conflicts). Si eventualmente crece demasiado, se puede mover a git-lfs.

- **[Risk] La History API solo cubre 40 semanas (~10 meses), no 2.5 años.** → Mitigación: para tendencias de más largo plazo, se puede complementar con el dataset de BigQuery en un cambio futuro. Por ahora, 40 semanas cubren el caso de uso principal (comparativas recientes, tendencias de corto-mediano plazo).

- **[Risk] El script de descubrimiento es frágil ante sitios con anti-bot protection o SPAs.** → Mitigación: Playwright con Chromium headless realista (viewport, locale, timezone). Si un sitio bloquea el script o usa una SPA donde los links no son `<a>` tags, se cae a modo manual (editar `crux-pages.yaml` a mano). El script es best-effort, no crítico.

- **[Risk] La API key podría exceder el quota gratuito (150 QPM).** → Mitigación: el sync se ejecuta manualmente, no en cron. Para 28 sitios × 4 page types × 2 form factors = 224 requests máximo por sync completo, con reintentos solo en fallos transitorios. Muy por debajo del límite. Adicionalmente se implementa exponential backoff en caso de 429.

- **[Risk] CLS es un string decimal, no un número entero como el resto de métricas.** → Mitigación: `p75_value` es `TEXT` en el schema. Las queries analíticas usan `CAST(p75_value AS REAL)` para métricas numéricas y comparan como string para CLS.

## Migration Plan

N/A — feature nuevo, greenfield. No hay datos que migrar ni código existente que modificar.

Para el primer uso:
1. `cp .env.example .env` y agregar `CRUX_API_KEY`
2. `npx tsx scripts/crux-discover.ts` — puebla `engine/crux-pages.yaml`
3. `npx tsx scripts/crux-sync.ts` — primer fetch, crea `data/crux.db` con historial completo
4. Commit de `engine/crux-pages.yaml` y `data/crux.db`

Para syncs subsecuentes:
1. `npx tsx scripts/crux-sync.ts` — solo inserta ventanas nuevas (delta)

Rollback: borrar `data/crux.db` y `engine/crux-pages.yaml`. Sin impacto en el engine o CLI existentes.

## Open Questions

1. **¿Qué API key de Google Cloud usar?** — Se necesita una key con CrUX API habilitada. Si no existe, crearla en GCP Console. La key se almacena en `.env` (no commiteada).
2. **¿Las URLs de PDP son estables?** — Un PDP apunta a un producto específico. Si el producto se descontinúa, la URL muere y CrUX deja de reportarla. ¿Deberíamos rotar PDPs periódicamente o usar la URL de categoría como proxy?
3. **¿Métricas adicionales?** — Además de las 5 de Core Web Vitals, CrUX expone `round_trip_time`, `navigation_types`, `form_factors`, y submétricas de LCP (`largest_contentful_paint_resource_type`, `*_image_*`). ¿Alguna de estas es relevante para el análisis de checkout?
