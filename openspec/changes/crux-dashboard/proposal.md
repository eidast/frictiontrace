## Why

`data/crux.db` tiene 40 semanas de Core Web Vitals para 19 sitios pero solo se consume vía queries SQL ad-hoc. Se necesita una herramienta visual interactiva que permita explorar, comparar y exportar los datos. El dashboard debe ofrecer enfoque ejecutivo (totales) y granular (comparativa por sitio), con D3.js local (sin dependencia de CDN), estados de error descriptivos, presets para consultas frecuentes, y funcionamiento portable en local o contenedor.

## What Changes

- **Servidor thin** `scripts/crux-dashboard.ts` con dos modos: `--serve` (HTTP local en `:3000` con API REST y archivos estáticos) y `--build` (HTML autocontenido con todos los datos embebidos)
- **Activos del dashboard** en `engine/src/crux/`: `dashboard.html`, `dashboard.css`, `dashboard.js`, `d3.v7.min.js` (D3 local, no CDN)
- **API REST** con endpoints: `/api/sites`, `/api/summary`, `/api/compare`, `/api/timeseries`, `/api/export/csv`, `/api/export/json`
- **5 vistas**: Resumen Ejecutivo (adaptativo a métrica), Comparativa por Grupo, Comparativa por Sitio, Tendencia Histórica, Datos
- **Filtros globales**: grupo, sitio(s) multiselect, page type, métrica, form factor, query_level (url/origin/mixed), rango fechas
- **Presets**: "Walmart vs Otros", "Top 5 peores checkouts", "Tendencia 6 meses", "Mobile vs Desktop"
- **Estados vacíos**: mensajes descriptivos para sitios sin datos, filtros sin match, DB faltante, errores de API
- **Exportación global**: botones CSV/JSON siempre visibles en barra superior
- **Etiquetas visuales** `[U]`/`[O]` para distinguir datos a nivel URL vs origin
- **Gráficos D3**: barras, líneas, scatter con tooltips hover y comparación mobile vs desktop

## Capabilities

### New Capabilities

- `crux-dashboard`: servidor thin con API REST + dashboard HTML interactivo con 5 vistas, filtros globales, presets, gráficos D3.js (barras, líneas, scatter), estados vacíos, y exportación global CSV/JSON

### Modified Capabilities

Ninguna.

## Impact

- **Nuevos archivos:** `scripts/crux-dashboard.ts`, `engine/src/crux/dashboard.html`, `engine/src/crux/dashboard.css`, `engine/src/crux/dashboard.js`, `engine/src/crux/d3.v7.min.js`
- **Nuevas dependencias:** ninguna (usa `better-sqlite3` y `node:http` nativos; D3.js se commitea como archivo local)
- **Código existente:** sin cambios. Reutiliza `engine/src/crux/queries.ts` y `engine/src/crux/db.ts`
- **Output:** `reports/crux-dashboard.html` (modo build, en `.gitignore`)
