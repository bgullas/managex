const mockBank = require('../../shared/mockBank');
const store = require('../../shared/blobStore');
const { preflight, json } = require('../../shared/cors');

exports.handler = async (event) => {
  const pre = preflight(event);
  if (pre) return pre;
  if (event.httpMethod !== 'POST') return json(405, { error: 'method_not_allowed' });

  const id = event.path.split('/').pop();
  const intent = await store.getById(id);
  if (!intent) return json(404, { error: 'not_found' });
  if (intent.status === 'paid') return json(200, { ok: true, alreadyPaid: true });

  try {
    const host = (event.headers && (event.headers.host || event.headers.Host)) || process.env.URL;
    const webhookUrl = `https://${host}/.netlify/functions/webhooks-payment`;
    const resp = await mockBank.simulateBankWebhookCall(intent, webhookUrl);
    const result = await resp.json().catch(() => ({}));
    return json(200, { ok: true, webhookStatus: resp.status, webhookResult: result });
  } catch (e) {
    return json(500, { error: 'webhook_dispatch_failed', detail: String(e) });
  }
};
