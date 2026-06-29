# Tasks — crux-dashboard

## 1. D3.js local y estructura de archivos

- [x] 1.1 Crear `engine/src/crux/dashboard.html` con estructura base: sidebar, tabs, barra superior, contenedores de gráficos
- [x] 1.2 Crear `engine/src/crux/dashboard.css` con tema oscuro (`#0d1117`, `#c9d1d9`, `#58a6ff`), layout sidebar 280px, tabs, tooltips, good/ni/poor (`#3fb950`/`#d29922`/`#f85149`)
- [x] 1.3 Crear `engine/src/crux/dashboard.js` esqueleto: sistema de tabs, estado de filtros, fetch/redraw
- [x] 1.4 Implementar descarga de D3: al iniciar `--serve` o `--build`, verificar `engine/src/crux/d3.v7.min.js`, descargar de `https://d3js.org/d3.v7.min.js` si no existe

## 2. Servidor HTTP y modos

- [x] 2.1 Implementar `scripts/crux-dashboard.ts` con entry point que parsea `--serve` vs `--build`
- [x] 2.2 Modo `--serve`: servidor HTTP con `node:http`, servir archivos estáticos desde `engine/src/crux/` (HTML, CSS, JS, D3), rutas `GET /api/*`
- [x] 2.3 Modo `--build`: leer `dashboard.html`/`dashboard.css`/`dashboard.js`/`d3.v7.min.js`, embeber CSS en `<style>`, JS y datos en `<script>`, escribir `reports/crux-dashboard.html`
- [x] 2.4 Manejar graceful shutdown: `SIGINT`/`SIGTERM` cierran `crux.db`
- [x] 2.5 Al iniciar, verificar que `data/crux.db` existe. Si no, mostrar mensaje de error y salir con código 1

## 3. API REST

- [x] 3.1 `GET /api/sites` — devuelve todos los orígenes con label, group_name, country
- [x] 3.2 `GET /api/summary` — params `group?`, `metric`, `ff?`, `dateFrom?`, `dateTo?`, `level?`; devuelve avg_good/p75%, top 5, bottom 5, tabla por grupo
- [x] 3.3 `GET /api/compare` — params `group?`, `sites?`, `metric`, `ff?`, `page?`, `dateFrom?`, `dateTo?`, `level?`; incluye `query_level` en respuesta
- [x] 3.4 `GET /api/timeseries` — params `sites[]`, `metric`, `ff?`, `dateFrom?`, `dateTo?`, `level?`; ordenado por collection_end, incluye `query_level`
- [x] 3.5 `GET /api/export/csv` — Content-Type text/csv, Content-Disposition attachment, filename con fecha
- [x] 3.6 `GET /api/export/json` — Content-Type application/json, Content-Disposition attachment, filename con fecha
- [x] 3.7 Respuestas de error con status 500 y JSON `{error: "mensaje"}`

## 4. Dashboard HTML y CSS

- [x] 4.1 Completar `dashboard.html`: sidebar con 7 filtros, 5 tabs, barra superior con presets + CSV/JSON, contenedores para gráficos/tablas
- [x] 4.2 Completar `dashboard.css`: estilos para sidebar, tabs activos/inactivos, cards de scorecard, tabla de datos, tooltips, scroll en sidebar de sitios
- [x] 4.3 Implementar lógica de tabs en `dashboard.js`: mostrar/ocultar vistas, inicializar vista por defecto

## 5. Filtros globales

- [x] 5.1 Dropdown de grupo: Todos, walmart_propios, walmart_subsidiarias, otros
- [x] 5.2 Multiselect de sitios (checkboxes con scroll), filtrado por grupo seleccionado, poblado desde `/api/sites`
- [x] 5.3 Dropdown de page type: Todos, homepage, checkout, plp, pdp
- [x] 5.4 Dropdown de métrica: LCP, CLS, INP, FCP, TTFB
- [x] 5.5 Dropdown de form factor: Todos, PHONE, DESKTOP
- [x] 5.6 Dropdown de query_level: Todos (mixed), URL, Origin — etiqueta visual `[U]`/`[O]` en datos
- [x] 5.7 Inputs de rango fechas (dateFrom/dateTo), defaults a extremos de `crux_history`
- [x] 5.8 Conectar cambios de filtros a re-fetch (serve) o re-filtrado (build) + redibujado

## 6. Presets

- [x] 6.1 Implementar dropdown de Presets en barra superior
- [x] 6.2 "Walmart vs Otros": group=Todos, metric=LCP, cambiar a vista Comparativa por Grupo
- [x] 6.3 "Top 5 peores checkouts": page=checkout, metric=LCP, ff=PHONE, cambiar a vista Comparativa por Sitio
- [x] 6.4 "Tendencia 6 meses": cambiar a vista Tendencia, dateFrom=-6meses, dateTo=hoy
- [x] 6.5 "Mobile vs Desktop": limpiar filtro FF, cambiar a vista Comparativa por Grupo

## 7. Vistas y gráficos D3.js

- [x] 7.1 Vista Resumen Ejecutivo: scorecards adaptativos (métrica seleccionada o todas), top/bottom 5 tabla, semáforo por grupo
- [x] 7.2 Vista Comparativa por Grupo: barras agrupadas good/ni/poor por grupo, mobile/desktop side-by-side cuando FF=Todos
- [x] 7.3 Vista Comparativa por Sitio: barras agrupadas por sitio + scatter good% vs p75, tooltips con sitio/valores, mobile/desktop
- [x] 7.4 Vista Tendencia Histórica: líneas múltiples con leyenda, eje X=fecha, eje Y=p75, tooltip hover con fecha+valor, sólido/dashed para PHONE/DESKTOP
- [x] 7.5 Vista Datos: tabla HTML filtrable, columnas sortables por click en header, incluye columnas query_level y form_factor
- [x] 7.6 Manejo de CLS: detectar métrica CLS, usar `parseFloat()` para p75_value, escala [0, 1] en eje Y
- [x] 7.7 Manejo de NULLs: omitir puntos con p75_value=NULL en gráficos de líneas (no dibujar, no conectar)

## 8. Estados vacíos

- [x] 8.1 Mensaje para sitio sin datos: overlay en el área de gráficos
- [x] 8.2 Mensaje para filtros sin resultados: overlay en el área de gráficos
- [x] 8.3 Mensaje para crux.db faltante: mostrado por el servidor al iniciar
- [x] 8.4 Mensaje para error de API: toast o banner temporal

## 9. Exportación

- [x] 9.1 Botón CSV en barra superior: descarga vía `/api/export/csv` (serve) o genera Blob en memoria (build)
- [x] 9.2 Botón JSON en barra superior: descarga vía `/api/export/json` (serve) o genera Blob en memoria (build)
- [x] 9.3 Filename incluye fecha: `crux-export-2026-06-29.csv`

## 10. Documentación e integración

- [x] 10.1 Agregar sección "Dashboard" en README.md: `--serve`, `--build`, requisitos
- [x] 10.2 Agregar `reports/crux-dashboard.html` a `.gitignore`
- [x] 10.3 Committear `engine/src/crux/d3.v7.min.js` al repo
