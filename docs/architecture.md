# ManAgeX — Architecture Overview

## System design

ManAgeX is a multi-tenant property management platform built for Singapore managing agents. The demo is a static single-page app suitable for GitHub Pages. Production deployment targets AWS.

```
┌─────────────────────────────────────────────────────┐
│                   CLIENT LAYER                      │
│  ┌─────────────────┐  ┌──────────────────────────┐  │
│  │   MA Portal      │  │   Resident Mobile App    │  │
│  │  index.html      │  │  resident-app.html       │  │
│  │  (admin/ops)     │  │  (tenant self-service)   │  │
│  └────────┬─────────┘  └──────────┬───────────────┘  │
└───────────┼────────────────────────┼─────────────────┘
            │                        │
┌───────────▼────────────────────────▼─────────────────┐
│                   API LAYER (AWS)                    │
│  ┌────────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ /v1/anpr   │  │ /v1/fees │  │ /v1/facilities   │  │
│  │ /v1/guests │  │ /v1/auth │  │ /v1/vehicles     │  │
│  └────────────┘  └──────────┘  └──────────────────┘  │
│           API Gateway + Lambda (Node.js)             │
└──────────────────────────┬───────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────┐
│                   DATA LAYER (AWS)                   │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │  PostgreSQL   │  │  S3 (docs /  │  │  Redis     │  │
│  │  (RDS)        │  │  log cards)  │  │  (session/ │  │
│  │               │  │              │  │   cache)   │  │
│  └──────────────┘  └──────────────┘  └────────────┘  │
└──────────────────────────────────────────────────────┘
            │                       │
┌───────────▼───┐         ┌─────────▼──────────────────┐
│  ANPR CAMERAS │         │   INTEGRATIONS             │
│  (on-site)    │         │   PayNow (UEN/QR)          │
│  Hikvision /  │         │   Twilio (SMS QR)          │
│  Dahua        │         │   SendGrid (email)         │
│               │         │   Stripe (card - future)   │
└───────────────┘         └────────────────────────────┘
```

## Module breakdown

This section originally listed the 8 MA-portal pages and 6 resident screens that existed at launch. The app has since grown substantially (BluGraph/MA/Property hierarchy, Security module, MCST governance tools, renovation workflow, resident feedback/updates, print support). **For the complete, current, page-by-page feature inventory, see [`FEATURES.md`](FEATURES.md)** — this file stays focused on system design rather than duplicating a list that will drift out of date again.

## Data model (key entities)

```
Property
  └── Units (1..n)
        ├── Owner (1..1)
        │     └── Residents (0..n)  [spouse, child, DW, sub-tenant]
        ├── ManagementFees (12/year)
        └── Vehicles (0..2)

Guests
  ├── registered by Unit.Resident
  ├── has QrPass (UUID → gate scan)
  └── has VehiclePass (plate → ANPR)

Facilities
  └── Bookings (n)
        └── linked to Unit.Resident

AccessLog
  ├── gate_id, plate/qr_id, outcome
  └── timestamp, log_id
```

## File structure

```
managex/
├── index.html              ← MA portal (full admin app)
├── resident-app.html       ← Tenant mobile app
├── README.md               ← Project overview
├── docs/
│   ├── architecture.md     ← This file
│   └── api-anpr.md         ← ANPR REST API specification
├── assets/                 ← Shared client JS/CSS (app-state, app-utils, paynow-sandbox)
├── server/                 ← Sandbox PayNow backend for LOCAL DEV (Node http server, SSE, JSON file store)
├── netlify/functions/      ← Same sandbox backend DEPLOYED (Netlify Functions, polling, Netlify Blobs)
├── shared/                 ← mockBank.js (SGQR/HMAC), blobStore.js, cors.js — used by both of the above
└── netlify.toml            ← Netlify Functions + /api/... redirect config (does not affect GitHub Pages)
```

## Demo vs production differences

| Aspect | Demo (GitHub Pages) | Production (AWS) |
|--------|--------------------|--------------------|
| Data | Hardcoded sample data | PostgreSQL RDS |
| Auth | None | Cognito + JWT |
| Files | Not functional | S3 + presigned URLs |
| PayNow | Sandboxed mock Corporate API + webhook, deployed live at Netlify Functions + Blobs (`netlify/functions/`, polling-based) for the public demo, plus `server/` for local dev (SSE-based); falls back to static/generated QR if both are offline | Real bank Corporate API or gateway SDK |
| SMS | Not functional | Twilio |
| Email | Not functional | SendGrid |
| ANPR API | Documented spec | Lambda + API Gateway |
| Multi-tenancy | Single property | Per-property data isolation |

## AWS production stack (recommended)

- **Frontend:** CloudFront + S3 (React/Next.js build)
- **API:** API Gateway + Lambda (Node.js/TypeScript)
- **Database:** RDS PostgreSQL (Multi-AZ)
- **Files:** S3 (log cards, ownership docs, statements)
- **Cache:** ElastiCache Redis (sessions, ANPR hot-cache)
- **Auth:** Cognito User Pools (MA staff) + custom OTP (residents)
- **SMS:** Lambda → Twilio (QR pass delivery)
- **Email:** SES + SendGrid (statements, reminders)
- **Monitoring:** CloudWatch + Sentry

## PayNow payment integration — sandbox implementation

A sandboxed, mocked version of a real PayNow Corporate API + webhook flow now exists in `server/` and is wired into both `index.html` (MA portal) and `resident-app.html`. This replaces the "not implemented" gap described in earlier revisions of this doc with a real, runnable architecture — minus a real bank, since this project has no production banking credentials.

### What's real vs what's mocked

**Real** (these are genuine implementations of the security/architecture patterns a production integration needs, not stand-ins):
- **HMAC-SHA256 signature verification** on `POST /v1/webhooks/payment` (`server/index.js` `handleWebhook`, using `mockBank.verifySignature`) — an unsigned or incorrectly-signed call is rejected with `401`, never trusted.
- **Idempotency** on `transactionId` — a webhook retried or duplicated by the bank does not double-credit a unit (`handleWebhook` short-circuits if the intent is already `paid`).
- **Intent/webhook separation** — the QR/reference is issued via `POST /v1/payments/intent` up front; the `paid` state can only ever be set by a verified webhook call, never directly by the client.
- **Server-Sent Events push** (`GET /v1/payments/stream`) — the MA portal flips a payment to "paid" live, without polling or a manual refresh, the instant the webhook is processed.
- The EMVCo SGQR payload construction (TLV + CRC16-CCITT) is replicated server-side in `server/mockBank.js` so the backend, not the browser, is authoritative for the QR string returned to clients.

**Mocked** (there is no real bank or payer in this sandbox):
- `mockBank.createDynamicQR()` invents the reference/transaction ID and builds the QR locally instead of calling a real bank/gateway API.
- `mockBank.simulateBankWebhookCall()` stands in for the bank's own webhook dispatcher — in production you'd never call this; the bank/gateway calls your webhook URL for you.
- `POST /v1/sandbox/simulate-payment/:id` — since there's no real bank for a resident to scan and pay with, this sandbox-only endpoint lets a human stand in for "I just paid in my banking app," triggering the same signature-verified webhook path a real bank call would hit.

### Exactly what to swap for a real integration
To go live, replace these functions in `server/mockBank.js`:
1. **`createDynamicQR({ uen, amount, unit, period })`** — call the real bank Corporate API (DBS IDEAL RAPID, OCBC Velocity API, UOB BIBPlus API) or a gateway SDK (HitPay, Xfers/StraitsX, 2C2P) and use whatever QR payload/reference *they* return, instead of building it locally.
2. **`simulateBankWebhookCall()`** — delete entirely; instead configure your bank/gateway dashboard with your deployed `POST /v1/webhooks/payment` URL as the webhook target.

Keep `verifySignature`/`signPayload` as the pattern, but use whatever shared-secret/HMAC scheme the real provider issues (env var `WEBHOOK_SECRET` already models this). See `server/README.md` for the full breakdown and how to run the sandbox locally.

### Deployment: Netlify Functions + Blobs (production)
The sandbox backend is deployed at **`https://managex-paynow-sandbox.netlify.app`** as Netlify Functions (`netlify/functions/`), and the live GitHub Pages demo talks to it directly over HTTPS — no local server required. The bank-simulation/SGQR/HMAC logic lives in `shared/mockBank.js`, shared by both `server/index.js` (local dev) and the Netlify functions, so the two never drift apart. Persistent storage on the deployed side uses Netlify Blobs (`shared/blobStore.js`, via `@netlify/blobs`) instead of the local JSON file (`server/store.js`), since serverless functions have no shared filesystem across invocations.

Netlify Functions cannot hold a persistent connection, so there is no SSE stream in production — `assets/paynow-sandbox.js` detects this automatically (based on `window.location.hostname`) and polls `GET /v1/payments/intent/:id` every 2-3 seconds instead, with no manual toggle required. Local dev (`node server/index.js`) keeps full SSE support unchanged. `netlify.toml` at the repo root configures the functions directory and `/api/v1/...` redirects to the underlying `/.netlify/functions/...` URLs; it does not touch how the static GitHub Pages frontend is built or deployed, which remains entirely separate and unchanged.

CORS: every Netlify function sets `Access-Control-Allow-Origin` (and answers `OPTIONS` preflight itself) so the browser on `https://bgullas.github.io` can call the functions despite being on a different origin.

### Background: why a static/generated QR alone can't acknowledge payment
PayNow has no general-purpose merchant webhook of its own. The only ways to get a real-time, programmatic payment confirmation are a bank's Corporate API (as mocked above) or a payment gateway with PayNow support sitting in front of it (HitPay, Xfers/StraitsX, NETSPay, 2C2P). Stripe does **not** support PayNow as of this writing.

### Security/compliance notes
- Webhook endpoint must verify the provider's signature (HMAC) — never trust an unauthenticated "payment succeeded" call. (Implemented in the sandbox.)
- Idempotency: a webhook can be retried/duplicated; dedupe on `transactionId` before crediting a unit. (Implemented in the sandbox.)
- PCI/MAS compliance is the gateway's responsibility, not ManAgeX's, as long as ManAgeX never touches card/bank credentials directly — keep it that way.
- Reconciliation: still run a daily settlement reconciliation job against the gateway's transaction export in production, since webhooks can occasionally be missed.

## GitHub Pages deployment

The demo runs entirely in the browser with no build step.

1. Push `index.html` and `resident-app.html` to the `main` branch
2. Go to **Settings → Pages → Deploy from branch → main / root**
3. Done — available at `https://{username}.github.io/managex/`
