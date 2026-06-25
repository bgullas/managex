/* Shared CORS handling for netlify/functions/* (classic V1 handler signature). The deployed
   backend is called from the GitHub Pages origin (https://bgullas.github.io), a different
   origin than the Netlify functions domain, so every function needs these headers and must
   answer OPTIONS preflight itself — Netlify Functions don't do this automatically. */
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Signature',
};

function preflight(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }
  return null;
}

function json(status, body) {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    body: JSON.stringify(body),
  };
}

module.exports = { CORS_HEADERS, preflight, json };
