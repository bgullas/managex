/* Payment intent storage backed by Netlify Blobs — used by netlify/functions/* only.
   Netlify Functions are stateless per-invocation with no shared filesystem across
   invocations, so this replaces server/store.js's JSON file for the deployed backend.
   Local dev (node server/index.js) keeps using server/store.js unchanged. */
const { getStore } = require('@netlify/blobs');

const STORE_NAME = 'payment-intents';
const TXN_INDEX_PREFIX = 'by-txn:';

function store() {
  if (process.env.SITE_ID && process.env.BLOBS_TOKEN) {
    return getStore({
      name: STORE_NAME,
      siteID: process.env.SITE_ID,
      token: process.env.BLOBS_TOKEN,
    });
  }
  return getStore(STORE_NAME);
}

async function create(intent) {
  const s = store();
  await s.setJSON(intent.id, intent);
  await s.setJSON(TXN_INDEX_PREFIX + intent.transactionId, intent.id);
  return intent;
}

async function getById(id) {
  return (await store().get(id, { type: 'json' })) || null;
}

async function getByTransactionId(transactionId) {
  const s = store();
  const id = await s.get(TXN_INDEX_PREFIX + transactionId, { type: 'json' });
  if (!id) return null;
  return getById(id);
}

async function update(id, patch) {
  const s = store();
  const existing = await getById(id);
  if (!existing) return null;
  const updated = { ...existing, ...patch };
  await s.setJSON(id, updated);
  return updated;
}

module.exports = { create, getById, getByTransactionId, update };
