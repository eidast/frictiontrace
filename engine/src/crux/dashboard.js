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
  metric: '',
  formFactor: '',
  queryLevel: '',
  dateFrom: '',
  dateTo: '',
  activeTab: 'resumen',
  mode: 'serve',
  sitesList: [],
};

// ── Helpers ──────────────────────────────────────────────────────────────

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

// ── Mode Detection ───────────────────────────────────────────────────────

function setMode() {
  state.mode = (window.CRUX_DATA && typeof window.CRUX_DATA === 'object')
    ? 'build'
    : 'serve';
}

// ── Core: Init ───────────────────────────────────────────────────────────

async function init() {
  setMode();
  await loadSites();
  bindFilters();
  bindTabs();
  bindPresets();
  bindExport();
  await applyFilters();
}

function bindTabs() {
  document.querySelectorAll('.tab-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      switchTab(btn.dataset.tab);
    });
  });
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

function applyPreset(key) {
  switch (key) {
    case 'walmart-vs-otros':
      updateFilterUI({ group: '', metric: 'largest_contentful_paint', formFactor: '', pageType: '', queryLevel: '' });
      state.group = '';
      state.metric = 'largest_contentful_paint';
      state.formFactor = '';
      state.pageType = '';
      state.queryLevel = '';
      switchTab('grupos');
      break;
    case 'top5-checkouts':
      updateFilterUI({ pageType: 'checkout', metric: 'largest_contentful_paint', formFactor: 'PHONE' });
      state.pageType = 'checkout';
      state.metric = 'largest_contentful_paint';
      state.formFactor = 'PHONE';
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
      updateFilterUI({ formFactor: '' });
      state.formFactor = '';
      switchTab('grupos');
      break;
  }
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

    var header = document.createElement('div');
    header.className = 'checkbox-group-header';
    header.textContent = group;
    header.style.cssText = 'font-size:11px;text-transform:uppercase;color:#8b949e;padding:6px 0 2px 0;letter-spacing:0.5px;';
    container.appendChild(header);

    groupSites.forEach(function (site) {
      var label = document.createElement('label');
      label.style.cssText = 'display:flex;align-items:center;gap:6px;padding:3px 0;font-size:12px;cursor:pointer;color:#c9d1d9;';

      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = site.origin;
      cb.dataset.group = group;

      label.appendChild(cb);
      label.appendChild(document.createTextNode(site.label || site.origin));
      container.appendChild(label);
    });
  });

  // Check any remaining groups not in groupOrder
  Object.keys(grouped).forEach(function (group) {
    if (groupOrder.indexOf(group) !== -1) return;
    var groupSites = grouped[group];

    var header = document.createElement('div');
    header.className = 'checkbox-group-header';
    header.textContent = group;
    header.style.cssText = 'font-size:11px;text-transform:uppercase;color:#8b949e;padding:6px 0 2px 0;letter-spacing:0.5px;';
    container.appendChild(header);

    groupSites.forEach(function (site) {
      var label = document.createElement('label');
      label.style.cssText = 'display:flex;align-items:center;gap:6px;padding:3px 0;font-size:12px;cursor:pointer;color:#c9d1d9;';

      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = site.origin;
      cb.dataset.group = group;

      label.appendChild(cb);
      label.appendChild(document.createTextNode(site.label || site.origin));
      container.appendChild(label);
    });
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

  // Also hide/show group headers based on visibility of their children
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

  document.querySelectorAll('.tab-btn').forEach(function (btn) {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  document.querySelectorAll('.tab-content').forEach(function (tc) {
    tc.classList.remove('active');
  });

  var target = document.getElementById('tab-' + tabName);
  if (target) target.classList.add('active');

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

async function applyFilters() {
  hideEmptyStates();

  if (state.mode === 'serve') {
    var endpoint = getEndpointForTab();
    var data = await fetchData(endpoint);
    if (data === null) return;
    renderCurrentView(data);
  } else {
    var data = getFilteredBuildData();
    renderCurrentView(data);
  }
}

function getEndpointForTab() {
  var map = {
    resumen: '/api/summary',
    grupos: '/api/compare',
    sitios: '/api/compare',
    tendencia: '/api/timeseries',
    datos: '/api/compare'
  };
  return map[state.activeTab] || '/api/compare';
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
    var content, mime;
    if (format === 'csv') {
      content = toCSV(data);
      mime = 'text/csv;charset=utf-8;';
    } else {
      content = JSON.stringify(data, null, 2);
      mime = 'application/json;charset=utf-8;';
    }
    var blob = new Blob([content], { type: mime });
    downloadBlob(blob, filename);
  }
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
  var snapshot = getSnapshotRows(data);

  if (!snapshot || snapshot.length === 0) {
    showEmptyState('no-match');
    return;
  }

  var filtered = snapshot.filter(function (r) {
    return r.metric_name === state.metric;
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

    card.innerHTML =
      '<div style="font-size:11px;text-transform:uppercase;color:#8b949e;">' + ff + '</div>' +
      '<div style="font-size:28px;font-weight:700;margin-top:4px;">' + formatP75(String(avgP75), state.metric) + '</div>' +
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

  var filtered = rows.filter(function (r) {
    return r.metric_name === state.metric;
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
  if (titleEl) titleEl.textContent = 'Métrica por Grupo — ' + metricLabel(state.metric);

  drawGroupedBars(chartBody, chartData, {});
}

// ── View: Sitios ─────────────────────────────────────────────────────────

function renderSitios(data) {
  var rows = getSnapshotRows(data);
  if (!rows || rows.length === 0) {
    showEmptyState('no-match');
    return;
  }

  var filtered = rows.filter(function (r) {
    return r.metric_name === state.metric;
  });
  if (state.formFactor) {
    filtered = filtered.filter(function (r) { return r.form_factor === state.formFactor; });
  }

  // Bar chart: top 15 by p75 (worst first)
  var barContainer = document.getElementById('chart-sites-bars');
  if (barContainer) {
    var barBody = barContainer.querySelector('.chart-body');
    if (barBody) {
      var barTitle = barContainer.querySelector('.panel-title');
      if (barTitle) barTitle.textContent = 'Métrica por Sitio — ' + metricLabel(state.metric);

      var sorted = filtered.slice().sort(function (a, b) {
        var aVal = state.metric === 'cumulative_layout_shift' ? parseFloat(a.p75_value) : Number(a.p75_value);
        var bVal = state.metric === 'cumulative_layout_shift' ? parseFloat(b.p75_value) : Number(b.p75_value);
        if (isNaN(aVal)) aVal = 0;
        if (isNaN(bVal)) bVal = 0;
        return bVal - aVal;
      }).slice(0, 15);

      var chartData = sorted.map(function (r) {
        return {
          label: r.label || r.origin,
          form_factor: r.form_factor,
          good_pct: r.good_pct || 0,
          ni_pct: r.ni_pct || 0,
          poor_pct: r.poor_pct || 0
        };
      });

      drawGroupedBars(barBody, chartData, {});
    }
  }

  // Scatter plot
  var scatterContainer = document.getElementById('chart-sites-scatter');
  if (scatterContainer) {
    var scatterBody = scatterContainer.querySelector('.chart-body');
    if (scatterBody) {
      var scatterTitle = scatterContainer.querySelector('.panel-title');
      if (scatterTitle) scatterTitle.textContent = 'Good% vs p75 — ' + metricLabel(state.metric);

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

  var series = getSeriesData(data);
  if (!series || series.length === 0) {
    showEmptyState('no-match');
    return;
  }

  var titleEl = container.querySelector('.panel-title');
  if (titleEl) titleEl.textContent = 'Tendencia — ' + metricLabel(state.metric);

  drawLineChart(chartBody, series, {});
}

function getSeriesData(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (data.series) return data.series;
  return [];
}

// ── View: Datos ──────────────────────────────────────────────────────────

function renderDatos(data) {
  var rows = getSnapshotRows(data);
  var table = document.getElementById('data-table');
  if (!table) return;

  var thead = table.querySelector('thead');
  var tbody = table.querySelector('tbody');
  if (!thead || !tbody) return;

  if (!rows || rows.length === 0) {
    thead.innerHTML = '';
    tbody.innerHTML = '';
    showEmptyState('no-match');
    return;
  }

  var columns = [
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
      columns.forEach(function (col) {
        var td = document.createElement('td');
        var val = row[col.key];
        if (col.key === 'p75_value') {
          td.textContent = formatP75(val, row.metric_name);
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
  var map = {
    largest_contentful_paint: 'LCP',
    cumulative_layout_shift: 'CLS',
    interaction_to_next_paint: 'INP',
    first_contentful_paint: 'FCP',
    experimental_time_to_first_byte: 'TTFB'
  };
  return map[name] || name;
}

// ── D3: Grouped Bar Chart ────────────────────────────────────────────────

function drawGroupedBars(container, data, config) {
  container.innerHTML = '';

  if (!data || data.length === 0) return;

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

  // Build group labels
  var groups = data.map(function (d) {
    return d.label + (d.form_factor ? ' ' + d.form_factor : '');
  });

  var x0 = d3.scaleBand().domain(groups).range([0, innerW]).padding(0.3);

  var categories = ['good_pct', 'ni_pct', 'poor_pct'];
  var x1 = d3.scaleBand().domain(categories).range([0, x0.bandwidth()]).padding(0.05);

  var y = d3.scaleLinear().domain([0, 1]).range([innerH, 0]);

  var color = d3.scaleOrdinal()
    .domain(categories)
    .range(['#3fb950', '#d29922', '#f85149']);

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
    .attr('fill', function (d) { return color(d.key); })
    .on('mouseover', function (event, d) {
      var p = d.parent;
      var levelTag = p.query_level === 'url' ? '[U]' : p.query_level === 'origin' ? '[O]' : '';
      tip.transition().duration(200).style('opacity', 1);
      tip.html(
        '<div>' + (p.label || p.origin || '') + ' ' + levelTag + (p.form_factor ? ' (' + p.form_factor + ')' : '') + '</div>' +
        '<div style="font-size:11px;margin-top:3px;">' +
        '<span style="color:#3fb950;">' + d.key.replace('_pct','').toUpperCase() + ': ' + (d.value * 100).toFixed(1) + '%</span>' +
        '</div>'
      )
      .style('left', (event.pageX + 12) + 'px')
      .style('top', (event.pageY - 28) + 'px');
    })
    .on('mouseout', function () {
      tip.transition().duration(300).style('opacity', 0);
    });

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
      .attr('fill', color(item.key));
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
    .on('mouseover', function (event, d) {
      tooltip.transition().duration(200).style('opacity', 1);
      tooltip.html(
        '<div>' + d.label + ' (' + d.form_factor + ')</div>' +
        '<div>Good: ' + formatPct(d.good_pct) + '</div>' +
        '<div>p75: ' + (isCLS ? d.p75_value.toFixed(3) : formatP75(String(d.p75_value), state.metric)) + '</div>'
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
    if (r.metric_name !== state.metric) return false;
    if (state.formFactor && r.form_factor !== state.formFactor) return false;
    if (state.dateFrom && r.collection_end && r.collection_end < state.dateFrom) return false;
    if (state.dateTo && r.collection_end && r.collection_end > state.dateTo) return false;
    return r.p75_value !== null;
  });

  var series = {};
  filtered.forEach(function (r) {
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

// ── Boot ─────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', init);
