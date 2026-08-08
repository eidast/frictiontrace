## Why

The CrUX dashboard exposes useful group, site, and metric data, but the interface does not explain what users are seeing or what chart clicks will do. This creates confusion around metric abbreviations, chart titles such as `Métrica por Sitio — LCP`, and drill-down behavior where a site chart can behave like a group filter.

## What Changes

- Add explanatory UI for Core Web Vitals metrics, including hover tooltips for LCP, CLS, INP, FCP, and TTFB with definitions, units, and Good / Needs Improvement / Poor thresholds.
- Add chart title help for group, site, scatter, trend, summary, and table views so users understand the current metric, aggregation, and click behavior.
- Fix site-chart drill-down behavior so clicking a site bar filters by that site, while clicking a group bar filters by that group.
- Make hover tooltips describe the exact click action, such as `Click para filtrar este sitio` or `Click para filtrar este grupo`.
- Improve the site/group selector UI so groups and selected sites are easier to scan, select, and understand.
- Show the current analysis scope clearly: all sites, a group, one site, or multiple sites.

## Capabilities

### New Capabilities
- `dashboard-explanatory-ux`: Covers metric definitions, chart title explanations, contextual hover help, analysis scope display, and improved filter-selector clarity.

### Modified Capabilities
- `dashboard-drilldown`: Clarifies and enforces distinct click behavior for group charts vs site charts.
- `crux-dashboard`: Improves global filter usability and explanatory dashboard presentation without changing API contracts.

## Impact

- Affected frontend files: `engine/src/crux/dashboard.html`, `engine/src/crux/dashboard.css`, and `engine/src/crux/dashboard.js`.
- Existing D3 chart rendering and tooltip behavior will be updated but no new external UI library is required.
- API query parameters and backend endpoints remain unchanged.
- The change should work in both serve mode and self-contained build mode.
