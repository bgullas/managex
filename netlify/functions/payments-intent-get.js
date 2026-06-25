const store = require('../../shared/blobStore');
const { preflight, json } = require('../../shared/cors');

exports.handler = async (event) => {
  const pre = preflight(event);
  if (pre) return pre;
  if (event.httpMethod !== 'GET') return json(405, { error: 'method_not_allowed' });

  const id = event.path.split('/').pop();
  const intent = await store.getById(id);
  if (!intent) return json(404, { error: 'not_found' });
  return json(200, intent);
};
