// Inline hidden-class style (not in dashboard.css)
(function () {
  if (document.getElementById('_crux_hidden_style')) return;
  var s = document.createElement('style');
  s.id = '_crux_hidden_style';
  s.textContent = '.hidden { display: none !important; }';
  document.head.appendChild(s);
})();

// ── State ────────────────────────────────────────────────────────────────

const state = {
  group: '',
  sites: [],
  pageType: '',
  metric: 'largest_contentful_paint',
  formFactor: '',
  queryLevel: '',
  dateFrom: '',
  dateTo: '',
  activeTab: 'resumen',
  mode: 'serve',
  sitesList: [],
  meta: null,
};

// ── Helpers ──────────────────────────────────────────────────────────────

var METRIC_METADATA = {
  largest_contentful_paint: {
    label: 'LCP',
    fullName: 'Largest Contentful Paint',
    description: 'Mide cuanto tarda en renderizarse el contenido principal visible.',
    unit: 'milliseconds',
    thresholds: { good: '<= 2.5s', ni: '<= 4.0s', poor: '> 4.0s' },
    type: 'histogram',
    category: 'core',
    categoryLabel: 'Core Web Vitals'
  },
  cumulative_layout_shift: {
    label: 'CLS',
    fullName: 'Cumulative Layout Shift',
    description: 'Mide la estabilidad visual y cuanto se mueve el layout inesperadamente.',
    unit: 'score',
    thresholds: { good: '<= 0.10', ni: '<= 0.25', poor: '> 0.25' },
    type: 'histogram',
    category: 'core',
    categoryLabel: 'Core Web Vitals'
  },
  interaction_to_next_paint: {
    label: 'INP',
    fullName: 'Interaction to Next Paint',
    description: 'Mide la capacidad de respuesta despues de interacciones del usuario.',
    unit: 'milliseconds',
    thresholds: { good: '<= 200ms', ni: '<= 500ms', poor: '> 500ms' },
    type: 'histogram',
    category: 'core',
    categoryLabel: 'Core Web Vitals'
  },
  first_contentful_paint: {
    label: 'FCP',
    fullName: 'First Contentful Paint',
    description: 'Mide cuanto tarda en aparecer el primer contenido en pantalla.',
    unit: 'milliseconds',
    thresholds: { good: '<= 1.8s', ni: '<= 3.0s', poor: '> 3.0s' },
    type: 'histogram',
    category: 'core',
    categoryLabel: 'Core Web Vitals'
  },
  experimental_time_to_first_byte: {
    label: 'TTFB',
    fullName: 'Time to First Byte',
    description: 'Mide cuanto tarda el servidor en responder con el primer byte.',
    unit: 'milliseconds',
    thresholds: { good: '<= 800ms', ni: '<= 1.8s', poor: '> 1.8s' },
    type: 'histogram',
    category: 'core',
    categoryLabel: 'Core Web Vitals'
  },
  largest_contentful_paint_resource_type: {
    label: 'LCP Res. Type',
    fullName: 'LCP Resource Type',
    description: 'Tipo de recurso responsable del LCP: texto, imagen o video.',
    unit: 'percentage',
    thresholds: null,
    type: 'fraction',
    category: 'lcp_diag',
    categoryLabel: 'LCP Diagnostics'
  },
  largest_contentful_paint_image_time_to_first_byte: {
    label: 'LCP Img TTFB',
    fullName: 'LCP Image TTFB',
    description: 'Subparte: tiempo hasta el primer byte de la imagen LCP.',
    unit: 'milliseconds',
    thresholds: { good: '<= 800ms', ni: '<= 1800ms', poor: '> 1800ms' },
    type: 'histogram',
    category: 'lcp_diag',
    categoryLabel: 'LCP Diagnostics'
  },
  largest_contentful_paint_image_resource_load_delay: {
    label: 'LCP Load Delay',
    fullName: 'LCP Image Resource Load Delay',
    description: 'Subparte: retraso antes de iniciar la carga de la imagen LCP.',
    unit: 'milliseconds',
    thresholds: null,
    type: 'histogram',
    category: 'lcp_diag',
    categoryLabel: 'LCP Diagnostics'
  },
  largest_contentful_paint_image_resource_load_duration: {
    label: 'LCP Load Dur.',
    fullName: 'LCP Image Resource Load Duration',
    description: 'Subparte: duración de la carga de la imagen LCP.',
    unit: 'milliseconds',
    thresholds: null,
    type: 'histogram',
    category: 'lcp_diag',
    categoryLabel: 'LCP Diagnostics'
  },
  largest_contentful_paint_image_element_render_delay: {
    label: 'LCP Render Delay',
    fullName: 'LCP Image Element Render Delay',
    description: 'Subparte: retraso en el renderizado del elemento LCP.',
    unit: 'milliseconds',
    thresholds: null,
    type: 'histogram',
    category: 'lcp_diag',
    categoryLabel: 'LCP Diagnostics'
  },
  round_trip_time: {
    label: 'RTT',
    fullName: 'Round Trip Time',
    description: 'Tiempo estimado de ida y vuelta de red de los usuarios.',
    unit: 'milliseconds',
    thresholds: { good: '<= 200ms', ni: '<= 500ms', poor: '> 500ms' },
    type: 'histogram',
    category: 'other',
    categoryLabel: 'Other'
  },
  navigation_types: {
    label: 'Nav Types',
    fullName: 'Navigation Types',
    description: 'Distribución de tipos de navegación: cache, reload, bfcache, etc.',
    unit: 'percentage',
    thresholds: null,
    type: 'fraction',
    category: 'other',
    categoryLabel: 'Other'
  },
  form_factors: {
    label: 'Form Factors',
    fullName: 'Form Factors Distribution',
    description: 'Distribución de visitas por tipo de dispositivo: phone, desktop, tablet.',
    unit: 'percentage',
    thresholds: null,
    type: 'fraction',
    category: 'other',
    categoryLabel: 'Other'
  }
};

var metricCategories = [
  { key: 'core', label: 'Core Web Vitals' },
  { key: 'lcp_diag', label: 'LCP Diagnostics' },
  { key: 'other', label: 'Other' }
];

var FRACTION_METRICS_LIST = ['largest_contentful_paint_resource_type', 'navigation_types', 'form_factors'];

function isFractionMetric(metricName) {
  return FRACTION_METRICS_LIST.indexOf(metricName) !== -1;
}

function formatPct(val) {
  if (val == null || isNaN(val)) return 'N/A';
  return (val * 100).toFixed(1) + '%';
}

function formatP75(val, metric) {
  if (val == null || val === '') return 'N/A';
  const n = metric === 'cumulative_layout_shift' ? parseFloat(val) : Number(val);
  if (isNaN(n)) return 'N/A';
  if (metric === 'cumulative_layout_shift') return n.toFixed(3);
  if (n >= 1000) return (n / 1000).toFixed(1) + 's';
  return n.toFixed(0) + 'ms';
}

function ymd(date) {
  const d = new Date(date);
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

function monthsAgo(n) {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return ymd(d);
}

function normSelect(val) {
  return val === 'Todos' ? '' : val;
}

function normLevel(val) {
  if (!val || val === 'Todos') return '';
  return val.toLowerCase();
}

function tagLevel(level) {
  if (!level) return '';
  return level === 'url' ? '[U]' : '[O]';
}

function getScopeSummary(input) {
  var current = input || state;
  var sites = current.sites || [];
  if (sites.length === 1) {
    return { label: 'Sitio único', value: sites[0] };
  }
  if (sites.length > 1) {
    return { label: 'Sitios seleccionados', value: sites.length + ' sitios' };
  }
  if (current.group) {
    return { label: 'Grupo', value: current.group };
  }
  return { label: 'Todos los sitios', value: '' };
}

function metricTooltipHtml(metricName) {
  var meta = METRIC_METADATA[metricName || state.metric || 'largest_contentful_paint'];
  if (!meta) return '';
  var thresholds = meta.thresholds
    ? '<div><span>Good:</span> ' + meta.thresholds.good + '</div>' +
      '<div><span>Needs Improvement:</span> ' + meta.thresholds.ni + '</div>' +
      '<div><span>Poor:</span> ' + meta.thresholds.poor + '</div>'
    : '<div><span>Thresholds:</span> No aplica para métricas fraccionales</div>';
  return '<strong>' + meta.label + ' — ' + meta.fullName + '</strong>' +
    '<p>' + meta.description + '</p>' +
    '<div><span>Unidad:</span> ' + meta.unit + '</div>' +
    thresholds;
}

function makeInfoButton(metricName, label) {
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'info-tip';
  btn.setAttribute('aria-label', label || 'Ver explicación');
  btn.dataset.tooltipHtml = metricTooltipHtml(metricName);
  btn.textContent = 'i';
  return btn;
}

function renderScopeSummary() {
  var el = document.getElementById('scope-summary');
  if (!el) return;
  var scope = getScopeSummary();
  var metric = METRIC_METADATA[state.metric || 'largest_contentful_paint'];
  var parts = [];
  if (scope.value) parts.push(scope.value);
  if (metric) parts.push(metric.label);
  if (state.formFactor) parts.push(state.formFactor);
  if (state.queryLevel) parts.push(state.queryLevel.toUpperCase());
  el.innerHTML = '';
  var label = document.createElement('span');
  label.className = 'scope-label';
  label.textContent = 'Analizando: ' + scope.label;
  el.appendChild(label);
  if (parts.length) {
    var value = document.createElement('span');
    value.className = 'scope-value';
    value.textContent = parts.join(' · ');
    el.appendChild(value);
  }
}

function setPanelHeading(container, title, subtitle, metricName) {
  if (!container) return;
  var titleEl = container.querySelector('.panel-title');
  if (!titleEl) return;
  titleEl.textContent = title;
  if (metricName) titleEl.appendChild(makeInfoButton(metricName, 'Explicar ' + metricLabel(metricName)));

  var subtitleEl = container.querySelector('.panel-subtitle');
  if (!subtitleEl) {
    subtitleEl = document.createElement('p');
    subtitleEl.className = 'panel-subtitle';
    titleEl.insertAdjacentElement('afterend', subtitleEl);
  }
  subtitleEl.textContent = subtitle || '';
}

function initInfoTooltips() {
  var tooltip = document.getElementById('info-tooltip');
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.id = 'info-tooltip';
    tooltip.className = 'info-tooltip hidden';
    document.body.appendChild(tooltip);
  }

  function show(target) {
    var html = target && target.dataset ? target.dataset.tooltipHtml : '';
    if (!html) return;
    tooltip.innerHTML = html;
    tooltip.classList.remove('hidden');
    var rect = target.getBoundingClientRect();
    var left = Math.min(window.innerWidth - tooltip.offsetWidth - 12, rect.left);
    tooltip.style.left = Math.max(12, left) + 'px';
    tooltip.style.top = (rect.bottom + 8) + 'px';
  }

  function hide() {
    tooltip.classList.add('hidden');
  }

  document.addEventListener('mouseover', function (event) {
    if (event.target && event.target.classList && event.target.classList.contains('info-tip')) show(event.target);
  });
  document.addEventListener('focusin', function (event) {
    if (event.target && event.target.classList && event.target.classList.contains('info-tip')) show(event.target);
  });
  document.addEventListener('mouseout', function (event) {
    if (event.target && event.target.classList && event.target.classList.contains('info-tip')) hide();
  });
  document.addEventListener('focusout', function (event) {
    if (event.target && event.target.classList && event.target.classList.contains('info-tip')) hide();
  });
}

// ── Mode Detection ───────────────────────────────────────────────────────

function setMode() {
  state.mode = (window.CRUX_DATA && typeof window.CRUX_DATA === 'object')
    ? 'build'
    : 'serve';
}

// ── Core: Init ───────────────────────────────────────────────────────────

async function init() {
  setMode();
  initInfoTooltips();
  await loadSites();
  await loadMeta();
  bindFilters();
  bindTabs();
  bindPresets();
  bindDatePresets();
  bindExport();
  bindSiteSearch();
  bindReset();
  activateTabUi(state.activeTab);
  await applyFilters();
}

function bindTabs() {
  document.querySelectorAll('.tab-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      switchTab(btn.dataset.tab);
    });
  });
}

function activateTabUi(tabName) {
  document.querySelectorAll('.tab-btn').forEach(function (btn) {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  document.querySelectorAll('.tab-content').forEach(function (tc) {
    tc.classList.remove('active');
  });

  var target = document.getElementById('tab-' + tabName);
  if (target) target.classList.add('active');
}

function bindFilters() {
  var grupo = document.getElementById('filter-grupo');
  if (grupo) {
    grupo.addEventListener('change', function () {
      state.group = normSelect(this.value);
      filterSiteCheckboxes();
      applyFilters();
    });
  }

  var pageType = document.getElementById('filter-page-type');
  if (pageType) {
    pageType.addEventListener('change', function () {
      state.pageType = normSelect(this.value);
      applyFilters();
    });
  }

  var metric = document.getElementById('filter-metric');
  if (metric) {
    metric.addEventListener('change', function () {
      state.metric = this.value;
      if (isFractionMetric(state.metric) && ['resumen', 'grupos', 'sitios', 'tendencia'].indexOf(state.activeTab) !== -1) {
        switchTab('desglose');
        return;
      }
      applyFilters();
    });
  }

  var ff = document.getElementById('filter-form-factor');
  if (ff) {
    ff.addEventListener('change', function () {
      state.formFactor = normSelect(this.value);
      applyFilters();
    });
  }

  var nivel = document.getElementById('filter-nivel');
  if (nivel) {
    nivel.addEventListener('change', function () {
      state.queryLevel = normLevel(this.value);
      applyFilters();
    });
  }

  var dateFrom = document.getElementById('dateFrom');
  if (dateFrom) {
    dateFrom.addEventListener('change', function () {
      state.dateFrom = this.value;
      applyFilters();
    });
  }

  var dateTo = document.getElementById('dateTo');
  if (dateTo) {
    dateTo.addEventListener('change', function () {
      state.dateTo = this.value;
      applyFilters();
    });
  }

  // Site checkboxes delegated
  var cbContainer = document.getElementById('site-checkboxes');
  if (cbContainer) {
    cbContainer.addEventListener('change', function (e) {
      if (e.target && e.target.type === 'checkbox') {
        updateSelectedSites();
        applyFilters();
      }
    });
  }
}

function updateSelectedSites() {
  var checked = document.querySelectorAll('#site-checkboxes input[type="checkbox"]:checked');
  state.sites = [];
  checked.forEach(function (cb) {
    state.sites.push(cb.value);
  });
  updateSiteGroupCounts();
}

function bindPresets() {
  var preset = document.getElementById('preset-select');
  if (!preset) return;

  var options = [
    { value: '', label: '-- Seleccionar preset --' },
    { value: 'walmart-vs-otros', label: 'Walmart vs Otros' },
    { value: 'top5-checkouts', label: 'Top 5 peores checkouts' },
    { value: 'tendencia-6m', label: 'Tendencia 6 meses' },
    { value: 'mobile-vs-desktop', label: 'Mobile vs Desktop' }
  ];

  preset.innerHTML = '';
  options.forEach(function (opt) {
    var el = document.createElement('option');
    el.value = opt.value;
    el.textContent = opt.label;
    preset.appendChild(el);
  });

  preset.addEventListener('change', function () {
    if (!this.value) return;
    applyPreset(this.value);
    this.value = '';
  });
}

function bindDatePresets() {
  var buttons = document.querySelectorAll('.date-preset-btn');
  buttons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var months = parseInt(this.dataset.months, 10);
      setDatePreset(months);
    });
  });
}

function setDatePreset(n) {
  if (n > 0) {
    state.dateFrom = monthsAgo(n);
    state.dateTo = ymd(new Date());
  } else {
    state.dateFrom = '';
    state.dateTo = '';
  }

  var df = document.getElementById('dateFrom');
  var dt = document.getElementById('dateTo');
  if (df) df.value = state.dateFrom;
  if (dt) dt.value = state.dateTo;

  updateDatePresetHighlight();
  applyFilters();
}

function updateDatePresetHighlight() {
  var buttons = document.querySelectorAll('.date-preset-btn');
  var activeMonths = 0;
  if (state.dateFrom && state.dateTo) {
    var from = new Date(state.dateFrom);
    var to = new Date(state.dateTo);
    var diffMonths = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
    var today = ymd(new Date());
    if (state.dateTo === today && [1, 2, 4, 6].indexOf(diffMonths) !== -1) {
      activeMonths = diffMonths;
    }
  }

  buttons.forEach(function (btn) {
    var months = parseInt(btn.dataset.months, 10);
    if (activeMonths > 0 && months === activeMonths) {
      btn.classList.add('active');
    } else if (activeMonths === 0 && months === 0 && !state.dateFrom) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

function renderActiveFilters() {
  var container = document.getElementById('active-filters');
  if (!container) return;
  container.innerHTML = '';

  var chips = [];

  if (state.group) {
    chips.push({ type: 'group', label: 'Grupo', value: state.group });
  }
  if (state.sites.length === 1) {
    chips.push({ type: 'sites', label: 'Sitio', value: state.sites[0] });
  } else if (state.sites.length > 1) {
    chips.push({ type: 'sites', label: 'Sitios', value: state.sites.length + ' sitios' });
  }
  if (state.pageType) {
    chips.push({ type: 'pageType', label: 'Page', value: state.pageType });
  }
  if (state.metric && state.metric !== 'largest_contentful_paint') {
    chips.push({ type: 'metric', label: 'Métrica', value: metricLabel(state.metric) });
  }
  if (state.formFactor) {
    chips.push({ type: 'formFactor', label: 'FF', value: state.formFactor });
  }
  if (state.queryLevel) {
    chips.push({ type: 'queryLevel', label: 'Nivel', value: state.queryLevel });
  }
  if (state.dateFrom || state.dateTo) {
    var dateLabel = 'Fechas';
    var dateValue = (state.dateFrom || 'inicio') + ' – ' + (state.dateTo || 'hoy');
    chips.push({ type: 'dateRange', label: dateLabel, value: dateValue });
  }

  chips.forEach(function (chip) {
    var el = document.createElement('span');
    el.className = 'filter-chip';
    el.innerHTML = '<span class="chip-label">' + chip.label + ':</span> ' + chip.value +
      '<button class="chip-remove" data-filter="' + chip.type + '">&times;</button>';

    el.querySelector('.chip-remove').addEventListener('click', function () {
      removeFilter(chip.type);
    });

    container.appendChild(el);
  });
}

function removeFilter(type) {
  switch (type) {
    case 'group':
      state.group = '';
      updateFilterUI({ group: '' });
      break;
    case 'sites':
      state.sites = [];
      var checkboxes = document.querySelectorAll('#site-checkboxes input[type="checkbox"]');
      checkboxes.forEach(function (cb) { cb.checked = false; });
      break;
    case 'pageType':
      state.pageType = '';
      updateFilterUI({ pageType: '' });
      break;
    case 'metric':
      state.metric = 'largest_contentful_paint';
      updateFilterUI({ metric: 'largest_contentful_paint' });
      break;
    case 'formFactor':
      state.formFactor = '';
      updateFilterUI({ formFactor: '' });
      break;
    case 'queryLevel':
      state.queryLevel = '';
      updateFilterUI({ queryLevel: '' });
      break;
    case 'dateRange':
      state.dateFrom = '';
      state.dateTo = '';
      var df = document.getElementById('dateFrom');
      var dt = document.getElementById('dateTo');
      if (df) df.value = '';
      if (dt) dt.value = '';
      updateDatePresetHighlight();
      break;
  }
  applyFilters();
}

function applyPreset(key) {
  resetAllFilters();

  switch (key) {
    case 'walmart-vs-otros':
      state.metric = 'largest_contentful_paint';
      updateFilterUI({ metric: 'largest_contentful_paint' });
      switchTab('grupos');
      break;
    case 'top5-checkouts':
      state.pageType = 'checkout';
      state.metric = 'largest_contentful_paint';
      state.formFactor = 'PHONE';
      updateFilterUI({ pageType: 'checkout', metric: 'largest_contentful_paint', formFactor: 'PHONE' });
      switchTab('sitios');
      break;
    case 'tendencia-6m':
      state.dateFrom = monthsAgo(6);
      state.dateTo = ymd(new Date());
      var df = document.getElementById('dateFrom');
      var dt = document.getElementById('dateTo');
      if (df) df.value = state.dateFrom;
      if (dt) dt.value = state.dateTo;
      switchTab('tendencia');
      break;
    case 'mobile-vs-desktop':
      state.formFactor = '';
      updateFilterUI({ formFactor: '' });
      switchTab('grupos');
      break;
  }
}

function resetAllFilters() {
  state.group = '';
  state.sites = [];
  state.pageType = '';
  state.metric = 'largest_contentful_paint';
  state.formFactor = '';
  state.queryLevel = '';
  state.dateFrom = '';
  state.dateTo = '';

  updateFilterUI({
    group: '',
    metric: 'largest_contentful_paint',
    formFactor: '',
    pageType: '',
    queryLevel: ''
  });

  var df = document.getElementById('dateFrom');
  var dt = document.getElementById('dateTo');
  if (df) df.value = '';
  if (dt) dt.value = '';

  var checkboxes = document.querySelectorAll('#site-checkboxes input[type="checkbox"]');
  checkboxes.forEach(function (cb) { cb.checked = false; });
  filterSiteCheckboxes();
}

function updateFilterUI(vals) {
  if (vals.group !== undefined) {
    var g = document.getElementById('filter-grupo');
    if (g) g.value = vals.group || 'Todos';
  }
  if (vals.metric !== undefined) {
    var m = document.getElementById('filter-metric');
    if (m) m.value = vals.metric;
  }
  if (vals.formFactor !== undefined) {
    var f = document.getElementById('filter-form-factor');
    if (f) f.value = vals.formFactor || 'Todos';
  }
  if (vals.pageType !== undefined) {
    var p = document.getElementById('filter-page-type');
    if (p) p.value = vals.pageType || 'Todos';
  }
  if (vals.queryLevel !== undefined) {
    var l = document.getElementById('filter-nivel');
    if (l) l.value = vals.queryLevel || 'Todos';
  }
}

function updateMetricHelp() {
  var help = document.getElementById('metric-help');
  if (!help) return;
  var metric = state.metric || 'largest_contentful_paint';
  help.dataset.tooltipHtml = metricTooltipHtml(metric);
  help.setAttribute('aria-label', 'Explicar ' + metricLabel(metric));
}

function bindExport() {
  var csvBtn = document.getElementById('btn-export-csv');
  var jsonBtn = document.getElementById('btn-export-json');

  if (csvBtn) {
    csvBtn.addEventListener('click', function () { exportData('csv'); });
  }
  if (jsonBtn) {
    jsonBtn.addEventListener('click', function () { exportData('json'); });
  }
}

function bindSiteSearch() {
  var search = document.getElementById('site-search');
  if (search) {
    search.addEventListener('input', function () {
      var query = this.value.toLowerCase();
      var labels = document.querySelectorAll('#site-checkboxes label');
      labels.forEach(function (label) {
        var text = (label.textContent || '').toLowerCase();
        var cb = label.querySelector('input[type="checkbox"]');
        var groupOk = !state.group || (cb && cb.dataset.group === state.group);
        label.style.display = groupOk && text.indexOf(query) !== -1 ? 'flex' : 'none';
      });
      updateSiteGroupHeaderVisibility();
      updateSiteGroupCounts();
    });
  }

  var btnAll = document.getElementById('btn-sites-all');
  var btnNone = document.getElementById('btn-sites-none');
  if (btnAll) {
    btnAll.addEventListener('click', function () {
      var checkboxes = document.querySelectorAll('#site-checkboxes input[type="checkbox"]');
      checkboxes.forEach(function (cb) {
        var label = cb.parentElement;
        if (label && label.style.display !== 'none') cb.checked = true;
      });
      updateSelectedSites();
      applyFilters();
    });
  }
  if (btnNone) {
    btnNone.addEventListener('click', function () {
      var checkboxes = document.querySelectorAll('#site-checkboxes input[type="checkbox"]');
      checkboxes.forEach(function (cb) { cb.checked = false; });
      updateSelectedSites();
      applyFilters();
    });
  }
}

function bindReset() {
  var btn = document.getElementById('btn-reset-filters');
  if (btn) {
    btn.addEventListener('click', function () {
      resetAllFilters();
      switchTab('resumen');
      applyFilters();
    });
  }
}

// ── Core: Sites ──────────────────────────────────────────────────────────

async function loadSites() {
  var sites;
  if (state.mode === 'serve') {
    try {
      var resp = await fetch('/api/sites');
      if (!resp.ok) throw new Error('Failed to load sites');
      var json = await resp.json();
      sites = Array.isArray(json) ? json : (json.sites || []);
    } catch (e) {
      showError('No se pudieron cargar los sitios: ' + e.message);
      return;
    }
  } else {
    sites = (window.CRUX_DATA && window.CRUX_DATA.sites) ? window.CRUX_DATA.sites : [];
  }

  state.sitesList = sites;
  renderSiteCheckboxes(sites);
}

async function loadMeta() {
  if (state.mode === 'serve') {
    try {
      var resp = await fetch('/api/meta');
      if (resp.ok) {
        state.meta = await resp.json();
      }
    } catch (e) {
      // silent fail
    }
  } else {
    var cd = window.CRUX_DATA;
    if (cd && cd.dateRange) {
      var snapshot = cd.snapshot || [];
      var urlCount = 0;
      var originCount = 0;
      snapshot.forEach(function (r) {
        if (r.query_level === 'url') urlCount++;
        else if (r.query_level === 'origin') originCount++;
      });
      var total = urlCount + originCount;
      var origins = cd.origins || [];
      var sitesWithData = {};
      snapshot.forEach(function (r) { sitesWithData[r.origin] = true; });
      state.meta = {
        max_date: cd.dateRange.max_date || null,
        url_pct: total > 0 ? (urlCount / total * 100).toFixed(1) : 0,
        origin_pct: total > 0 ? (originCount / total * 100).toFixed(1) : 0,
        period_count: 'N/A',
        sites_with_data: Object.keys(sitesWithData).length,
        total_sites: origins.length
      };
    }
  }
  renderFreshness();
}

function renderFreshness() {
  var topbar = document.getElementById('topbar');
  if (!topbar) return;
  var el = document.getElementById('data-freshness');
  if (!el) {
    el = document.createElement('span');
    el.id = 'data-freshness';
    el.style.cssText = 'font-size:11px;color:#8b949e;margin-left:16px;';
    var title = topbar.querySelector('.topbar-title');
    if (title) title.parentNode.insertBefore(el, title.nextSibling);
  }
  if (state.meta && state.meta.max_date) {
    el.textContent = 'Datos al ' + state.meta.max_date;
  } else {
    el.textContent = '';
  }
}

function renderCoverage() {
  var container = document.getElementById('exec-coverage');
  if (!container) return;
  container.innerHTML = '';

  if (!state.meta) return;

  var html = '<h2 class="panel-title">Cobertura</h2><div class="panel-body">';
  html += '<div style="font-size:13px;">';
  if (state.meta.period_count !== 'N/A') {
    html += '<div>Períodos disponibles: <strong>' + state.meta.period_count + '</strong></div>';
  }
  html += '<div>Nivel URL: <strong>' + state.meta.url_pct + '%</strong> | Nivel Origin: <strong>' + state.meta.origin_pct + '%</strong></div>';
  html += '<div>Sitios con datos: <strong>' + state.meta.sites_with_data + ' / ' + state.meta.total_sites + '</strong></div>';
  html += '</div></div>';
  container.innerHTML = html;
}

function renderSiteCheckboxes(sites) {
  var container = document.getElementById('site-checkboxes');
  if (!container) return;
  container.innerHTML = '';

  var grouped = {};
  sites.forEach(function (site) {
    var g = site.group_name || site.group || 'otros';
    if (!grouped[g]) grouped[g] = [];
    grouped[g].push(site);
  });

  var groupOrder = ['walmart_propios', 'walmart_subsidiarias', 'otros'];

  groupOrder.forEach(function (group) {
    var groupSites = grouped[group];
    if (!groupSites || groupSites.length === 0) return;

    var header = createSiteGroupHeader(group, groupSites.length);
    container.appendChild(header);

    groupSites.forEach(function (site) {
      var label = document.createElement('label');
      label.className = 'checkbox-row';

      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = site.origin;
      cb.dataset.group = group;
      cb.dataset.label = site.label || site.origin;

      label.appendChild(cb);
      var text = document.createElement('span');
      text.className = 'checkbox-label';
      text.textContent = site.label || site.origin;
      label.appendChild(text);
      container.appendChild(label);
    });
  });

  // Check any remaining groups not in groupOrder
  Object.keys(grouped).forEach(function (group) {
    if (groupOrder.indexOf(group) !== -1) return;
    var groupSites = grouped[group];

    var header = createSiteGroupHeader(group, groupSites.length);
    container.appendChild(header);

    groupSites.forEach(function (site) {
      var label = document.createElement('label');
      label.className = 'checkbox-row';

      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = site.origin;
      cb.dataset.group = group;
      cb.dataset.label = site.label || site.origin;

      label.appendChild(cb);
      var text = document.createElement('span');
      text.className = 'checkbox-label';
      text.textContent = site.label || site.origin;
      label.appendChild(text);
      container.appendChild(label);
    });
  });

  updateSiteGroupCounts();
}

function createSiteGroupHeader(group, total) {
  var header = document.createElement('div');
  header.className = 'checkbox-group-header';
  header.dataset.group = group;
  var name = document.createElement('span');
  name.textContent = group;
  var count = document.createElement('span');
  count.className = 'checkbox-group-count';
  count.textContent = '0/' + total;
  header.appendChild(name);
  header.appendChild(count);
  return header;
}

function updateSiteGroupCounts() {
  var headers = document.querySelectorAll('#site-checkboxes .checkbox-group-header');
  headers.forEach(function (header) {
    var group = header.dataset.group;
    var boxes = document.querySelectorAll('#site-checkboxes input[type="checkbox"][data-group="' + group + '"]');
    var selected = 0;
    var visible = 0;
    boxes.forEach(function (cb) {
      var row = cb.parentElement;
      if (!row || row.style.display !== 'none') visible++;
      if (cb.checked) selected++;
    });
    var count = header.querySelector('.checkbox-group-count');
    if (count) count.textContent = selected + '/' + visible;
  });
}

function filterSiteCheckboxes() {
  var checkboxes = document.querySelectorAll('#site-checkboxes input[type="checkbox"]');
  checkboxes.forEach(function (cb) {
    var label = cb.parentElement;
    if (!label) return;
    if (!state.group || cb.dataset.group === state.group) {
      label.style.display = 'flex';
    } else {
      label.style.display = 'none';
    }
  });

  updateSiteGroupHeaderVisibility();
  updateSiteGroupCounts();
}

function updateSiteGroupHeaderVisibility() {
  var headers = document.querySelectorAll('#site-checkboxes .checkbox-group-header');
  headers.forEach(function (header) {
    var next = header.nextElementSibling;
    var visible = false;
    var el = next;
    while (el) {
      if (el.classList && el.classList.contains('checkbox-group-header')) break;
      if (el.style.display !== 'none') { visible = true; break; }
      el = el.nextElementSibling;
    }
    header.style.display = visible ? '' : 'none';
  });
}

// ── Core: Tabs ───────────────────────────────────────────────────────────

function switchTab(tabName) {
  state.activeTab = tabName;
  activateTabUi(tabName);

  applyFilters();
}

// ── Core: Filter Params ──────────────────────────────────────────────────

function getFilterParams() {
  var params = new URLSearchParams();
  if (state.group) params.set('group', state.group);
  if (state.sites.length > 0) params.set('sites', state.sites.join(','));
  if (state.pageType) params.set('page', state.pageType);
  if (state.metric) params.set('metric', state.metric);
  if (state.formFactor) params.set('ff', state.formFactor);
  if (state.queryLevel) params.set('level', state.queryLevel);
  if (state.dateFrom) params.set('dateFrom', state.dateFrom);
  if (state.dateTo) params.set('dateTo', state.dateTo);
  return '?' + params.toString();
}

// ── Core: Apply Filters & Fetch ──────────────────────────────────────────

function showLoading() {
  var main = document.getElementById('main');
  if (!main) return;
  var overlay = document.getElementById('loading-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'loading-overlay';
    overlay.className = 'loading-overlay';
    overlay.innerHTML = '<div class="loading-spinner"></div>';
    main.appendChild(overlay);
  }
  overlay.classList.add('show');
}

function hideLoading() {
  var overlay = document.getElementById('loading-overlay');
  if (overlay) overlay.classList.remove('show');
}

async function applyFilters() {
  hideEmptyStates();
  stateToUrl();
  updateMetricHelp();

  if (state.mode === 'serve') {
    showLoading();
    var endpoint = getEndpointForTab();
    var data = await fetchData(endpoint);
    hideLoading();
    if (data === null) return;
    renderCurrentView(data);
  } else {
    var data = getFilteredBuildData();
    renderCurrentView(data);
  }

  renderActiveFilters();
  renderScopeSummary();
  updateDatePresetHighlight();
}

function getEndpointForTab() {
  if (state.activeTab === 'datos' && isFractionMetric(state.metric)) return '/api/fractions';
  var map = {
    resumen: '/api/summary',
    grupos: '/api/compare',
    sitios: '/api/compare',
    tendencia: '/api/timeseries',
    comparativa: '/api/compare-grid',
    desglose: '/api/fractions',
    datos: '/api/compare'
  };
  return map[state.activeTab] || '/api/compare';
}

// ── URL State ────────────────────────────────────────────────────────────

function stateToUrl() {
  var params = new URLSearchParams();
  if (state.group) params.set('group', state.group);
  if (state.sites.length > 0 && state.sites.length <= 10) params.set('sites', state.sites.join(','));
  if (state.pageType) params.set('page', state.pageType);
  if (state.metric && state.metric !== 'largest_contentful_paint') params.set('metric', state.metric);
  if (state.formFactor) params.set('ff', state.formFactor);
  if (state.queryLevel) params.set('level', state.queryLevel);
  if (state.dateFrom) params.set('dateFrom', state.dateFrom);
  if (state.dateTo) params.set('dateTo', state.dateTo);
  if (state.activeTab !== 'resumen') params.set('tab', state.activeTab);

  var qs = params.toString();
  var url = window.location.pathname + (qs ? '?' + qs : '');
  history.replaceState(null, '', url);
}

function urlToState() {
  var params = new URLSearchParams(window.location.search);

  if (params.get('group')) state.group = params.get('group');
  var sitesParam = params.get('sites');
  if (sitesParam) state.sites = sitesParam.split(',').filter(Boolean);
  if (params.get('page')) state.pageType = params.get('page');
  if (params.get('metric')) state.metric = params.get('metric');
  if (params.get('ff')) state.formFactor = params.get('ff');
  if (params.get('level')) state.queryLevel = params.get('level');
  if (params.get('dateFrom')) state.dateFrom = params.get('dateFrom');
  if (params.get('dateTo')) state.dateTo = params.get('dateTo');
  if (params.get('tab')) state.activeTab = params.get('tab');

  syncFilterUI();
}

function syncFilterUI() {
  updateFilterUI({
    group: state.group || '',
    metric: state.metric || 'largest_contentful_paint',
    formFactor: state.formFactor || '',
    pageType: state.pageType || '',
    queryLevel: state.queryLevel || ''
  });

  var df = document.getElementById('dateFrom');
  var dt = document.getElementById('dateTo');
  if (df) df.value = state.dateFrom;
  if (dt) dt.value = state.dateTo;

  var checkboxes = document.querySelectorAll('#site-checkboxes input[type="checkbox"]');
  checkboxes.forEach(function (cb) {
    cb.checked = state.sites.indexOf(cb.value) !== -1;
  });
  filterSiteCheckboxes();
}

async function fetchData(endpoint) {
  try {
    var url = endpoint + getFilterParams();
    var resp = await fetch(url);
    if (!resp.ok) {
      if (resp.status === 404) {
        showEmptyState('db-missing');
        return null;
      }
      throw new Error(resp.status + ' ' + resp.statusText);
    }
    return await resp.json();
  } catch (e) {
    showError('Error al obtener datos: ' + e.message);
    return null;
  }
}

// ── Core: Render Current View ────────────────────────────────────────────

function renderCurrentView(data) {
  switch (state.activeTab) {
    case 'resumen': renderResumen(data); break;
    case 'grupos': renderGrupos(data); break;
    case 'sitios': renderSitios(data); break;
    case 'tendencia': renderTendencia(data); break;
    case 'comparativa': renderComparativa(data); break;
    case 'desglose': renderDesglose(data); break;
    case 'datos': renderDatos(data); break;
  }
}

// ── Empty State / Errors ─────────────────────────────────────────────────

function showEmptyState(type) {
  hideEmptyStates();
  var el;
  switch (type) {
    case 'no-site': el = document.getElementById('empty-no-site'); break;
    case 'no-match': el = document.getElementById('empty-no-match'); break;
    case 'db-missing': el = document.getElementById('empty-db-missing'); break;
    default: return;
  }
  if (el) el.classList.remove('hidden');
}

function hideEmptyStates() {
  var ids = ['empty-no-site', 'empty-no-match', 'empty-db-missing'];
  ids.forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });
}

function showError(msg) {
  var toast = document.getElementById('error-toast');
  var msgEl = document.getElementById('toast-message');
  if (!toast || !msgEl) return;
  msgEl.textContent = msg;
  toast.classList.remove('hidden');

  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(function () {
    toast.classList.add('hidden');
  }, 5000);

  var closeBtn = toast.querySelector('.toast-close');
  if (closeBtn) {
    closeBtn.onclick = function () {
      toast.classList.add('hidden');
      clearTimeout(toast._timeout);
    };
  }
}

// ── Export ───────────────────────────────────────────────────────────────

async function exportData(format) {
  var dateStr = ymd(new Date());
  var filename = 'crux-export-' + dateStr + '.' + format;

  var meta = buildExportMeta();

  if (state.mode === 'serve') {
    try {
      var url = '/api/export/' + format + getFilterParams();
      var resp = await fetch(url);
      if (!resp.ok) throw new Error(resp.statusText);
      var blob = await resp.blob();
      downloadBlob(blob, filename);
    } catch (e) {
      showError('Error al exportar: ' + e.message);
    }
  } else {
    var data = getFilteredBuildData();
    var rows = Array.isArray(data) ? data : (data.rows || data.series || []);
    var content, mime;
    if (format === 'csv') {
      content = buildMetaCSV(meta) + toCSV(rows);
      mime = 'text/csv;charset=utf-8;';
    } else {
      content = JSON.stringify({ _metadata: meta, data: rows }, null, 2);
      mime = 'application/json;charset=utf-8;';
    }
    var blob = new Blob([content], { type: mime });
    downloadBlob(blob, filename);
  }
}

function buildExportMeta() {
  return {
    exported_at: new Date().toISOString(),
    filters: {
      metric: state.metric || 'largest_contentful_paint',
      group: state.group || null,
      sites: state.sites.length > 0 ? state.sites : null,
      page_type: state.pageType || null,
      form_factor: state.formFactor || null,
      query_level: state.queryLevel || null,
      date_from: state.dateFrom || null,
      date_to: state.dateTo || null
    },
    source: state.mode === 'build' ? 'static build' : 'crux.db'
  };
}

function buildMetaCSV(meta) {
  var lines = [
    '# CrUX Dashboard Export',
    '# Date: ' + meta.exported_at.slice(0, 10),
    '# Source: ' + meta.source
  ];
  var f = meta.filters;
  if (f.metric) lines.push('# Metric: ' + f.metric);
  if (f.group) lines.push('# Group: ' + f.group);
  if (f.sites) lines.push('# Sites: ' + f.sites.join(', '));
  if (f.page_type) lines.push('# Page type: ' + f.page_type);
  if (f.form_factor) lines.push('# Form factor: ' + f.form_factor);
  if (f.date_from) lines.push('# Date from: ' + f.date_from);
  if (f.date_to) lines.push('# Date to: ' + f.date_to);
  lines.push('#');
  return lines.join('\n') + '\n';
}

function downloadBlob(blob, filename) {
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function toCSV(data) {
  var rows = Array.isArray(data) ? data : (data.rows || data.series || []);
  if (rows.length === 0) return '';

  var columns = Object.keys(rows[0]);
  var header = columns.join(',');
  var body = rows.map(function (row) {
    return columns.map(function (col) {
      var val = row[col];
      if (val == null) return '';
      var str = String(val);
      if (str.indexOf(',') !== -1 || str.indexOf('"') !== -1 || str.indexOf('\n') !== -1) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    }).join(',');
  }).join('\n');

  return header + '\n' + body;
}

// ── View: Resumen ────────────────────────────────────────────────────────

function renderResumen(data) {
  if (isFractionMetric(state.metric)) {
    switchTab('desglose');
    return;
  }

  var snapshot = getSnapshotRows(data);

  if (!snapshot || snapshot.length === 0) {
    showEmptyState('no-match');
    return;
  }

  var metric = state.metric || 'largest_contentful_paint';
  var filtered = snapshot.filter(function (r) {
    return r.metric_name === metric;
  });

  if (state.formFactor) {
    filtered = filtered.filter(function (r) { return r.form_factor === state.formFactor; });
  }

  // Scorecards
  renderScorecards(filtered);

  // Top 5 / Bottom 5
  renderTopBottom5(filtered);

  // Health semáforo
  renderHealth(filtered);
  renderCoverage();
}

function getSnapshotRows(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (data.rows) return data.rows;
  if (data.snapshot) return data.snapshot;
  return [];
}

function renderScorecards(rows) {
  var container = document.getElementById('exec-scorecards');
  if (!container) return;
  container.innerHTML = '';

  var groups = {};
  rows.forEach(function (r) {
    var ff = r.form_factor;
    if (!groups[ff]) {
      groups[ff] = { count: 0, sumP75: 0, sumGood: 0, sumNi: 0, sumPoor: 0, p75Values: [] };
    }
    groups[ff].count++;
    var p75 = state.metric === 'cumulative_layout_shift' ? parseFloat(r.p75_value) : Number(r.p75_value);
    if (!isNaN(p75)) {
      groups[ff].sumP75 += p75;
      groups[ff].p75Values.push(p75);
    }
    if (r.good_pct != null) groups[ff].sumGood += r.good_pct;
    if (r.ni_pct != null) groups[ff].sumNi += r.ni_pct;
    if (r.poor_pct != null) groups[ff].sumPoor += r.poor_pct;
  });

  var ffOrder = state.formFactor ? [state.formFactor] : ['PHONE', 'DESKTOP'];

  ffOrder.forEach(function (ff) {
    var g = groups[ff];
    if (!g || g.count === 0) return;

    var avgP75 = g.sumP75 / g.p75Values.length;
    var avgGood = g.sumGood / g.count;
    var avgNi = g.sumNi / g.count;
    var avgPoor = g.sumPoor / g.count;

    var card = document.createElement('div');
    card.className = 'scorecard';
    card.style.cssText = 'background:#161b22;border:1px solid #30363d;border-radius:8px;padding:16px;flex:1;text-align:center;';

    var metric = state.metric || 'largest_contentful_paint';
    var thresholds = CWV_THRESHOLDS[metric];
    var trendArrow = '';
    if (thresholds) {
      if (avgP75 <= thresholds.good) {
        trendArrow = ' <span style="color:#3fb950;">▼</span>';
      } else if (avgP75 <= thresholds.ni) {
        trendArrow = ' <span style="color:#d29922;">→</span>';
      } else {
        trendArrow = ' <span style="color:#f85149;">▲</span>';
      }
    }

    card.innerHTML =
      '<div style="font-size:11px;text-transform:uppercase;color:#8b949e;">' + ff + ' — ' + metricLabel(metric) + '</div>' +
      '<div style="font-size:28px;font-weight:700;margin-top:4px;">' + formatP75(String(avgP75), state.metric) + trendArrow + '</div>' +
      '<div style="margin-top:8px;display:flex;gap:8px;justify-content:center;">' +
        '<span style="color:#3fb950;font-size:13px;">' + formatPct(avgGood) + ' G</span>' +
        '<span style="color:#d29922;font-size:13px;">' + formatPct(avgNi) + ' NI</span>' +
        '<span style="color:#f85149;font-size:13px;">' + formatPct(avgPoor) + ' P</span>' +
      '</div>';

    container.appendChild(card);
  });
}

function renderTopBottom5(rows) {
  var top5 = document.getElementById('exec-top5');
  var bottom5 = document.getElementById('exec-bottom5');

  // Only show one set of these per FF if no specific FF selected
  var ffFilter = state.formFactor || 'PHONE';
  var filtered = rows.filter(function (r) { return r.form_factor === ffFilter; });

  var sorted = filtered.slice().sort(function (a, b) {
    var aVal = state.metric === 'cumulative_layout_shift' ? parseFloat(a.p75_value) : Number(a.p75_value);
    var bVal = state.metric === 'cumulative_layout_shift' ? parseFloat(b.p75_value) : Number(b.p75_value);
    if (isNaN(aVal)) aVal = Infinity;
    if (isNaN(bVal)) bVal = Infinity;
    return aVal - bVal;
  });

  var headerHTML =
    '<span style="font-size:11px;text-transform:uppercase;color:#8b949e;">Sitio</span> ' +
    '<span style="font-size:11px;text-transform:uppercase;color:#8b949e;margin-left:auto;">p75 / Good%</span>';

  function makeList(items) {
    var html = '';
    items.forEach(function (item) {
      var label = item.label || item.origin || '';
      html += '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #30363d;font-size:13px;">' +
        '<span>' + label + '</span>' +
        '<span>' + formatP75(item.p75_value, state.metric) + ' / ' + formatPct(item.good_pct) + '</span>' +
        '</div>';
    });
    return html;
  }

  if (top5) {
    top5.innerHTML = '';
    var top5Div = document.createElement('h2');
    top5Div.className = 'panel-title';
    top5Div.textContent = 'Top 5 (' + ffFilter + ')';
    top5.appendChild(top5Div);
    var topSub = document.createElement('p');
    topSub.className = 'panel-subtitle';
    topSub.textContent = 'Sitios con mejor p75 para ' + metricLabel(state.metric || 'largest_contentful_paint') + ' en el scope actual.';
    top5.appendChild(topSub);

    var body = document.createElement('div');
    body.className = 'panel-body';
    body.innerHTML = makeList(sorted.slice(0, 5));
    top5.appendChild(body);
  }

  if (bottom5) {
    bottom5.innerHTML = '';
    var bot5Div = document.createElement('h2');
    bot5Div.className = 'panel-title';
    bot5Div.textContent = 'Bottom 5 (' + ffFilter + ')';
    bottom5.appendChild(bot5Div);
    var bottomSub = document.createElement('p');
    bottomSub.className = 'panel-subtitle';
    bottomSub.textContent = 'Sitios con peor p75 para ' + metricLabel(state.metric || 'largest_contentful_paint') + ' en el scope actual.';
    bottom5.appendChild(bottomSub);

    var body2 = document.createElement('div');
    body2.className = 'panel-body';
    var bottom = sorted.slice().reverse().slice(0, 5);
    body2.innerHTML = makeList(bottom);
    bottom5.appendChild(body2);
  }
}

function renderHealth(rows) {
  var container = document.getElementById('exec-health');
  if (!container) return;
  container.innerHTML = '';

  var h2 = document.createElement('h2');
  h2.className = 'panel-title';
  h2.textContent = 'Health';
  container.appendChild(h2);
  var subtitle = document.createElement('p');
  subtitle.className = 'panel-subtitle';
  subtitle.textContent = 'Distribución Good, Needs Improvement y Poor para ' + metricLabel(state.metric || 'largest_contentful_paint') + ' por sitio.';
  container.appendChild(subtitle);

  var body = document.createElement('div');
  body.className = 'panel-body';

  var sites = {};
  rows.forEach(function (r) {
    var key = r.origin + '|' + r.form_factor;
    if (!sites[key]) {
      sites[key] = { origin: r.origin, label: r.label, group_name: r.group_name, form_factor: r.form_factor, good: null, ni: null, poor: null, p75: null };
    }
    if (r.metric_name === state.metric) {
      sites[key].good = r.good_pct;
      sites[key].ni = r.ni_pct;
      sites[key].poor = r.poor_pct;
      sites[key].p75 = r.p75_value;
    }
  });

  var list = Object.values(sites);
  var html = '';
  list.forEach(function (s) {
    var good = s.good != null ? s.good : 0;
    var ni = s.ni != null ? s.ni : 0;
    var poor = s.poor != null ? s.poor : 0;
    var total = good + ni + poor;
    var goodW = total > 0 ? (good / total * 100).toFixed(1) : '0';
    var niW = total > 0 ? (ni / total * 100).toFixed(1) : '0';
    var poorW = total > 0 ? (poor / total * 100).toFixed(1) : '0';

    html += '<div style="display:flex;align-items:center;padding:6px 0;border-bottom:1px solid #30363d;font-size:13px;">' +
      '<span style="width:200px;flex-shrink:0;">' + (s.label || s.origin) + ' <span style="color:#8b949e;font-size:11px;">' + s.form_factor + '</span></span>' +
      '<div style="flex:1;height:14px;background:#21262d;border-radius:3px;overflow:hidden;display:flex;margin:0 12px;">' +
        (goodW > 0 ? '<div style="width:' + goodW + '%;background:#3fb950;" title="Good: ' + formatPct(good) + '"></div>' : '') +
        (niW > 0 ? '<div style="width:' + niW + '%;background:#d29922;" title="NI: ' + formatPct(ni) + '"></div>' : '') +
        (poorW > 0 ? '<div style="width:' + poorW + '%;background:#f85149;" title="Poor: ' + formatPct(poor) + '"></div>' : '') +
      '</div>' +
      '<span style="width:80px;text-align:right;flex-shrink:0;">' + formatP75(s.p75, state.metric) + '</span>' +
      '</div>';
  });

  body.innerHTML = html;
  container.appendChild(body);
}

// ── View: Grupos ─────────────────────────────────────────────────────────

function renderGrupos(data) {
  var container = document.getElementById('chart-groups');
  if (!container) return;

  var chartBody = container.querySelector('.chart-body');
  if (!chartBody) return;

  var rows = getSnapshotRows(data);
  if (!rows || rows.length === 0) {
    showEmptyState('no-match');
    return;
  }

  var metric = state.metric || 'largest_contentful_paint';

  var filtered = rows.filter(function (r) {
    return r.metric_name === metric;
  });

  // Aggregate by group + form_factor
  var agg = {};
  filtered.forEach(function (r) {
    var key = r.group_name + '|' + r.form_factor;
    if (!agg[key]) {
      agg[key] = { group_name: r.group_name, form_factor: r.form_factor, totalGood: 0, totalNi: 0, totalPoor: 0, count: 0 };
    }
    if (r.good_pct != null) agg[key].totalGood += r.good_pct;
    if (r.ni_pct != null) agg[key].totalNi += r.ni_pct;
    if (r.poor_pct != null) agg[key].totalPoor += r.poor_pct;
    agg[key].count++;
  });

  var chartData = Object.values(agg).map(function (a) {
    return {
      label: a.group_name,
      form_factor: a.form_factor,
      good_pct: a.count > 0 ? a.totalGood / a.count : 0,
      ni_pct: a.count > 0 ? a.totalNi / a.count : 0,
      poor_pct: a.count > 0 ? a.totalPoor / a.count : 0
    };
  });

  if (chartData.length === 0) {
    showEmptyState('no-match');
    return;
  }

  var titleEl = container.querySelector('.panel-title');
  if (titleEl) {
    setPanelHeading(
      container,
      'Comparación por Grupo — ' + metricLabel(metric),
      'Promedio de experiencias Good, Needs Improvement y Poor por grupo. Click en una barra para filtrar ese grupo.',
      metric
    );
  }

  if (!state.metric) {
    var infoEl = document.createElement('div');
    infoEl.style.cssText = 'font-size:12px;color:#d29922;margin-bottom:12px;';
    infoEl.textContent = 'Mostrando LCP por defecto. Seleccioná una métrica en el filtro para ver comparativas específicas.';
    chartBody.insertBefore(infoEl, chartBody.firstChild);
  }

  drawGroupedBars(chartBody, chartData, {
    drilldownDimension: 'group',
    getDrilldownValue: function (d) { return d.group_name || d.label; },
    clickHint: 'Click para filtrar este grupo'
  });
}

// ── View: Sitios ─────────────────────────────────────────────────────────

function renderSitios(data) {
  var rows = getSnapshotRows(data);
  if (!rows || rows.length === 0) {
    showEmptyState('no-match');
    return;
  }

  var metric = state.metric || 'largest_contentful_paint';

  var filtered = rows.filter(function (r) {
    return r.metric_name === metric;
  });
  if (state.formFactor) {
    filtered = filtered.filter(function (r) { return r.form_factor === state.formFactor; });
  }

  // Bar chart: top 15 by p75 (worst first)
  var barContainer = document.getElementById('chart-sites-bars');
  if (barContainer) {
    var barBody = barContainer.querySelector('.chart-body');
    if (barBody) {
      setPanelHeading(
        barContainer,
        'Métrica por Sitio — ' + metricLabel(metric),
        'Distribución de experiencias Good, Needs Improvement y Poor por sitio. Click en una barra para ver solo ese sitio.',
        metric
      );

      var sorted = filtered.slice().sort(function (a, b) {
        var aVal = metric === 'cumulative_layout_shift' ? parseFloat(a.p75_value) : Number(a.p75_value);
        var bVal = metric === 'cumulative_layout_shift' ? parseFloat(b.p75_value) : Number(b.p75_value);
        if (isNaN(aVal)) aVal = 0;
        if (isNaN(bVal)) bVal = 0;
        return bVal - aVal;
      }).slice(0, 15);

      var chartData = sorted.map(function (r) {
        return {
          label: r.label || r.origin,
          origin: r.origin,
          form_factor: r.form_factor,
          good_pct: r.good_pct || 0,
          ni_pct: r.ni_pct || 0,
          poor_pct: r.poor_pct || 0
        };
      });

      if (!state.metric) {
        var infoEl = document.createElement('div');
        infoEl.style.cssText = 'font-size:12px;color:#d29922;margin-bottom:12px;';
        infoEl.textContent = 'Mostrando LCP por defecto. Seleccioná una métrica en el filtro para ver comparativas específicas.';
        barBody.appendChild(infoEl);
      }

      drawGroupedBars(barBody, chartData, {
        drilldownDimension: 'sites',
        getDrilldownValue: function (d) { return d.origin; },
        clickHint: 'Click para ver solo este sitio'
      });
    }
  }

  // Scatter plot
  var scatterContainer = document.getElementById('chart-sites-scatter');
  if (scatterContainer) {
    var scatterBody = scatterContainer.querySelector('.chart-body');
    if (scatterBody) {
      setPanelHeading(
        scatterContainer,
        'Distribución Good% vs p75 — ' + metricLabel(metric),
        'Cada punto representa un sitio y form factor. Click en un punto para ver solo ese sitio.',
        metric
      );

      drawScatter(scatterBody, filtered, {});
    }
  }
}

// ── View: Tendencia ──────────────────────────────────────────────────────

function renderTendencia(data) {
  var container = document.getElementById('chart-timeseries');
  if (!container) return;

  var chartBody = container.querySelector('.chart-body');
  if (!chartBody) return;

  var rawSeries = getSeriesData(data);
  if (!rawSeries || rawSeries.length === 0) {
    showEmptyState('no-match');
    return;
  }

  var series = groupTimeseries(rawSeries);

  var trendMetric = state.metric || 'largest_contentful_paint';
  setPanelHeading(
    container,
    'Tendencia de ' + metricLabel(trendMetric) + ' en el tiempo',
    'Evolución del p75 para el scope seleccionado.',
    trendMetric
  );

  drawLineChart(chartBody, series, {});
}

function getSeriesData(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (data.series) return data.series;
  return [];
}

function groupTimeseries(rows) {
  var series = {};
  rows.forEach(function (r) {
    var key = r.origin + '|' + r.form_factor;
    if (!series[key]) {
      series[key] = {
        origin: r.origin,
        label: r.label || r.origin,
        form_factor: r.form_factor,
        points: []
      };
    }
    series[key].points.push(r);
  });

  return Object.values(series);
}

// ── View: Comparativa ────────────────────────────────────────────────────

function renderComparativa(data) {
  var container = document.getElementById('comparison-grid');
  var empty = document.getElementById('empty-comparativa');
  if (!container) return;

  container.innerHTML = '';
  if (empty) empty.classList.add('hidden');

  if (!state.sites || state.sites.length < 2) {
    if (empty) empty.classList.remove('hidden');
    return;
  }

  var metric = state.metric || 'largest_contentful_paint';
  var meta = METRIC_METADATA[metric] || METRIC_METADATA.largest_contentful_paint;
  var rows = getCompareGridRows(data);
  var fractions = data && data.fractions ? data.fractions : [];

  var selectedSites = state.sites.map(function (origin) {
    var site = state.sitesList.find(function (s) { return s.origin === origin; });
    return { origin: origin, label: site ? site.label : origin };
  });

  var table = document.createElement('table');
  table.className = 'compare-grid';

  var thead = document.createElement('thead');
  var trHead = document.createElement('tr');
  trHead.innerHTML = '<th>Métrica</th>' + selectedSites.map(function (s) { return '<th>' + s.label + '</th>'; }).join('');
  thead.appendChild(trHead);
  table.appendChild(thead);

  var tbody = document.createElement('tbody');
  var groupTr = document.createElement('tr');
  groupTr.className = 'metric-group-header';
  groupTr.innerHTML = '<td colspan="' + (selectedSites.length + 1) + '">' + (meta.categoryLabel || 'Metric') + '</td>';
  tbody.appendChild(groupTr);

  var tr = document.createElement('tr');
  var labelCell = document.createElement('td');
  labelCell.className = 'metric-row-label';
  labelCell.textContent = meta.label;
  labelCell.title = 'Click para ver tendencia';
  labelCell.addEventListener('click', function () {
    updateFilterUI({ metric: metric });
    switchTab('tendencia');
  });
  tr.appendChild(labelCell);

  selectedSites.forEach(function (site) {
    var td = document.createElement('td');
    if (isFractionMetric(metric)) {
      renderFractionCompareCell(td, fractions, site.origin, metric);
    } else {
      var siteRows = rows.filter(function (r) { return r.origin === site.origin && r.metric_name === metric; });
      renderHistogramCompareCell(td, siteRows, metric);
    }
    tr.appendChild(td);
  });

  tbody.appendChild(tr);
  table.appendChild(tbody);
  container.appendChild(table);
}

function getCompareGridRows(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (data.metrics && data.metrics[0] && Array.isArray(data.metrics[0].data)) return data.metrics[0].data;
  if (data.snapshot) return data.snapshot;
  return [];
}

function renderHistogramCompareCell(td, rows, metric) {
  if (!rows || rows.length === 0) {
    td.className = 'cell-na';
    td.textContent = '—';
    return;
  }

  var sorted = rows.slice().sort(function (a, b) { return String(a.collection_end).localeCompare(String(b.collection_end)); });
  var latest = sorted[sorted.length - 1];
  var prev = sorted[sorted.length - 2];
  var p75 = metric === 'cumulative_layout_shift' ? parseFloat(latest.p75_value) : Number(latest.p75_value);

  td.className = cellClassForMetric(metric, p75);
  td.innerHTML = '<div><span class="cell-value">' + formatP75(latest.p75_value, metric) + '</span>' + trendIndicator(prev, latest, metric) + '</div>' +
    '<div class="cell-distribution"><span class="dist-good">' + formatPct(latest.good_pct) + '</span><span class="dist-ni">' + formatPct(latest.ni_pct) + '</span><span class="dist-poor">' + formatPct(latest.poor_pct) + '</span></div>' +
    '<span class="sparkline-container"></span>';

  drawSparkline(td.querySelector('.sparkline-container'), sorted, metric);
}

function renderFractionCompareCell(td, rows, origin, metric) {
  var latestDate = null;
  rows.forEach(function (r) {
    if (r.origin === origin && r.metric_name === metric && (!latestDate || r.collection_end > latestDate)) latestDate = r.collection_end;
  });
  var latestRows = rows.filter(function (r) { return r.origin === origin && r.metric_name === metric && r.collection_end === latestDate; });
  if (!latestRows.length) {
    td.className = 'cell-na';
    td.textContent = '—';
    return;
  }
  latestRows.sort(function (a, b) { return b.fraction_value - a.fraction_value; });
  td.className = 'cell-neutral';
  td.innerHTML = latestRows.slice(0, 3).map(function (r) {
    return '<div><span class="cell-value">' + r.category + '</span> ' + formatPct(r.fraction_value) + '</div>';
  }).join('');
}

function cellClassForMetric(metric, value) {
  var thresholds = CWV_THRESHOLDS[metric];
  if (!thresholds || isNaN(value)) return 'cell-neutral';
  if (value <= thresholds.good) return 'cell-good';
  if (value <= thresholds.ni) return 'cell-ni';
  return 'cell-poor';
}

function trendIndicator(prev, latest, metric) {
  if (!prev || !latest) return '<span class="cell-trend-stable">→</span>';
  var a = metric === 'cumulative_layout_shift' ? parseFloat(prev.p75_value) : Number(prev.p75_value);
  var b = metric === 'cumulative_layout_shift' ? parseFloat(latest.p75_value) : Number(latest.p75_value);
  if (!a || isNaN(a) || isNaN(b)) return '<span class="cell-trend-stable">→</span>';
  var diff = (b - a) / a;
  if (diff < -0.05) return '<span class="cell-trend-down">▼</span>';
  if (diff > 0.05) return '<span class="cell-trend-up">▲</span>';
  return '<span class="cell-trend-stable">→</span>';
}

function drawSparkline(container, rows, metric) {
  if (!container || !rows || rows.length < 2 || typeof d3 === 'undefined') return;
  var points = rows.slice(-4).map(function (r) {
    return metric === 'cumulative_layout_shift' ? parseFloat(r.p75_value) : Number(r.p75_value);
  }).filter(function (v) { return !isNaN(v); });
  if (points.length < 2) return;
  var width = 60;
  var height = 20;
  var x = d3.scaleLinear().domain([0, points.length - 1]).range([0, width]);
  var y = d3.scaleLinear().domain(d3.extent(points)).range([height - 2, 2]);
  var line = d3.line().x(function (_, i) { return x(i); }).y(function (d) { return y(d); });
  d3.select(container).append('svg').attr('width', width).attr('height', height)
    .append('path').datum(points).attr('d', line).attr('fill', 'none').attr('stroke', '#8b949e').attr('stroke-width', 1.5);
}

// ── View: Desglose ───────────────────────────────────────────────────────

function renderDesglose(data) {
  var fractionRows = Array.isArray(data) ? data : (data && data.fractions ? data.fractions : []);
  var metric = isFractionMetric(state.metric) ? state.metric : 'largest_contentful_paint_resource_type';
  var containers = {
    largest_contentful_paint_resource_type: document.getElementById('chart-lcp-resource-type'),
    navigation_types: document.getElementById('chart-navigation-types'),
    form_factors: document.getElementById('chart-form-factors-frac')
  };

  Object.keys(containers).forEach(function (key) {
    var container = containers[key];
    if (!container) return;
    container.style.display = key === metric ? '' : 'none';
  });

  var active = containers[metric];
  if (!active) return;
  var body = active.querySelector('.chart-body');
  if (!body) return;
  var title = active.querySelector('.panel-title');
  if (title) title.textContent = (METRIC_METADATA[metric] || {}).fullName || metric;

  var rows = fractionRows.filter(function (r) { return r.metric_name === metric; });
  if (!rows.length) {
    body.innerHTML = '<div class="empty-state">No hay datos fraccionales para los filtros seleccionados.</div>';
    return;
  }

  drawStackedBars(body, rows, { metric: metric });
}

function drawStackedBars(container, rows, config) {
  container.innerHTML = '';
  if (!rows || rows.length === 0 || typeof d3 === 'undefined') return;

  var metric = config.metric;
  var latestByOrigin = {};
  rows.forEach(function (r) {
    var key = r.origin;
    if (!latestByOrigin[key] || r.collection_end > latestByOrigin[key]) latestByOrigin[key] = r.collection_end;
  });

  var grouped = {};
  rows.forEach(function (r) {
    if (r.collection_end !== latestByOrigin[r.origin]) return;
    var key = r.origin;
    if (!grouped[key]) grouped[key] = { origin: r.origin, label: r.label || r.origin, categories: {} };
    grouped[key].categories[r.category] = r.fraction_value || 0;
  });

  var data = Object.values(grouped);
  if (!data.length) return;

  var categories = Array.from(new Set(rows.map(function (r) { return r.category; })));
  var width = 820;
  var height = Math.max(220, data.length * 42 + 80);
  var margin = { top: 20, right: 160, bottom: 40, left: 180 };
  var innerW = width - margin.left - margin.right;
  var innerH = height - margin.top - margin.bottom;

  var svg = d3.select(container).append('svg').attr('width', width).attr('height', height)
    .append('g').attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

  var y = d3.scaleBand().domain(data.map(function (d) { return d.label; })).range([0, innerH]).padding(0.25);
  var x = d3.scaleLinear().domain([0, 1]).range([0, innerW]);
  var color = categoryColorScale(metric, categories);

  var tip = d3.select('body').append('div').attr('class', 'd3-tooltip').style('opacity', 0).style('z-index', '9999');

  data.forEach(function (d) {
    var offset = 0;
    categories.forEach(function (cat) {
      var value = d.categories[cat] || 0;
      if (value <= 0) return;
      svg.append('rect')
        .attr('x', x(offset))
        .attr('y', y(d.label))
        .attr('width', x(value))
        .attr('height', y.bandwidth())
        .attr('fill', color(cat))
        .on('mouseover', function (event) {
          tip.transition().duration(150).style('opacity', 1);
          tip.html('<div>' + d.label + '</div><div>' + cat + ': ' + formatPct(value) + '</div>')
            .style('left', (event.pageX + 12) + 'px')
            .style('top', (event.pageY - 28) + 'px');
        })
        .on('mouseout', function () { tip.transition().duration(200).style('opacity', 0); });
      offset += value;
    });
  });

  svg.append('g').call(d3.axisLeft(y)).style('color', '#8b949e').style('font-size', '11px');
  svg.append('g').attr('transform', 'translate(0,' + innerH + ')').call(d3.axisBottom(x).ticks(5, '.0%')).style('color', '#8b949e').style('font-size', '11px');
  svg.selectAll('.domain').style('stroke', '#30363d');
  svg.selectAll('.tick line').style('stroke', '#30363d');

  var legend = svg.append('g').attr('transform', 'translate(' + (innerW + 20) + ',0)');
  categories.forEach(function (cat, i) {
    var g = legend.append('g').attr('transform', 'translate(0,' + (i * 20) + ')');
    g.append('rect').attr('width', 12).attr('height', 12).attr('fill', color(cat));
    g.append('text').attr('x', 18).attr('y', 10).text(cat).style('fill', '#8b949e').style('font-size', '11px');
  });
}

function categoryColorScale(metric, categories) {
  var palettes = {
    largest_contentful_paint_resource_type: { text: '#58a6ff', image: '#3fb950', video: '#d29922' },
    navigation_types: {
      navigate: '#58a6ff', navigate_cache: '#3fb950', reload: '#d29922', restore: '#f85149',
      back_forward: '#bc8cff', back_forward_cache: '#79c0ff', prerender: '#ffa657'
    },
    form_factors: { phone: '#58a6ff', desktop: '#3fb950', tablet: '#d29922' }
  };
  var map = palettes[metric] || {};
  var fallback = d3.scaleOrdinal().domain(categories).range(['#58a6ff', '#3fb950', '#d29922', '#f85149', '#bc8cff', '#79c0ff', '#ffa657']);
  return function (cat) { return map[cat] || fallback(cat); };
}

// ── View: Datos ──────────────────────────────────────────────────────────

function renderDatos(data) {
  var rows = getSnapshotRows(data);
  var table = document.getElementById('data-table');
  if (!table) return;

  var panel = table.closest ? table.closest('.panel') : null;
  setPanelHeading(
    panel,
    'Datos Crudos',
    'Tabla filtrada por el scope actual. Click en encabezados para ordenar.',
    state.metric || 'largest_contentful_paint'
  );

  var thead = table.querySelector('thead');
  var tbody = table.querySelector('tbody');
  if (!thead || !tbody) return;

  if (!rows || rows.length === 0) {
    thead.innerHTML = '';
    tbody.innerHTML = '';
    showEmptyState('no-match');
    return;
  }

  var isFractionTable = rows[0] && rows[0].fraction_value !== undefined;
  var anomalies = isFractionTable ? {} : detectAnomalies(rows);

  var columns = isFractionTable ? [
    { key: 'label', label: 'Sitio' },
    { key: 'group_name', label: 'Grupo' },
    { key: 'page_type', label: 'Page' },
    { key: 'metric_name', label: 'Métrica' },
    { key: 'form_factor', label: 'FF' },
    { key: 'query_level', label: 'Nivel' },
    { key: 'category', label: 'Categoría' },
    { key: 'fraction_value', label: 'Fraction' },
    { key: 'collection_end', label: 'Fecha' }
  ] : [
    { key: 'label', label: 'Sitio' },
    { key: 'group_name', label: 'Grupo' },
    { key: 'page_type', label: 'Page' },
    { key: 'metric_name', label: 'Métrica' },
    { key: 'form_factor', label: 'FF' },
    { key: 'query_level', label: 'Nivel' },
    { key: 'p75_value', label: 'p75' },
    { key: 'good_pct', label: 'Good%' },
    { key: 'ni_pct', label: 'NI%' },
    { key: 'poor_pct', label: 'Poor%' },
    { key: 'collection_end', label: 'Fecha' }
  ];

  var sortState = { col: null, asc: true };

  function renderTable(sortedRows) {
    thead.innerHTML = '';
    var tr = document.createElement('tr');
    columns.forEach(function (col) {
      var th = document.createElement('th');
      th.textContent = col.label;
      th.style.cursor = 'pointer';
      if (sortState.col === col.key) {
        th.textContent += sortState.asc ? ' ▲' : ' ▼';
      }
      th.addEventListener('click', function () {
        if (sortState.col === col.key) {
          sortState.asc = !sortState.asc;
        } else {
          sortState.col = col.key;
          sortState.asc = true;
        }
        var sorted = rows.slice().sort(function (a, b) {
          var aVal = a[col.key];
          var bVal = b[col.key];
          if (aVal == null && bVal == null) return 0;
          if (aVal == null) return 1;
          if (bVal == null) return -1;
          if (typeof aVal === 'number' && typeof bVal === 'number') {
            return sortState.asc ? aVal - bVal : bVal - aVal;
          }
          var cmp = String(aVal).localeCompare(String(bVal));
          return sortState.asc ? cmp : -cmp;
        });
        renderTable(sorted);
      });
      tr.appendChild(th);
    });
    thead.appendChild(tr);

    tbody.innerHTML = '';
    sortedRows.forEach(function (row) {
      var tr2 = document.createElement('tr');
      if (isAnomaly(anomalies, row)) {
        tr2.style.cssText = 'border-left: 3px solid #d29922;';
      }
      columns.forEach(function (col) {
        var td = document.createElement('td');
        var val = row[col.key];
        if (col.key === 'label') {
          td.textContent = (val || '');
          if (isAnomaly(anomalies, row)) {
            td.textContent = '⚠ ' + td.textContent;
          }
        } else if (col.key === 'p75_value') {
          td.textContent = formatP75(val, row.metric_name);
        } else if (col.key === 'fraction_value') {
          td.textContent = formatPct(val);
        } else if (col.key === 'good_pct' || col.key === 'ni_pct' || col.key === 'poor_pct') {
          td.textContent = formatPct(val);
        } else if (col.key === 'query_level') {
          td.textContent = (val || '') + ' ' + tagLevel(val);
        } else if (col.key === 'metric_name') {
          td.textContent = metricLabel(val);
        } else {
          td.textContent = val != null ? val : '';
        }
        tr2.appendChild(td);
      });
      tbody.appendChild(tr2);
    });
  }

  renderTable(rows);
}

// ── Metric Label Helper ──────────────────────────────────────────────────

function metricLabel(name) {
  return METRIC_METADATA[name] ? METRIC_METADATA[name].label : name;
}

var CWV_THRESHOLDS = {
  largest_contentful_paint: { good: 2500, ni: 4000 },
  cumulative_layout_shift: { good: 0.1, ni: 0.25 },
  interaction_to_next_paint: { good: 200, ni: 500 },
  first_contentful_paint: { good: 1800, ni: 3000 },
  experimental_time_to_first_byte: { good: 800, ni: 1800 },
  largest_contentful_paint_image_time_to_first_byte: { good: 800, ni: 1800 },
  round_trip_time: { good: 200, ni: 500 }
};

function drillDown(dimension, value) {
  var next = computeDrillDownState(state, dimension, value);
  state.group = next.group;
  state.sites = next.sites;

  updateFilterUI({ group: state.group || '' });
  var checkboxes = document.querySelectorAll('#site-checkboxes input[type="checkbox"]');
  checkboxes.forEach(function (cb) {
    cb.checked = state.sites.indexOf(cb.value) !== -1;
  });
  updateSiteGroupCounts();
  applyFilters();
}

function computeDrillDownState(current, dimension, value) {
  var next = {
    group: current.group || '',
    sites: (current.sites || []).slice()
  };
  if (dimension === 'group') {
    next.group = next.group === value ? '' : value;
    next.sites = [];
  } else if (dimension === 'sites') {
    if (next.sites.length === 1 && next.sites[0] === value) {
      next.sites = [];
    } else {
      next.group = '';
      next.sites = [value];
    }
  }
  return next;
}

function detectAnomalies(rows) {
  var groupAvg = {};
  rows.forEach(function (r) {
    var key = r.group_name + '|' + r.metric_name + '|' + r.form_factor;
    if (!groupAvg[key]) groupAvg[key] = { sumGood: 0, count: 0 };
    if (r.good_pct != null) {
      groupAvg[key].sumGood += r.good_pct;
      groupAvg[key].count++;
    }
  });

  var annotations = {};
  Object.keys(groupAvg).forEach(function (key) {
    if (groupAvg[key].count === 0) return;
    annotations[key] = groupAvg[key].sumGood / groupAvg[key].count;
  });

  var anomalies = {};
  rows.forEach(function (r) {
    var key = r.group_name + '|' + r.metric_name + '|' + r.form_factor;
    var avg = annotations[key];
    if (avg && avg > 0 && r.good_pct != null) {
      var dev = Math.abs(r.good_pct - avg) / avg;
      if (dev > 0.20) {
        anomalies[r.origin + '|' + r.metric_name + '|' + r.form_factor] = { deviation: dev, direction: r.good_pct < avg ? 'below' : 'above' };
      }
    }
  });

  return anomalies;
}

function isAnomaly(anomalies, row) {
  return !!(anomalies[row.origin + '|' + row.metric_name + '|' + row.form_factor] ||
            anomalies[row.label + '|' + row.metric_name + '|' + row.form_factor]);
}

// ── D3: Grouped Bar Chart ────────────────────────────────────────────────

function drawGroupedBars(container, data, config) {
  container.innerHTML = '';

  if (!data || data.length === 0) return;
  config = config || {};

  var width = config.width || 800;
  var height = config.height || 400;
  var margin = { top: 20, right: 30, bottom: 100, left: 60 };
  var innerW = width - margin.left - margin.right;
  var innerH = height - margin.top - margin.bottom;

  var svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .append('g')
    .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

  var defs = svg.append('defs');

  defs.append('pattern')
    .attr('id', 'pattern-ni')
    .attr('width', 4).attr('height', 4)
    .attr('patternTransform', 'rotate(45)')
    .attr('patternUnits', 'userSpaceOnUse')
    .append('line')
    .attr('x1', 0).attr('y1', 0).attr('x2', 0).attr('y2', 4)
    .attr('stroke', 'white').attr('stroke-width', 0.5).attr('opacity', 0.3);

  defs.append('pattern')
    .attr('id', 'pattern-poor')
    .attr('width', 4).attr('height', 4)
    .attr('patternUnits', 'userSpaceOnUse')
    .append('rect')
    .attr('width', 4).attr('height', 4)
    .attr('fill', 'none')
    .attr('stroke', 'white').attr('stroke-width', 0.5).attr('opacity', 0.3);

  var fillMap = {
    good_pct: '#3fb950',
    ni_pct: 'url(#pattern-ni)',
    poor_pct: 'url(#pattern-poor)'
  };

  var baseColor = {
    good_pct: '#3fb950',
    ni_pct: '#d29922',
    poor_pct: '#f85149'
  };

  var anomalies = detectAnomalies(data);

  // Build group labels
  var groups = data.map(function (d) {
    return d.label + (d.form_factor ? ' ' + d.form_factor : '');
  });

  var x0 = d3.scaleBand().domain(groups).range([0, innerW]).padding(0.3);

  var categories = ['good_pct', 'ni_pct', 'poor_pct'];
  var x1 = d3.scaleBand().domain(categories).range([0, x0.bandwidth()]).padding(0.05);

  var y = d3.scaleLinear().domain([0, 1]).range([innerH, 0]);

  // Draw grouped bars
  var barGroups = svg.append('g')
    .selectAll('g')
    .data(data)
    .enter()
    .append('g')
    .attr('transform', function (d) {
      var key = d.label + (d.form_factor ? ' ' + d.form_factor : '');
      return 'translate(' + x0(key) + ',0)';
    });

  var tip = d3.select('body').append('div')
    .attr('class', 'd3-tooltip')
    .style('opacity', 0)
    .style('z-index', '9999');

  barGroups.selectAll('rect')
    .data(function (d) {
      return categories.map(function (cat) {
        return { key: cat, value: d[cat] || 0, parent: d };
      });
    })
    .enter()
    .append('rect')
    .attr('x', function (d) { return x1(d.key); })
    .attr('y', function (d) { return y(d.value); })
    .attr('width', x1.bandwidth())
    .attr('height', function (d) { return innerH - y(d.value); })
    .attr('fill', function (d) { return fillMap[d.key]; })
    .style('cursor', 'pointer')
    .on('click', function (event, d) {
      var p = d.parent;
      var dimension = config.drilldownDimension || 'group';
      var drillValue = config.getDrilldownValue ? config.getDrilldownValue(p) : (p.group_name || p.label);
      if (dimension && drillValue) {
        drillDown(dimension, drillValue);
      }
    })
    .on('mouseover', function (event, d) {
      var p = d.parent;
      var levelTag = p.query_level === 'url' ? '[U]' : p.query_level === 'origin' ? '[O]' : '';
      var anomInfo = '';
      if (d.key === 'good_pct' && isAnomaly(anomalies, p)) {
        var aKey = (p.origin || p.label) + '|' + (p.metric_name || state.metric) + '|' + p.form_factor;
        var dev = anomalies[aKey] ? (anomalies[aKey].deviation * 100).toFixed(0) + '%' : '';
        anomInfo = '<div style="color:#d29922;font-size:10px;">Desviación: ' + dev + ' del promedio del grupo</div>';
      }
      var clickHint = config.clickHint || 'Click para filtrar este grupo';
      tip.transition().duration(200).style('opacity', 1);
      tip.html(
        '<div>' + (p.label || p.origin || '') + ' ' + levelTag + (p.form_factor ? ' (' + p.form_factor + ')' : '') + '</div>' +
        '<div style="font-size:11px;margin-top:3px;">' +
        '<span style="color:#3fb950;">' + d.key.replace('_pct','').toUpperCase() + ': ' + (d.value * 100).toFixed(1) + '%</span>' +
        '</div>' + anomInfo +
        '<div style="color:#8b949e;font-size:10px;margin-top:2px;">' + clickHint + '</div>'
      )
      .style('left', (event.pageX + 12) + 'px')
      .style('top', (event.pageY - 28) + 'px');
    })
    .on('mouseout', function () {
      tip.transition().duration(300).style('opacity', 0);
    });

  // Anomaly borders
  barGroups.selectAll('rect')
    .filter(function (d) { return d.key === 'good_pct' && isAnomaly(anomalies, d.parent); })
    .attr('stroke', '#d29922')
    .attr('stroke-width', 2)
    .attr('stroke-dasharray', '4,2');

  // X axis
  svg.append('g')
    .attr('transform', 'translate(0,' + innerH + ')')
    .call(d3.axisBottom(x0))
    .selectAll('text')
    .attr('transform', 'rotate(-45)')
    .style('text-anchor', 'end')
    .style('fill', '#8b949e')
    .style('font-size', '11px');

  // Y axis
  svg.append('g')
    .call(d3.axisLeft(y).ticks(5, '.0%'))
    .style('color', '#8b949e')
    .style('font-size', '11px');

  // Axis domain styling
  svg.selectAll('.domain').style('stroke', '#30363d');
  svg.selectAll('.tick line').style('stroke', '#30363d');

  // Legend
  var legend = svg.append('g')
    .attr('transform', 'translate(' + (innerW - 200) + ',' + (-margin.top) + ')');

  var legendItems = [
    { key: 'good_pct', label: 'Good' },
    { key: 'ni_pct', label: 'NI' },
    { key: 'poor_pct', label: 'Poor' }
  ];

  legendItems.forEach(function (item, i) {
    var g = legend.append('g').attr('transform', 'translate(' + (i * 70) + ',0)');
    g.append('rect')
      .attr('width', 12)
      .attr('height', 12)
      .attr('fill', baseColor[item.key]);
    g.append('text')
      .attr('x', 16)
      .attr('y', 10)
      .text(item.label)
      .style('fill', '#8b949e')
      .style('font-size', '11px');
  });
}

// ── D3: Line Chart ───────────────────────────────────────────────────────

function drawLineChart(container, series, config) {
  container.innerHTML = '';

  if (!series || series.length === 0) return;

  var width = config.width || 800;
  var height = config.height || 400;
  var margin = { top: 20, right: 120, bottom: 60, left: 60 };
  var innerW = width - margin.left - margin.right;
  var innerH = height - margin.top - margin.bottom;

  var isCLS = state.metric === 'cumulative_layout_shift';

  var svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .append('g')
    .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

  // Collect all dates and values
  var allDates = [];
  var allValues = [];
  series.forEach(function (s) {
    var points = s.points || s;
    points.forEach(function (p) {
      if (p.p75_value != null && p.p75_value !== '') {
        allDates.push(p.collection_end);
        var v = isCLS ? parseFloat(p.p75_value) : Number(p.p75_value);
        if (!isNaN(v)) allValues.push(v);
      }
    });
  });

  if (allDates.length === 0 || allValues.length === 0) return;

  var x = d3.scaleTime()
    .domain(d3.extent(allDates, function (d) { return new Date(d); }))
    .range([0, innerW]);

  var yMin = isCLS ? 0 : d3.min(allValues);
  var yMax = isCLS ? 1 : d3.max(allValues);
  var yPadding = isCLS ? 0 : (yMax - yMin) * 0.1 || 10;

  var y = d3.scaleLinear()
    .domain([isCLS ? 0 : Math.max(0, yMin - yPadding), yMax + yPadding])
    .range([innerH, 0]);

  // X axis
  svg.append('g')
    .attr('transform', 'translate(0,' + innerH + ')')
    .call(d3.axisBottom(x).ticks(6))
    .style('color', '#8b949e')
    .style('font-size', '11px');

  // Y axis
  svg.append('g')
    .call(d3.axisLeft(y).ticks(6))
    .style('color', '#8b949e')
    .style('font-size', '11px');

  svg.selectAll('.domain').style('stroke', '#30363d');
  svg.selectAll('.tick line').style('stroke', '#30363d');

  // Threshold lines
  var metric = state.metric || 'largest_contentful_paint';
  var thresholds = CWV_THRESHOLDS[metric];
  if (thresholds && !isCLS) {
    [thresholds.good, thresholds.ni].forEach(function (t, idx) {
      if (t > yMax + yPadding) return;
      var label = idx === 0 ? 'Good' : 'NI';
      svg.append('line')
        .attr('x1', 0).attr('x2', innerW)
        .attr('y1', y(t)).attr('y2', y(t))
        .attr('stroke', idx === 0 ? '#3fb950' : '#d29922')
        .attr('stroke-dasharray', '6,4')
        .attr('stroke-width', 1)
        .attr('opacity', 0.6);
      svg.append('text')
        .attr('x', innerW - 5)
        .attr('y', y(t) - 4)
        .text(label + ' < ' + (t >= 1000 ? (t / 1000).toFixed(1) + 's' : t + 'ms'))
        .style('fill', idx === 0 ? '#3fb950' : '#d29922')
        .style('font-size', '10px')
        .style('text-anchor', 'end');
    });
  }
  if (thresholds && isCLS) {
    [thresholds.good, thresholds.ni].forEach(function (t, idx) {
      if (t > yMax + yPadding) return;
      var label = idx === 0 ? 'Good' : 'NI';
      svg.append('line')
        .attr('x1', 0).attr('x2', innerW)
        .attr('y1', y(t)).attr('y2', y(t))
        .attr('stroke', idx === 0 ? '#3fb950' : '#d29922')
        .attr('stroke-dasharray', '6,4')
        .attr('stroke-width', 1)
        .attr('opacity', 0.6);
      svg.append('text')
        .attr('x', innerW - 5)
        .attr('y', y(t) - 4)
        .text(label + ' < ' + t.toFixed(2))
        .style('fill', idx === 0 ? '#3fb950' : '#d29922')
        .style('font-size', '10px')
        .style('text-anchor', 'end');
    });
  }

  // Color scale for lines
  var lineColors = d3.scaleOrdinal()
    .range(['#58a6ff', '#f0883e', '#3fb950', '#d29922', '#f85149', '#bc8cff', '#79c0ff', '#ffa657']);

  // Tooltip
  var tooltip = d3.select('body').append('div')
    .attr('class', 'd3-tooltip')
    .style('position', 'absolute')
    .style('background', '#161b22')
    .style('border', '1px solid #30363d')
    .style('padding', '8px 12px')
    .style('border-radius', '6px')
    .style('font-size', '12px')
    .style('pointer-events', 'none')
    .style('color', '#c9d1d9')
    .style('opacity', 0)
    .style('z-index', '9999');

  // Draw lines
  series.forEach(function (s, i) {
    var points = (s.points || s).filter(function (p) {
      return p.p75_value != null && p.p75_value !== '';
    });

    if (points.length === 0) return;

    var lineData = points.map(function (p) {
      var v = isCLS ? parseFloat(p.p75_value) : Number(p.p75_value);
      return { date: new Date(p.collection_end), value: isNaN(v) ? null : v, _raw: p };
    }).filter(function (d) { return d.value != null; });

    if (lineData.length === 0) return;

    var line = d3.line()
      .x(function (d) { return x(d.date); })
      .y(function (d) { return y(d.value); });

    var ff = s.form_factor || 'PHONE';
    var strokeColor = lineColors(i);
    var dash = ff === 'DESKTOP' ? '5,5' : null;

    svg.append('path')
      .datum(lineData)
      .attr('fill', 'none')
      .attr('stroke', strokeColor)
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', dash)
      .attr('d', line);

    // Dots for hover
    svg.selectAll('.dot-' + i)
      .data(lineData)
      .enter()
      .append('circle')
      .attr('class', 'dot-' + i)
      .attr('cx', function (d) { return x(d.date); })
      .attr('cy', function (d) { return y(d.value); })
      .attr('r', 4)
      .attr('fill', strokeColor)
      .attr('opacity', 0)
      .on('mouseover', function (event, d) {
        tooltip.transition().duration(200).style('opacity', 1);
        tooltip.html(
          '<div>' + (s.label || s.origin || '') + ' (' + ff + ')</div>' +
          '<div class="date" style="color:#8b949e;font-size:11px;">' + d.date.toISOString().slice(0, 10) + '</div>' +
          '<div>p75: ' + (isCLS ? d.value.toFixed(3) : formatP75(String(d.value), state.metric)) + '</div>' +
          (d._raw && d._raw.good_pct != null ? '<div style="font-size:10px;margin-top:4px;">' +
            '<span style="color:#3fb950;">Good: ' + (d._raw.good_pct * 100).toFixed(1) + '%</span> ' +
            '<span style="color:#d29922;">NI: ' + (d._raw.ni_pct * 100).toFixed(1) + '%</span> ' +
            '<span style="color:#f85149;">Poor: ' + (d._raw.poor_pct * 100).toFixed(1) + '%</span>' +
          '</div>' : '')
        )
        .style('left', (event.pageX + 12) + 'px')
        .style('top', (event.pageY - 28) + 'px');
      })
      .on('mouseout', function () {
        tooltip.transition().duration(300).style('opacity', 0);
      });

    // Legend entry
    var legendY = 20 + i * 20;
    svg.append('line')
      .attr('x1', innerW + 10)
      .attr('y1', legendY)
      .attr('x2', innerW + 40)
      .attr('y2', legendY)
      .attr('stroke', strokeColor)
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', dash);

    svg.append('text')
      .attr('x', innerW + 45)
      .attr('y', legendY + 4)
      .text((s.label || s.origin || '') + ' ' + ff)
      .style('fill', '#8b949e')
      .style('font-size', '11px');
  });

  // Remove tooltip on cleanup
  container._tooltip = tooltip;
}

// ── D3: Scatter Plot ─────────────────────────────────────────────────────

function drawScatter(container, data, config) {
  container.innerHTML = '';

  if (!data || data.length === 0) return;

  var width = config.width || 500;
  var height = config.height || 350;
  var margin = { top: 20, right: 30, bottom: 50, left: 60 };
  var innerW = width - margin.left - margin.right;
  var innerH = height - margin.top - margin.bottom;

  var isCLS = state.metric === 'cumulative_layout_shift';

  var points = data.map(function (r) {
    var good = r.good_pct != null ? r.good_pct : 0;
    var p75 = isCLS ? parseFloat(r.p75_value) : Number(r.p75_value);
    return {
      label: r.label || r.origin,
      origin: r.origin,
      form_factor: r.form_factor,
      good_pct: good,
      p75_value: isNaN(p75) ? 0 : p75
    };
  }).filter(function (d) { return d.good_pct > 0 || d.p75_value > 0; });

  if (points.length === 0) return;

  var svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .append('g')
    .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

  var x = d3.scaleLinear()
    .domain([0, 1])
    .range([0, innerW]);

  var yMin = isCLS ? 0 : d3.min(points, function (d) { return d.p75_value; });
  var yMax = isCLS ? 1 : d3.max(points, function (d) { return d.p75_value; });
  var yPad = isCLS ? 0 : (yMax - yMin) * 0.1 || 10;

  var y = d3.scaleLinear()
    .domain([isCLS ? 0 : Math.max(0, yMin - yPad), yMax + yPad])
    .range([innerH, 0]);

  // Axes
  svg.append('g')
    .attr('transform', 'translate(0,' + innerH + ')')
    .call(d3.axisBottom(x).ticks(5, '.0%'))
    .style('color', '#8b949e')
    .style('font-size', '11px');

  svg.append('g')
    .call(d3.axisLeft(y).ticks(6))
    .style('color', '#8b949e')
    .style('font-size', '11px');

  svg.selectAll('.domain').style('stroke', '#30363d');
  svg.selectAll('.tick line').style('stroke', '#30363d');

  // Threshold lines for scatter
  var metric = state.metric || 'largest_contentful_paint';
  var thresholds = CWV_THRESHOLDS[metric];
  if (thresholds) {
    [thresholds.good, thresholds.ni].forEach(function (t, idx) {
      var svgY = y(t);
      svg.append('line')
        .attr('x1', 0).attr('x2', innerW)
        .attr('y1', svgY).attr('y2', svgY)
        .attr('stroke', idx === 0 ? '#3fb950' : '#d29922')
        .attr('stroke-dasharray', '4,4')
        .attr('stroke-width', 1)
        .attr('opacity', 0.5);
      svg.append('text')
        .attr('x', 5)
        .attr('y', svgY - 4)
        .text(isCLS ? t.toFixed(2) : (t >= 1000 ? (t / 1000).toFixed(1) + 's' : t + 'ms'))
        .style('fill', idx === 0 ? '#3fb950' : '#d29922')
        .style('font-size', '9px');
    });
  }

  // Axis labels
  svg.append('text')
    .attr('x', innerW / 2)
    .attr('y', innerH + 40)
    .text('Good %')
    .style('fill', '#8b949e')
    .style('font-size', '12px')
    .style('text-anchor', 'middle');

  svg.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -innerH / 2)
    .attr('y', -45)
    .text('p75')
    .style('fill', '#8b949e')
    .style('font-size', '12px')
    .style('text-anchor', 'middle');

  // Color by form factor
  var ffColor = d3.scaleOrdinal()
    .domain(['PHONE', 'DESKTOP'])
    .range(['#58a6ff', '#f0883e']);

  // Tooltip
  var tooltip = d3.select('body').append('div')
    .attr('class', 'd3-tooltip')
    .style('position', 'absolute')
    .style('background', '#161b22')
    .style('border', '1px solid #30363d')
    .style('padding', '8px 12px')
    .style('border-radius', '6px')
    .style('font-size', '12px')
    .style('pointer-events', 'none')
    .style('color', '#c9d1d9')
    .style('opacity', 0)
    .style('z-index', '9999');

  svg.selectAll('circle')
    .data(points)
    .enter()
    .append('circle')
    .attr('cx', function (d) { return x(d.good_pct); })
    .attr('cy', function (d) { return y(d.p75_value); })
    .attr('r', 6)
    .attr('fill', function (d) { return ffColor(d.form_factor); })
    .attr('opacity', 0.8)
    .style('cursor', 'pointer')
    .on('click', function (event, d) {
      drillDown('sites', d.origin);
    })
    .on('mouseover', function (event, d) {
      tooltip.transition().duration(200).style('opacity', 1);
      tooltip.html(
        '<div>' + d.label + ' (' + d.form_factor + ')</div>' +
        '<div>Good: ' + formatPct(d.good_pct) + '</div>' +
        '<div>p75: ' + (isCLS ? d.p75_value.toFixed(3) : formatP75(String(d.p75_value), state.metric)) + '</div>' +
        '<div style="color:#8b949e;font-size:10px;margin-top:2px;">Click para ver solo este sitio</div>'
      )
      .style('left', (event.pageX + 12) + 'px')
      .style('top', (event.pageY - 28) + 'px');
    })
    .on('mouseout', function () {
      tooltip.transition().duration(300).style('opacity', 0);
    });

  container._tooltip = tooltip;
}

// ── Build Mode: Data Filtering ──────────────────────────────────────────

function getFilteredBuildData() {
  var cd = window.CRUX_DATA;
  if (!cd) return null;

  if (state.activeTab === 'desglose' || (state.activeTab === 'datos' && isFractionMetric(state.metric))) {
    return filterFractions(cd);
  }

  if (state.activeTab === 'comparativa') {
    return {
      metrics: [{ name: state.metric || 'largest_contentful_paint', data: filterSnapshot(cd) }],
      fractions: filterFractions(cd)
    };
  }

  if (state.activeTab === 'tendencia') {
    return filterTimeseries(cd);
  }

  return filterSnapshot(cd);
}

function filterSnapshot(cd) {
  var rows = cd.snapshot || [];
  return rows.filter(function (r) {
    if (state.group && r.group_name !== state.group) return false;
    if (state.sites.length > 0 && state.sites.indexOf(r.origin) === -1) return false;
    if (state.pageType && r.page_type !== state.pageType) return false;
    if (state.formFactor && r.form_factor !== state.formFactor) return false;
    if (state.queryLevel && r.query_level !== state.queryLevel) return false;
    if (state.dateFrom && r.collection_end && r.collection_end < state.dateFrom) return false;
    if (state.dateTo && r.collection_end && r.collection_end > state.dateTo) return false;
    return true;
  });
}

function filterTimeseries(cd) {
  var rows = cd.timeseries || [];
  if (!Array.isArray(rows) || rows.length === 0) return [];

  var filtered = rows.filter(function (r) {
    if (state.sites.length > 0 && state.sites.indexOf(r.origin) === -1) return false;
    if (state.group && r.group_name !== state.group) return false;
    if (r.metric_name !== (state.metric || 'largest_contentful_paint')) return false;
    if (state.formFactor && r.form_factor !== state.formFactor) return false;
    if (state.dateFrom && r.collection_end && r.collection_end < state.dateFrom) return false;
    if (state.dateTo && r.collection_end && r.collection_end > state.dateTo) return false;
    return r.p75_value !== null;
  });

  return groupTimeseries(filtered);
}

function filterFractions(cd) {
  var rows = cd.fractions || [];
  if (!Array.isArray(rows) || rows.length === 0) return [];
  return rows.filter(function (r) {
    if (state.sites.length > 0 && state.sites.indexOf(r.origin) === -1) return false;
    if (state.group && r.group_name !== state.group) return false;
    if (state.metric && r.metric_name !== state.metric) return false;
    if (state.pageType && r.page_type !== state.pageType) return false;
    if (state.formFactor && r.form_factor !== state.formFactor) return false;
    if (state.queryLevel && r.query_level !== state.queryLevel) return false;
    if (state.dateFrom && r.collection_end && r.collection_end < state.dateFrom) return false;
    if (state.dateTo && r.collection_end && r.collection_end > state.dateTo) return false;
    return true;
  });
}

// ── Boot ─────────────────────────────────────────────────────────────────

window.addEventListener('popstate', function () {
  urlToState();
  switchTab(state.activeTab);
});

document.addEventListener('DOMContentLoaded', function () {
  if (window.location.search) {
    urlToState();
  }
  init();
});
