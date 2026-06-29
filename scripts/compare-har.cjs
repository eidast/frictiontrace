const fs = require('fs');
const path = require('path');

function analyzeHar(filePath, label) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const har = JSON.parse(raw);
  const entries = har.log.entries;
  const pages = har.log.pages;

  // Basic stats
  const methods = {};
  const statusCodes = {};
  const domains = {};
  const failedRequests = [];
  const slowRequests = [];
  const apiEndpoints = {};
  const errors400 = [];
  const errors500 = [];
  const vtexGraphql = [];
  const vtexCheckout = [];
  const thirdPartyDomains = {};
  const firstPartyDomain = 'walmart.com.gt';
  const totalTransferred = [];
  let totalBytes = 0;

  entries.forEach(e => {
    const url = new URL(e.request.url);
    const domain = url.hostname;
    const method = e.request.method;
    const status = e.response.status;
    const duration = e.time;
    const transferSize = e.response._transferSize || e.response.bodySize || 0;

    methods[method] = (methods[method] || 0) + 1;
    statusCodes[status] = (statusCodes[status] || 0) + 1;
    domains[domain] = (domains[domain] || 0) + 1;
    totalBytes += transferSize;

    // Failed requests
    if (status >= 400 || status === 0) {
      errors400.push({ url: e.request.url, status, method, duration: Math.round(duration), size: transferSize });
    }
    if (status >= 500) {
      errors500.push({ url: e.request.url, status, method, duration: Math.round(duration), size: transferSize });
    }
    if (status === 0 && e.response._error) {
      failedRequests.push({ url: e.request.url, error: e.response._error, method });
    }

    // Slow requests (>1000ms)
    if (duration > 1000) {
      slowRequests.push({ url: e.request.url.substring(0, 120), duration: Math.round(duration), size: transferSize, type: e._resourceType });
    }

    // VTEX-specific
    if (url.pathname.includes('/api/checkout/')) {
      vtexCheckout.push({ url: url.pathname + url.search, status, method, duration: Math.round(duration) });
    }
    if (url.pathname.includes('graphql') || url.pathname.includes('_v/segment')) {
      vtexGraphql.push({ url: url.pathname, status, method });
    }

    // Classify as API endpoint
    if (url.pathname.includes('/api/') || url.pathname.includes('/_v/')) {
      const key = method + ' ' + url.pathname.split('?')[0];
      apiEndpoints[key] = (apiEndpoints[key] || 0) + 1;
    }

    // Third-party
    if (!domain.includes(firstPartyDomain)) {
      thirdPartyDomains[domain] = (thirdPartyDomains[domain] || 0) + 1;
      if (transferSize > 0) {
        const existing = totalTransferred.find(t => t.domain === domain);
        if (existing) {
          existing.bytes += transferSize;
          existing.count++;
        } else {
          totalTransferred.push({ domain, bytes: transferSize, count: 1 });
        }
      }
    }
  });

  // Sort
  const topDomains = Object.entries(domains).sort((a, b) => b[1] - a[1]).slice(0, 15);
  const topSlow = slowRequests.sort((a, b) => b.duration - a.duration).slice(0, 10);
  const topThirdParty = totalTransferred.sort((a, b) => b.bytes - a.bytes).slice(0, 15);
  const duplicateApis = Object.entries(apiEndpoints).filter(([k, v]) => v > 3).sort((a, b) => b[1] - a[1]);
  const checkoutErrorSummary = {};
  errors400.forEach(e => {
    const key = e.status + ' ' + e.method + ' ' + new URL(e.url).pathname.split('?')[0];
    checkoutErrorSummary[key] = (checkoutErrorSummary[key] || 0) + 1;
  });

  // Pages timeline
  const timeline = pages.map(p => ({
    title: p.title,
    onLoad: p.pageTimings.onLoad,
    onContentLoad: p.pageTimings.onContentLoad,
    startedDateTime: p.startedDateTime,
  }));

  return {
    label,
    fileSize: Math.round(raw.length / 1024),
    entryCount: entries.length,
    pageCount: pages.length,
    timeline,
    totalKB: Math.round(totalBytes / 1024),
    methodCounts: methods,
    statusCodeSummary: Object.entries(statusCodes).sort((a, b) => b[1] - a[1]).slice(0, 8),
    domainCount: Object.keys(domains).length,
    topDomains,
    thirdPartyDomainCount: Object.keys(thirdPartyDomains).length,
    topThirdParty,
    totalErrs400: errors400.length,
    totalErrs500: errors500.length,
    totalFailed: failedRequests.length,
    checkoutErrorSummary: Object.entries(checkoutErrorSummary).sort((a, b) => b[1] - a[1]),
    topSlow,
    duplicateApis,
    vtexCheckoutSample: [...new Map(vtexCheckout.map(e => [e.url + e.method, e])).values()],
    vtexGraphqlCount: vtexGraphql.length,
  };
}

const cliHar = path.resolve(__dirname, '..', 'walmart-checkout.har');
const userHar = path.resolve(__dirname, '..', 'www.walmart.com.gt-2productos.har');

console.log('=== Analizando CLIENTE HAR (navegador real, 2 productos) ===\n');
const user = analyzeHar(userHar, 'Usuario (2 productos)');

console.log('=== Analizando CLI HAR (headless automatizado, 1 producto) ===\n');
const cli = analyzeHar(cliHar, 'CLI Headless');

// Comparison
console.log('\n\n========== COMPARATIVA ==========\n');

console.log('┌──────────────────────────┬─────────────────────┬─────────────────────┐');
console.log('│ Métrica                  │ Usuario (2 prod)    │ CLI Headless (1)    │');
console.log('├──────────────────────────┼─────────────────────┼─────────────────────┤');
const pad = (s, len) => {
  const str = String(s);
  return str.padEnd(len);
};
console.log(`│ ${pad('Tamaño HAR', 24)} │ ${pad(user.fileSize + ' KB', 19)} │ ${pad(cli.fileSize + ' KB', 19)} │`);
console.log(`│ ${pad('Total entries', 24)} │ ${pad(user.entryCount, 19)} │ ${pad(cli.entryCount, 19)} │`);
console.log(`│ ${pad('Páginas (pages)', 24)} │ ${pad(user.pageCount, 19)} │ ${pad(cli.pageCount, 19)} │`);
console.log(`│ ${pad('Dominios únicos', 24)} │ ${pad(user.domainCount, 19)} │ ${pad(cli.domainCount, 19)} │`);
console.log(`│ ${pad('3rd-party domains', 24)} │ ${pad(user.thirdPartyDomainCount, 19)} │ ${pad(cli.thirdPartyDomainCount, 19)} │`);
console.log(`│ ${pad('Total transferido', 24)} │ ${pad(Math.round(user.totalKB/1024) + ' MB', 19)} │ ${pad(Math.round(cli.totalKB/1024) + ' MB', 19)} │`);
console.log(`│ ${pad('Errores 4xx/5xx', 24)} │ ${pad(user.totalErrs400 + user.totalErrs500, 19)} │ ${pad(cli.totalErrs400 + cli.totalErrs500, 19)} │`);
console.log(`│ ${pad('Requests fallidos', 24)} │ ${pad(user.totalFailed, 19)} │ ${pad(cli.totalFailed, 19)} │`);
console.log(`│ ${pad('Requests >1s (lentos)', 24)} │ ${pad(user.topSlow.length, 19)} │ ${pad(cli.topSlow.length, 19)} │`);
console.log(`│ ${pad('GraphQL/VTEX calls', 24)} │ ${pad(user.vtexGraphqlCount, 19)} │ ${pad(cli.vtexGraphqlCount, 19)} │`);
console.log('└──────────────────────────┴─────────────────────┴─────────────────────┘');

console.log('\n--- Timeline de páginas (Usuario) ---');
user.timeline.forEach(p => {
  console.log(`  [${p.startedDateTime}] ${p.title}`);
  console.log(`    onLoad: ${p.onLoad}ms | DOMContentLoaded: ${p.onContentLoad}ms`);
});

console.log('\n--- Timeline de páginas (CLI) ---');
cli.timeline.forEach(p => {
  console.log(`  [${p.startedDateTime}] ${p.title}`);
  console.log(`    onLoad: ${p.onLoad}ms | DOMContentLoaded: ${p.onContentLoad}ms`);
});

console.log('\n--- Status codes (Usuario) ---');
user.statusCodeSummary.forEach(([code, count]) => console.log(`  ${code}: ${count}`));

console.log('\n--- Status codes (CLI) ---');
cli.statusCodeSummary.forEach(([code, count]) => console.log(`  ${code}: ${count}`));

console.log('\n--- APIs VTEX más repetidas (Usuario) ---');
user.duplicateApis.slice(0, 15).forEach(([api, count]) => console.log(`  ${count}x  ${api}`));

console.log('\n--- APIs VTEX más repetidas (CLI) ---');
cli.duplicateApis.slice(0, 15).forEach(([api, count]) => console.log(`  ${count}x  ${api}`));

console.log('\n--- Errores checkout agrupados (Usuario) ---');
user.checkoutErrorSummary.forEach(([err, count]) => console.log(`  ${count}x  ${err}`));

console.log('\n--- Errores checkout agrupados (CLI) ---');
cli.checkoutErrorSummary.forEach(([err, count]) => console.log(`  ${count}x  ${err}`));

console.log('\n--- Top 10 requests más lentos (Usuario) ---');
user.topSlow.forEach(r => console.log(`  ${r.duration}ms | ${r.type || '-'} | ${r.url.substring(0, 100)}`));

console.log('\n--- Top 10 requests más lentos (CLI) ---');
cli.topSlow.forEach(r => console.log(`  ${r.duration}ms | ${r.type || '-'} | ${r.url.substring(0, 100)}`));

// Find matching issues
console.log('\n--- ISSUES: ¿Coinciden los hallazgos? ---');
const cli400Urls = new Set(cli.errors400?.map(e => new URL(e.url).pathname.split('?')[0]) || []);
const user400Urls = new Set(user.errors400?.map(e => new URL(e.url).pathname.split('?')[0]) || []);

console.log('\nErrores 400 que APARECEN EN AMBOS:');
const both400 = [...user400Urls].filter(u => cli400Urls.has(u));
both400.forEach(u => console.log(`  ✓ ${u}`));

console.log('\nErrores 400 SOLO en Usuario (navegador real):');
const userOnly400 = [...user400Urls].filter(u => !cli400Urls.has(u));
userOnly400.forEach(u => console.log(`  → ${u}`));

console.log('\nErrores 400 SOLO en CLI:');
const cliOnly400 = [...cli400Urls].filter(u => !user400Urls.has(u));
cliOnly400.forEach(u => console.log(`  → ${u}`));

// Check for the key bugs we found in CLI
const cliIssues = {
  'ageapproval DELETE loop': cli.vtexCheckoutSample?.some(e => e.url.includes('ageapproval')),
  'orderForm 400': cli.errors400?.some(e => e.url.includes('default-order-form')),
  'CSS plugins MIME error': cli.errors400?.some(e => e.url.includes('plugins')),
  'TikTok Pixel': cli.errors400?.some(e => e.url.includes('tiktok')),
};

const userIssues = {
  'ageapproval DELETE loop': user.vtexCheckoutSample?.some(e => e.url.includes('ageapproval')),
  'orderForm 400': user.errors400?.some(e => e.url.includes('default-order-form')),
  'CSS plugins MIME error': user.errors400?.some(e => e.url.includes('plugins')),
  'TikTok Pixel': user.errors400?.some(e => e.url.includes('tiktok')),
};

console.log('\nProblemas clave detectados:');
for (const [issue, found] of Object.entries(cliIssues)) {
  const userFound = userIssues[issue];
  const icon = found && userFound ? '✓ AMBOS' : found ? '→ SOLO CLI' : userFound ? '→ SOLO Usuario' : '✗ NINGUNO';
  console.log(`  ${icon}  ${issue}`);
}
