/* ManAgeX PayNow sandbox backend. Plain Node http server, no framework, no real bank
   connection — see server/README.md for what's real vs mocked and how to go live. */
const http = require('http');
const crypto = require('crypto');
const mockBank = require('./mockBank');
const store = require('./store');

const PORT = process.env.PORT || 8787;

const sseClients = new Set();

function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) {
    try { res.write(payload); } catch (e) { sseClients.delete(res); }
  }
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Signature');
}

function sendJSON(res, status, body) {
  setCors(res);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

async function handleCreateIntent(req, res) {
  const raw = await readBody(req);
  let body;
  try { body = JSON.parse(raw || '{}'); } catch (e) { return sendJSON(res, 400, { error: 'invalid_json' }); }
  const { unit, period, amount } = body;
  if (!unit || !period || !amount) return sendJSON(res, 400, { error: 'unit, period and amount are required' });

  const bank = mockBank.createDynamicQR({ uen: process.env.PAYNOW_UEN, amount, unit, period });
  const intent = {
    id: crypto.randomUUID(),
    unit,
    period,
    amount,
    reference: bank.reference,
    qrPayload: bank.qrPayload,
    transactionId: bank.transactionId,
    status: 'pending',
    createdAt: new Date().toISOString(),
    paidAt: null,
    expiresAt: bank.expiresAt,
  };
  store.create(intent);
  sendJSON(res, 201, {
    id: intent.id,
    reference: intent.reference,
    qrPayload: intent.qrPayload,
    expiresAt: intent.expiresAt,
    status: intent.status,
  });
}

function handleGetIntent(req, res, id) {
  const intent = store.getById(id);
  if (!intent) return sendJSON(res, 404, { error: 'not_found' });
  sendJSON(res, 200, intent);
}

function handleSSE(req, res) {
  setCors(res);
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.write(':ok\n\n');
  sseClients.add(res);
  req.on('close', () => sseClients.delete(res));
}

async function handleWebhook(req, res) {
  const raw = await readBody(req);
  const signature = req.headers['x-signature'];
  if (!mockBank.verifySignature(raw, signature)) {
    return sendJSON(res, 401, { error: 'invalid_signature' });
  }
  let body;
  try { body = JSON.parse(raw); } catch (e) { return sendJSON(res, 400, { error: 'invalid_json' }); }

  const { transactionId, status } = body;
  if (!transactionId) return sendJSON(res, 400, { error: 'transactionId required' });

  const intent = store.getByTransactionId(transactionId);
  if (!intent) return sendJSON(res, 404, { error: 'unknown_transaction' });

  if (intent.status === 'paid') {
    // Idempotent: webhook can legitimately be retried/duplicated by the bank.
    return sendJSON(res, 200, { ok: true, alreadyProcessed: true });
  }

  if (status === 'paid') {
    const updated = store.update(intent.id, { status: 'paid', paidAt: body.paidAt || new Date().toISOString() });
    broadcast('payment.paid', updated);
    return sendJSON(res, 200, { ok: true });
  }

  sendJSON(res, 200, { ok: true, ignored: true });
}

async function handleSimulatePayment(req, res, id) {
  const intent = store.getById(id);
  if (!intent) return sendJSON(res, 404, { error: 'not_found' });
  if (intent.status === 'paid') return sendJSON(res, 200, { ok: true, alreadyPaid: true });

  try {
    const webhookUrl = `http://127.0.0.1:${PORT}/v1/webhooks/payment`;
    const resp = await mockBank.simulateBankWebhookCall(intent, webhookUrl);
    const result = await resp.json().catch(() => ({}));
    sendJSON(res, 200, { ok: true, webhookStatus: resp.status, webhookResult: result });
  } catch (e) {
    sendJSON(res, 500, { error: 'webhook_dispatch_failed', detail: String(e) });
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') { setCors(res); res.writeHead(204); return res.end(); }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const { pathname } = url;

  try {
    if (pathname === '/v1/health' && req.method === 'GET') {
      return sendJSON(res, 200, { ok: true, sandbox: true, time: new Date().toISOString() });
    }
    if (pathname === '/v1/payments/intent' && req.method === 'POST') {
      return await handleCreateIntent(req, res);
    }
    if (pathname.startsWith('/v1/payments/intent/') && req.method === 'GET') {
      return handleGetIntent(req, res, pathname.split('/').pop());
    }
    if (pathname === '/v1/payments/stream' && req.method === 'GET') {
      return handleSSE(req, res);
    }
    if (pathname === '/v1/webhooks/payment' && req.method === 'POST') {
      return await handleWebhook(req, res);
    }
    if (pathname.startsWith('/v1/sandbox/simulate-payment/') && req.method === 'POST') {
      return await handleSimulatePayment(req, res, pathname.split('/').pop());
    }
    sendJSON(res, 404, { error: 'not_found' });
  } catch (e) {
    sendJSON(res, 500, { error: 'internal_error', detail: String(e) });
  }
});

server.listen(PORT, () => {
  console.log(`ManAgeX PayNow sandbox backend listening on http://localhost:${PORT}`);
  console.log('This is a MOCKED bank integration. No real money moves through this server.');
});
