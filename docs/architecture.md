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

### MA Portal (index.html)
| Module | Purpose |
|--------|---------|
| Dashboard | Live KPIs, access events, pending approvals |
| Owners & Tenants | Unit registry, sub-tenant relationships, approval queue |
| Management Fees | 12-month payment calendar per unit, collection reports |
| Access Control | Guest management, walk-in desk, ANPR log, security override |
| Facilities | Booking calendar (day/week/month), occupancy analytics |
| Vehicle Registry | Log card upload, approval workflow, ANPR status |
| Payments | PayNow QR generation, payment history |
| Reports | Collection, access, utilisation, overdue accounts |

### Resident App (resident-app.html)
| Screen | Purpose |
|--------|---------|
| Home | Greeting, fee status, active guests, recent activity |
| Guest access | Invite guests, issue QR pass, vehicle pass (ANPR) |
| Payments | PayNow QR, fee history |
| Book facility | Slot availability, upcoming bookings |
| Vehicles | Registered plates, add vehicle (log card upload) |
| Profile | Household residents, sub-tenants, account details |

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
└── server/                 ← Sandbox PayNow Corporate API + webhook backend (Node, mocked bank)
```

## Demo vs production differences

| Aspect | Demo (GitHub Pages) | Production (AWS) |
|--------|--------------------|--------------------|
| Data | Hardcoded sample data | PostgreSQL RDS |
| Auth | None | Cognito + JWT |
| Files | Not functional | S3 + presigned URLs |
| PayNow | Sandboxed mock Corporate API + webhook (`server/`), falls back to static/generated QR if backend offline | Real bank Corporate API or gateway SDK |
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

### GitHub Pages limitation
`https://bgullas.github.io/managex/` is static HTTPS hosting and cannot run the Node backend in `server/`. To see the sandbox flow working, run `node server/index.js` locally and view the frontend via `localhost` rather than the GitHub Pages URL — both index.html and resident-app.html show a "Sandbox backend online/offline" indicator near the Payments UI and fall back to the existing pure client-side QR generation whenever the backend isn't reachable, so the deployed demo keeps working exactly as before for anyone without the local server running. Making this reachable from the live GitHub Pages site for everyone would require deploying the backend with HTTPS (Render/Fly/AWS) — not done here; that's a separate, explicit decision.

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
