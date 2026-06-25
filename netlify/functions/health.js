const { preflight, json } = require('../../shared/cors');

exports.handler = async (event) => {
  const pre = preflight(event);
  if (pre) return pre;
  return json(200, { ok: true, sandbox: true, time: new Date().toISOString() });
};
