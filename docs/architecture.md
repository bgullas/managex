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

## GitHub Pages deployment

The demo runs entirely in the browser with no build step.

1. Push `index.html` and `resident-app.html` to the `main` branch
2. Go to **Settings → Pages → Deploy from branch → main / root**
3. Done — available at `https://{username}.github.io/managex/`
