## 1. Metric And Scope Metadata

- [x] 1.1 Add shared metric metadata for LCP, CLS, INP, FCP, and TTFB with label, full name, description, unit, and thresholds.
- [x] 1.2 Update metric label/title rendering to use shared metadata instead of duplicated hard-coded labels where practical.
- [x] 1.3 Add a current-scope summary helper that distinguishes all sites, group, one site, and multiple sites.

## 2. Explanatory UI And Tooltips

- [x] 2.1 Add reusable tooltip markup/CSS/JS for metric and title explanations with hover and keyboard-focus support.
- [x] 2.2 Add metric help affordances to the sidebar metric filter and metric-bearing chart titles.
- [x] 2.3 Add chart subtitles explaining aggregation and click behavior for Grupos, Sitios, Scatter, Tendencia, Resumen, and Datos views where applicable.
- [x] 2.4 Update D3 hover tooltip copy so group bars say `Click para filtrar este grupo` and site/scatter marks say `Click para ver solo este sitio`.

## 3. Drill-Down Behavior

- [x] 3.1 Parameterize `drawGroupedBars` so callers can choose group drill-down, site drill-down, or no click behavior.
- [x] 3.2 Update `renderGrupos` to pass group drill-down behavior.
- [x] 3.3 Update `renderSitios` bar chart data to include origin and pass site drill-down behavior.
- [x] 3.4 Update site drill-down to replace previous site selections, clear group filter, update sidebar controls, update active chips, and refresh the view.
- [x] 3.5 Ensure clicking the already-active single site clears the site filter and restores the broader current scope.

## 4. Site Group Selector Polish

- [x] 4.1 Fix sidebar CSS selector mismatches so `.sidebar-section` and `.checkbox-group` receive intended styling.
- [x] 4.2 Replace inline styles in dynamic site checkbox rendering with stable CSS classes.
- [x] 4.3 Add group header visual hierarchy and selected/total counts.
- [x] 4.4 Add hover and active press feedback for site rows without interfering with checkbox state.
- [x] 4.5 Make select-all and clear controls visually cohesive with the sidebar selector.

## 5. Verification

- [x] 5.1 Verify serve mode: metric tooltips, chart subtitles, scope summary, group click, site bar click, scatter click, and site selector styling.
- [x] 5.2 Verify build mode: generated self-contained dashboard retains explanatory UI and drill-down behavior.
- [x] 5.3 Run available automated checks for TypeScript/tests and record any unrelated failures.
