/* ManAgeX PayNow sandbox backend client. Shared by index.html and resident-app.html.
   Talks to the optional local mock backend (server/index.js) or, in production, the
   deployed Netlify Functions + Blobs backend; if neither is reachable, callers should fall
   back to the existing pure client-side QR generation — this module never throws on
   "backend offline", it just reports unreachable via the status check.

   Local dev (localhost) talks to server/index.js on :8787, which supports real SSE. The
   deployed Netlify Functions backend has no persistent connections, so production instead
   polls GET /v1/payments/intent/:id every few seconds — connectStream() below detects which
   mode it's in automatically and falls back to polling without any manual toggle. */
(function (global) {
  const DEPLOYED_API_BASE = 'https://managex-paynow-sandbox.netlify.app/api';
  const API_BASE = global.MX_API_BASE ||
    (global.location && global.location.hostname === 'localhost' ? 'http://localhost:8787' : DEPLOYED_API_BASE);
  let online = false;
  let sse = null;
  const sseListeners = [];
  const sseSupported = API_BASE.indexOf('localhost') !== -1;

  async function checkHealth() {
    try {
      const res = await fetch(API_BASE + '/v1/health', { method: 'GET', mode: 'cors' });
      online = res.ok;
    } catch (e) {
      online = false;
    }
    return online;
  }

  function isOnline() { return online; }

  async function createIntent({ unit, period, amount }) {
    const res = await fetch(API_BASE + '/v1/payments/intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unit, period, amount }),
    });
    if (!res.ok) throw new Error('intent_create_failed');
    return res.json();
  }

  async function getIntent(id) {
    const res = await fetch(API_BASE + '/v1/payments/intent/' + id);
    if (!res.ok) throw new Error('intent_fetch_failed');
    return res.json();
  }

  async function simulatePayment(id) {
    const res = await fetch(API_BASE + '/v1/sandbox/simulate-payment/' + id, { method: 'POST' });
    if (!res.ok) throw new Error('simulate_failed');
    return res.json();
  }

  const pollingByIntentId = new Map();

  function pollIntent(id, onUpdate, intervalMs) {
    intervalMs = intervalMs || 2500;
    let stopped = false;
    async function tick() {
      if (stopped) return;
      try {
        const intent = await getIntent(id);
        onUpdate(intent);
        if (intent.status === 'paid') return;
        if (intent.expiresAt && new Date(intent.expiresAt).getTime() < Date.now()) return;
      } catch (e) { /* backend may be offline mid-poll; just keep trying */ }
      if (!stopped) setTimeout(tick, intervalMs);
    }
    tick();
    return () => { stopped = true; };
  }

  /* connectStream() is keyed by intent id, same shape whether driven by a real SSE push
     (local dev, server/index.js) or by polling (production, Netlify Functions — no
     persistent connections available). Reconnects automatically on SSE drop since the
     sandbox backend may restart during a demo. */
  function connectStream(onEvent) {
    sseListeners.push(onEvent);
    if (!sseSupported) return;
    if (sse) return;
    function open() {
      try {
        sse = new EventSource(API_BASE + '/v1/payments/stream');
        sse.addEventListener('payment.paid', (e) => {
          let data; try { data = JSON.parse(e.data); } catch (err) { return; }
          sseListeners.forEach(fn => { try { fn(data); } catch (err) { console.error(err); } });
        });
        sse.onerror = () => {
          sse.close();
          sse = null;
          setTimeout(open, 3000);
        };
      } catch (e) {
        sse = null;
      }
    }
    open();
  }

  /* Used by callers (e.g. the MA portal) that previously relied solely on connectStream()
     for a single in-flight intent. On the polling-only (Netlify) backend, connectStream()
     never fires, so this starts/stops a poll loop that feeds the same listener list. */
  function watchIntent(id) {
    if (sseSupported) return () => {};
    if (pollingByIntentId.has(id)) return pollingByIntentId.get(id);
    const stop = pollIntent(id, (intent) => {
      sseListeners.forEach(fn => { try { fn(intent); } catch (err) { console.error(err); } });
    });
    const wrapped = () => { stop(); pollingByIntentId.delete(id); };
    pollingByIntentId.set(id, wrapped);
    return wrapped;
  }

  global.MXPayNowSandbox = {
    API_BASE,
    checkHealth,
    isOnline,
    createIntent,
    getIntent,
    simulatePayment,
    connectStream,
    pollIntent,
    watchIntent,
  };
})(window);
