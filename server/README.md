# ManAgeX PayNow sandbox backend

This is a **SANDBOX / MOCK** implementation of a bank's PayNow Corporate API plus the
webhook flow that would confirm a payment. It exists to demonstrate the correct
architecture for real-time PayNow payment confirmation — **no real bank, no real money,
no real QR code is involved.** Nothing here should be mistaken for a production
integration.

## Running it

```
cd server
node index.js
# or
npm start
```

Listens on `http://localhost:8787` by default (override with `PORT`). Uses only Node
built-ins (`http`, `crypto`, `fs`) — no dependencies to install.

Set `WEBHOOK_SECRET` to a real secret in any environment that matters; if unset, a dev
default is used and a warning is printed to the console.

## What's real vs what's mocked

**Real (these patterns are genuinely correct and would survive a swap to a real provider):**
- HMAC-SHA256 signature verification on the webhook endpoint (`verifySignature` in
  `mockBank.js`, enforced in `handleWebhook` in `index.js`) — a request without a valid
  `X-Signature` header is rejected with `401`.
- Idempotency on `transactionId` — a webhook retried/duplicated by the bank does not
  double-credit the unit (`handleWebhook` checks `intent.status === 'paid'` first).
- Separation of "create payment intent" from "webhook confirms payment" — the QR/reference
  is issued up front, the paid state is only ever set by the verified webhook call, never by
  the client directly.
- Real-time push to the frontend via Server-Sent Events (`GET /v1/payments/stream`),
  the same shape a production app would use (or WebSockets) to update the MA portal
  the instant a webhook lands.
- The EMVCo SGQR payload construction (`buildPayNowPayload` in `mockBank.js`) — this is
  spec-correct TLV + CRC16-CCITT, the same logic the browser-side `MXUtil.buildPayNowPayload`
  uses, just now authoritative on the server.

**Mocked (there is no real bank or payer here):**
- `createDynamicQR()` in `mockBank.js` — a real integration would call a bank's Corporate
  API (DBS IDEAL RAPID, OCBC Velocity API, UOB BIBPlus API) or a PayNow-supporting gateway
  SDK (HitPay, StraitsX/Xfers, 2C2P) to actually register the dynamic QR with the bank.
  Here it just builds the QR payload locally and invents a reference/transaction ID.
- `simulateBankWebhookCall()` in `mockBank.js` — stands in for the bank's own webhook
  dispatcher. In production you would never call this yourself; the bank/gateway calls
  your webhook URL after the payer completes the transfer in their banking app.
- `POST /v1/sandbox/simulate-payment/:id` — there is no real bank for a tenant to scan a
  real QR with, so this endpoint exists purely so a human (standing in for "I just paid in
  my banking app") can trigger the simulated webhook call, exercising the exact same
  signature-verification and idempotency code path a real webhook would hit.

## Exactly what to swap for a real integration

To go live, replace these two functions in `server/mockBank.js`:

1. **`createDynamicQR({ uen, amount, unit, period })`** — replace the local QR construction
   with a real API call to your bank's Corporate API or gateway SDK, which will return the
   actual QR payload/image and reference *they* generated (don't build it yourself once a
   real provider is involved — use whatever they return).
2. **`simulateBankWebhookCall(intent, webhookUrl)`** — delete this entirely. In production
   there's nothing to "simulate" — you instead configure your bank/gateway dashboard with
   your real webhook URL (`POST /v1/webhooks/payment` on your deployed server) and they call
   it for you when a payment completes.

Keep using `verifySignature` in `handleWebhook` (in `server/index.js`) as-is, but swap
`WEBHOOK_SECRET` for whatever shared secret/signing scheme your real provider issues
(some use a different header name or a different HMAC construction — check their docs).

Environment variables that would hold real credentials in a live deployment:
- `WEBHOOK_SECRET` — shared signing secret from your bank/gateway.
- `PAYNOW_UEN` — already used here for the merchant UEN; in production this might instead
  come from your gateway account configuration rather than an env var.
- Whatever API key/client ID the bank or gateway issues for `createDynamicQR` to call out
  with (not present in this sandbox since there's nothing real to call).

## Deployed backend (production)

The live GitHub Pages demo at `https://bgullas.github.io/managex/` now talks to a real
deployed backend: **`https://managex-paynow-sandbox.netlify.app`**, running as Netlify
Functions (see `netlify/functions/`) backed by Netlify Blobs instead of the local JSON file
store. This is the same sandbox/mock logic — no real bank, no real money — just reachable
over HTTPS for anyone viewing the public demo, with no local server required.

The deployed version has one behavioral difference: Netlify Functions can't hold a
persistent connection, so there is no Server-Sent Events stream in production. The frontend
(`assets/paynow-sandbox.js`) detects this automatically — `window.location.hostname` decides
whether to use `http://localhost:8787` (local dev, full SSE support) or the deployed Netlify
URL (production, polling). No manual toggle is needed; the same frontend code works against
either backend.

The bank-simulation/SGQR/HMAC logic itself lives in `shared/mockBank.js`, required by both
`server/index.js` (this local Node server) and the Netlify functions, so the two deployments
can't drift out of sync. The Netlify functions use `shared/blobStore.js` (Netlify Blobs) in
place of `server/store.js` (the local JSON file), since serverless functions have no shared
filesystem across invocations.

## Local dev vs production summary

| | Local (`server/`) | Production (`netlify/functions/`) |
|---|---|---|
| Run with | `node server/index.js` | Deployed automatically via Netlify |
| Storage | `server/store.js` (JSON file) | `shared/blobStore.js` (Netlify Blobs) |
| Real-time update | SSE (`GET /v1/payments/stream`) | Polling `GET /v1/payments/intent/:id` every 2-3s |
| Base URL | `http://localhost:8787` | `https://managex-paynow-sandbox.netlify.app/api` |

## GitHub Pages limitation (historical / local-only caveat)

`https://bgullas.github.io/managex/` is static HTTPS hosting and cannot run this Node
backend directly — that's why the Netlify Functions deployment above exists. Running
`node server/index.js` locally is still useful for local development/testing with full SSE
support; point the frontend at it by viewing `index.html`/`resident-app.html` via
`http://localhost/...` rather than the GitHub Pages URL.

The frontend's "Sandbox backend" indicator pings `GET /v1/health` and falls back to the
existing pure client-side QR generation whenever neither backend is reachable, so the rest
of the demo keeps working even with no backend running at all.
