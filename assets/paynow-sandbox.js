/* ManAgeX PayNow sandbox backend client. Shared by index.html and resident-app.html.
   Talks to the optional local mock backend (server/index.js); if it's unreachable, callers
   should fall back to the existing pure client-side QR generation — this module never
   throws on "backend offline", it just reports unreachable via the status check. */
(function (global) {
  const API_BASE = (global.MX_API_BASE) || 'http://localhost:8787';
  let online = false;
  let sse = null;
  const sseListeners = [];

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

  /* Reconnects automatically on drop since the sandbox backend may restart during a demo. */
  function connectStream(onEvent) {
    sseListeners.push(onEvent);
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

  function pollIntent(id, onUpdate, intervalMs) {
    intervalMs = intervalMs || 3000;
    let stopped = false;
    async function tick() {
      if (stopped) return;
      try {
        const intent = await getIntent(id);
        onUpdate(intent);
        if (intent.status === 'paid') return;
      } catch (e) { /* backend may be offline mid-poll; just keep trying */ }
      if (!stopped) setTimeout(tick, intervalMs);
    }
    tick();
    return () => { stopped = true; };
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
  };
})(window);
