## Context

The CrUX dashboard is a vanilla HTML/CSS/JavaScript interface with D3.js charts. It supports global filters for group, sites, page type, metric, form factor, query level, and date range in both HTTP serve mode and self-contained build mode.

The current UI has three related problems:

- Metric abbreviations are shown without explaining what they measure, their units, or their Good / Needs Improvement / Poor thresholds.
- Chart titles describe the metric but not the aggregation, current scope, or click behavior.
- The grouped bar chart renderer is reused by both group and site views, but its click handler always drills down as a group. This makes the `Métrica por Sitio` chart capable of applying a group filter from a site label.

The sidebar site selector also has visual issues: the HTML uses `sidebar-section` and `checkbox-group`, while CSS targets `.section` and `.site-checkboxes`, so expected spacing and container styling do not apply.

## Goals / Non-Goals

**Goals:**

- Make metric definitions discoverable via hover tooltips.
- Make chart titles and subtitles explain what is being shown and what click interactions do.
- Ensure group charts drill down by group and site charts drill down by site.
- Make the current analysis scope explicit: all sites, one group, one site, or multiple sites.
- Improve the group/site selector visual hierarchy and interaction feedback while keeping the existing vanilla JS architecture.

**Non-Goals:**

- Introduce React, Tailwind, shadcn, Radix, or another UI framework.
- Change backend API contracts or query parameter names.
- Change CrUX metric calculations, thresholds, or data ingestion.
- Redesign the entire dashboard layout beyond the explanatory and selector improvements.

## Decisions

### Use shared metric metadata

Create a single frontend metadata map for each metric containing label, full name, description, unit, and thresholds. Use this map for metric labels, info tooltips, chart subtitles, and hover content.

Alternative considered: hard-code tooltip text at each call site. This was rejected because metric definitions would drift and future copy changes would require edits in many places.

### Add lightweight vanilla tooltip behavior

Use a small reusable tooltip helper and CSS classes for metric/title help instead of introducing a dependency. Tooltips should appear on hover/focus, use existing dark theme colors, and preserve D3 tooltip behavior for chart data.

Alternative considered: rely on native `title` attributes. This was rejected because native tooltips cannot be styled, are delayed inconsistently across browsers, and cannot present threshold data clearly.

### Parameterize chart click behavior

Extend the grouped bar chart renderer to accept a click/drilldown mode or callback. `Grupos` passes group drill-down behavior. `Sitios` passes site drill-down behavior with origin values in chart data.

Alternative considered: duplicate the grouped bar chart implementation for sites. This was rejected because the visual chart behavior is shared and duplication would increase maintenance cost.

### Site drill-down resets group scope

When clicking a site from a chart, the dashboard should select that site and clear the group filter. The active scope becomes `Sitio único`, avoiding ambiguous states such as `group=walmart_propios&sites=some-other-site`.

Alternative considered: keep the current group filter when selecting a site. This was rejected because it is harder to explain and can produce empty or confusing views if a selected site does not belong to the active group.

### Treat the selector fix as UI correctness

Align CSS selectors with actual HTML classes and improve the checkbox group as a polished selector: bordered container, group headers, hover rows, active press feedback, selected counts, and clearer `Todos` / `Ninguno` controls.

Alternative considered: replace the selector with a custom multiselect dropdown. This was rejected for now because the current visible checklist is useful for cross-group comparison and can be improved with less risk.

## Risks / Trade-offs

- Tooltip overlap on small screens → Keep tooltip content concise, constrain width, and position within viewport where practical.
- More explanatory text could visually clutter the dashboard → Use short subtitles and place detailed definitions behind info icons.
- Changing click behavior can surprise users who learned the old behavior → Update tooltip hints and title subtitles so the new behavior is visible before click.
- Shared chart renderer changes could affect both `Grupos` and `Sitios` → Keep the renderer API explicit and verify both views in serve and build modes.
- Selected site counts require keeping checkbox UI and state synchronized → Recompute counts after render, filter changes, and checkbox changes rather than maintaining separate state.
