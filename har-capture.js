async (page) => {
  const cdp = await page.context().newCDPSession(page);
  const entries = [];
  const pending = new Map();

  await cdp.send('Network.enable');

  cdp.on('Network.requestWillBeSent', (params) => {
    pending.set(params.requestId, {
      startedDateTime: new Date(params.timestamp * 1000).toISOString(),
      time: params.timestamp * 1000,
      request: {
        method: params.request.method,
        url: params.request.url,
        httpVersion: 'HTTP/1.1',
        headers: Object.entries(params.request.headers).map(([name, value]) => ({ name, value })),
        queryString: [],
        cookies: [],
        headersSize: -1,
        bodySize: params.request.postData ? params.request.postData.length : 0,
      },
      response: {},
      cache: {},
      timings: { send: 0, receive: 0, wait: 0 },
      connectionId: String(params.requestId),
      _resourceType: params.type || 'other',
      _wallTime: params.wallTime,
      _requestId: params.requestId,
    });
  });

  cdp.on('Network.responseReceived', (params) => {
    const entry = pending.get(params.requestId);
    if (!entry) return;
    entry.response = {
      status: params.response.status,
      statusText: params.response.statusText,
      httpVersion: params.response.protocol || 'HTTP/1.1',
      headers: Object.entries(params.response.headers).map(([name, value]) => ({ name, value })),
      cookies: [],
      content: { size: params.response.encodedDataLength, mimeType: params.response.mimeType, compression: 0 },
      redirectURL: '',
      headersSize: -1,
      bodySize: params.response.encodedDataLength,
      _transferSize: params.response.encodedDataLength,
    };
  });

  cdp.on('Network.loadingFinished', (params) => {
    const entry = pending.get(params.requestId);
    if (!entry) return;
    entry.time = params.timestamp;
    if (entry.response._transferSize != null) {
      entry.response._transferSize = params.encodedDataLength;
    }
    entries.push(entry);
    pending.delete(params.requestId);
  });

  cdp.on('Network.loadingFailed', (params) => {
    const entry = pending.get(params.requestId);
    if (!entry) return;
    entry.response = {
      status: 0,
      statusText: '',
      httpVersion: '',
      headers: [],
      cookies: [],
      content: { size: 0, mimeType: 'x-unknown', compression: 0 },
      redirectURL: '',
      headersSize: -1,
      bodySize: 0,
      _transferSize: 0,
      _error: params.errorText,
    };
    entries.push(entry);
    pending.delete(params.requestId);
  });

  // expose callback to generate HAR
  window.__generateHAR = function(pageUrl, pageTitle) {
    const har = {
      log: {
        version: '1.2',
        creator: { name: 'FrictionTrace Playwright', version: '0.1' },
        browser: { name: 'Chromium', version: navigator.userAgent },
        pages: [{
          startedDateTime: entries.length > 0 ? entries[0].startedDateTime : new Date().toISOString(),
          id: 'page_1',
          title: pageTitle || document.title,
          pageTimings: {
            onContentLoad: Math.round(performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart),
            onLoad: Math.round(performance.timing.loadEventEnd - performance.timing.navigationStart),
          }
        }],
        entries: entries.map(e => ({
          startedDateTime: e.startedDateTime,
          time: Math.round(e.time),
          request: e.request,
          response: e.response,
          cache: e.cache,
          timings: { send: 0, wait: Math.round(e.time), receive: 0 },
          _resourceType: e._resourceType,
          serverIPAddress: '',
          connection: e.connectionId,
          pageref: 'page_1',
        })),
      }
    };
    return JSON.stringify(har);
  };

  // store entries globally
  window.__harEntries = entries;

  return 'HAR capture initialized. Entries will accumulate during navigation.';
}
