## ADDED Requirements

### Requirement: Dashboard explanatory UI works in serve and build modes
The dashboard SHALL render metric explanations, chart subtitles, scope summaries, and improved site selector UI consistently in HTTP serve mode and self-contained build mode.

#### Scenario: Serve mode renders explanatory UI
- **WHEN** the user runs the dashboard in serve mode and opens the dashboard
- **THEN** metric explanations, chart subtitles, current-scope summaries, and the improved site selector are available while data is fetched from `/api/*`

#### Scenario: Build mode renders explanatory UI
- **WHEN** the user opens the self-contained built dashboard HTML without the server running
- **THEN** metric explanations, chart subtitles, current-scope summaries, and the improved site selector are available while data is read from embedded `CRUX_DATA`

### Requirement: Sidebar styling matches dashboard markup
The dashboard stylesheet SHALL style the classes and IDs used by the sidebar markup, including sidebar sections and the site checkbox group.

#### Scenario: Sidebar sections have consistent spacing
- **WHEN** the dashboard sidebar renders
- **THEN** each `.sidebar-section` has consistent vertical spacing from adjacent sections

#### Scenario: Site checkbox group receives container styles
- **WHEN** the `#site-checkboxes` element renders with class `checkbox-group`
- **THEN** it receives the intended scrollable container styling, including border, background, padding, radius, and scrollbar styling
