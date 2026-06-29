## Why

FrictionTrace mide fricción sintética en e-commerce, pero no tiene referencia de cómo esos sitios se comportan con usuarios reales. Google CrUX expone datos públicos de Core Web Vitals (LCP, CLS, INP, TTFB, FCP) a nivel URL y origen con hasta 40 semanas (~10 meses) de historial vía la History API (`queryHistoryRecord`). Integrar estos datos permite comparar el rendimiento real entre los 28 sitios del benchmark (Walmart, subsidiarias, competidores), con foco en las páginas de checkout donde la fricción tiene mayor impacto en conversión.

## What Changes

- **Nuevo archivo de configuración** `engine/crux-pages.yaml` que define los 28 sitios del benchmark con sus URLs por tipo de página (homepage, checkout, PLP, PDP)
- **Script de descubrimiento** `scripts/crux-discover.ts` que usa Playwright para navegar cada sitio y extraer las URLs reales de checkout, PLP y PDP
- **Script de sincronización** `scripts/crux-sync.ts` que consulta la CrUX History API (`queryHistoryRecord`) para cada URL definida, descompone las timeseries en filas individuales por período de colección, con soporte de delta (solo inserta ventanas nuevas) y fallback a nivel origen si una URL no tiene suficiente tráfico
- **Base de datos SQLite** `data/crux.db` versionada en el repositorio con schema de 4 tablas: `crux_origins`, `crux_queries`, `crux_collections`, `crux_history`
- **Campo de procedencia** `source` y `query_level` en cada registro para distinguir datos externos no controlados (`crux_google`) y el nivel de granularidad (`origin` vs `url`)
- **Nuevo módulo** `engine/src/crux/` con funciones para consultar `data/crux.db` desde el analyzer (uso futuro en reportes comparativos)

## Capabilities

### New Capabilities

- `crux-discovery`: navegación automatizada con Playwright para descubrir URLs reales de checkout, PLP y PDP en cada sitio del benchmark, persistiendo los resultados en `engine/crux-pages.yaml`
- `crux-sync`: consulta a la CrUX API de Google, deduplicación por ventana de colección, fallback origin/URL, y persistencia en SQLite con marcado de procedencia
- `crux-storage`: schema SQLite (`data/crux.db`) con tablas para orígenes, consultas, colecciones e historial, diseñado para consultas analíticas cross-site con distinción de nivel y fuente de datos

### Modified Capabilities

Ninguna — este es un feature nuevo que agrega datos de referencia externa. El engine, analyzer y CLI existentes no se modifican.

## Impact

- **Nuevos archivos:** `engine/crux-pages.yaml`, `engine/src/crux/`, `scripts/crux-discover.ts`, `scripts/crux-sync.ts`, `data/crux.db`
- **Nuevas dependencias:** ninguna (usa Playwright y better-sqlite3 ya existentes; la CrUX API se consume vía `fetch` nativo de Node.js)
- **Código existente:** sin cambios. El módulo `crux` es autocontenido y se integrará al analyzer en un change futuro
- **API externa:** Google Chrome UX Report API (`chromeuxreport.googleapis.com`), gratuita, ~150 QPM, sin autenticación para datos públicos (requiere API key)
- **Repo:** `data/crux.db` se versiona (~2-3 MB para 28 sitios × 4 page types × 40 semanas de historia)
