const mockBank = require('../../shared/mockBank');
const store = require('../../shared/blobStore');
const { preflight, json } = require('../../shared/cors');

exports.handler = async (event) => {
  const pre = preflight(event);
  if (pre) return pre;
  if (event.httpMethod !== 'POST') return json(405, { error: 'method_not_allowed' });

  const raw = event.body || '';
  const headers = event.headers || {};
  const signature = headers['x-signature'] || headers['X-Signature'];
  if (!mockBank.verifySignature(raw, signature)) {
    return json(401, { error: 'invalid_signature' });
  }

  let body;
  try { body = JSON.parse(raw); } catch (e) { return json(400, { error: 'invalid_json' }); }

  const { transactionId, status } = body;
  if (!transactionId) return json(400, { error: 'transactionId required' });

  const intent = await store.getByTransactionId(transactionId);
  if (!intent) return json(404, { error: 'unknown_transaction' });

  if (intent.status === 'paid') {
    // Idempotent: webhook can legitimately be retried/duplicated by the bank.
    return json(200, { ok: true, alreadyProcessed: true });
  }

  if (status === 'paid') {
    const updated = await store.update(intent.id, { status: 'paid', paidAt: body.paidAt || new Date().toISOString() });
    return json(200, { ok: true, intent: updated });
  }

  return json(200, { ok: true, ignored: true });
};
