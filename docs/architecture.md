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
└── assets/                 ← Logos, icons (future)
```

## Demo vs production differences

| Aspect | Demo (GitHub Pages) | Production (AWS) |
|--------|--------------------|--------------------|
| Data | Hardcoded sample data | PostgreSQL RDS |
| Auth | None | Cognito + JWT |
| Files | Not functional | S3 + presigned URLs |
| PayNow | Static QR display | PayNow API (UEN push) |
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

## Real PayNow payment integration (not implemented in the demo)

The demo's Payments page only **displays** a PayNow QR (either generated from a UEN/amount/reference, or a static image the MA uploads in Settings). Scanning it opens the resident's own banking app to initiate a transfer — but nothing reports back to ManAgeX. There is no backend, so "Record payment" today is a manual, trust-based action by the MA. Below is what production would need to actually confirm and acknowledge a transaction.

### Why a static/generated QR can't acknowledge payment
PayNow has no general-purpose merchant webhook. The only ways to get a real-time, programmatic payment confirmation are:

1. **Bank PayNow Corporate API** — DBS, OCBC and UOB each expose a corporate API that lets a registered business generate a **dynamic** QR per transaction (amount + unique reference baked in) and receive a callback/webhook when it's paid. Requires a corporate bank account, API onboarding, and usually a annual/per-transaction fee.
2. **Payment gateway with PayNow support** — HitPay, Xfers/StraitsX, NETSPay, or 2C2P sit in front of the bank APIs, handle KYC/compliance, generate the dynamic QR, and fire a webhook to your server on payment. This is the realistic path for a multi-property SaaS — it avoids negotiating bank API access per managing agent's bank.

Stripe does **not** support PayNow as of this writing — it is not a viable option for this market.

### Required backend flow
```
1. MA portal calls  POST /v1/payments/intent  { unit_id, amount, period }
2. Backend calls gateway API → creates a dynamic QR tied to a unique reference
3. QR returned to client, rendered (replaces the client-side generated/static QR)
4. Resident scans, pays via their banking app
5. Gateway → POST /v1/webhooks/payment  (signed payload: reference, status, amount, txn_id)
6. Backend verifies webhook signature, marks the unit's fee record as paid in PostgreSQL
7. Backend pushes a real-time update to the MA portal (WebSocket/SSE) and resident app
8. Receipt emailed via SES/SendGrid
```

### Security/compliance notes for this flow
- Webhook endpoint must verify the gateway's signature (HMAC) — never trust an unauthenticated "payment succeeded" call.
- Idempotency: a webhook can be retried/duplicated; dedupe on `txn_id` before crediting a unit.
- PCI/MAS compliance is the gateway's responsibility, not ManAgeX's, as long as ManAgeX never touches card/bank credentials directly — keep it that way.
- Reconciliation: still run a daily settlement reconciliation job against the gateway's transaction export, since webhooks can occasionally be missed.

## GitHub Pages deployment

The demo runs entirely in the browser with no build step.

1. Push `index.html` and `resident-app.html` to the `main` branch
2. Go to **Settings → Pages → Deploy from branch → main / root**
3. Done — available at `https://{username}.github.io/managex/`
