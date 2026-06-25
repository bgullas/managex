const crypto = require('crypto');
const mockBank = require('../../shared/mockBank');
const store = require('../../shared/blobStore');
const { preflight, json } = require('../../shared/cors');

exports.handler = async (event) => {
  const pre = preflight(event);
  if (pre) return pre;
  if (event.httpMethod !== 'POST') return json(405, { error: 'method_not_allowed' });

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch (e) { return json(400, { error: 'invalid_json' }); }
  const { unit, period, amount } = body || {};
  if (!unit || !period || !amount) return json(400, { error: 'unit, period and amount are required' });

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
  await store.create(intent);
  return json(201, {
    id: intent.id,
    reference: intent.reference,
    qrPayload: intent.qrPayload,
    expiresAt: intent.expiresAt,
    status: intent.status,
  });
};
