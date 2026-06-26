# ManAgeX — Managing Access Platform

> Smart property management and access control for Singapore managing agents

ManAgeX is a demo web application for managing agents (MAs) overseeing residential developments in Singapore. It covers access control, tenant management, management fee tracking, facility bookings, and PayNow payments — all in one platform.

The name **ManAgeX** reflects the platform's core purpose: **Managing Access** across properties, residents, visitors, and facilities.

---

## Live demo

| Portal | URL | Who uses it |
|--------|-----|-------------|
| **MA Portal** | `index.html` | Managing agent office, security team |
| **Resident App** | `resident-app.html` | Unit owners, tenants, sub-tenants |

> Hosted on GitHub Pages: **https://bgullas.github.io/managex/**

📋 **For the full, up-to-date feature inventory (including what's genuinely real vs. simulated), see [`docs/FEATURES.md`](docs/FEATURES.md).** The lists below cover the original core modules; FEATURES.md also covers the BluGraph/MA/Property hierarchy, Security module, MCST governance tools, renovation workflow, PayNow sandbox payments, and resident feedback/updates added since.

---

## Features

### MA portal (`index.html`)

#### Dashboard
- Live KPIs: unit count, active visitors, fee collection rate, facility occupancy
- Real-time access event feed (Gate A, Gate B, Car park)
- Pending approval queue (new tenants, car registrations, sub-tenants)
- Fee collection progress bar
- Per-facility occupancy overview

#### Owners & Tenants
- Full unit registry with owner and resident profiles
- Tabs: All units / Owners / Tenants / Pending approvals
- Bulk import via Excel template (see `assets/import-template.txt`)
- Individual add with ownership doc or tenancy agreement upload
- Sub-tenant relationships: Spouse, Child, Domestic Worker, Sub-tenant (Renting)
- Self-registration flow — tenants register via app, MA approves by email
- Email notification on approval/rejection

#### Management Fees
- 12-month payment calendar per unit (Paid / Partial / Overdue / Unpaid)
- Bulk email statements to all units
- Individual account view with statement generation
- Collection summary table with monthly rates
- Overdue reminders with one click

#### Access Control
- **Guest management** — pre-registered visitors with QR codes sent via SMS
- **Walk-in desk** — security console to register walk-in visitors and see expected guest directory
- **ANPR / Vehicles** — registered plate lookup with live API status, manual override
- **Access log** — filterable event log by gate, outcome, date, and identity

#### Facilities & Bookings
- Calendar view (Day / Week / Month toggle) with colour-coded bookings
- Occupancy summary per amenity with utilisation %
- Facility registry: capacity, booking rules, max slots per unit per month
- Supported facilities: Tennis courts, Pool, Karaoke room, Function rooms, Gymnasium, BBQ pits, Games room

#### Vehicle Registry
- Resident self-service registration with log card upload
- Configurable vehicle limit per unit (default: 2)
- MA approval workflow for each registration
- ANPR integration status per plate

#### Payments
- PayNow QR code generation per unit with UEN reference and month reference
- Payment history per unit
- Credit/debit card — placeholder (future Stripe integration)

#### Reports
- Fee collection (overall + per-unit, filterable by period)
- Facility utilisation (by amenity, period)
- Access control log with anomaly detection
- Overdue accounts
- Vehicle registry status
- Occupancy and tenant report
- Export to Excel / PDF, email delivery

---

### Resident app (`resident-app.html`)

- Home screen: fee status, active guest passes, activity feed, notices
- **Invite guests:** name + phone → QR pass sent via SMS; optional car plate → ANPR pass
- **Pay fees:** PayNow QR with UEN + reference code; payment history
- **Book facilities:** slot availability, upcoming bookings, cancel
- **My vehicles:** registered plates, status; add vehicle with log card upload
- **Profile:** household residents, add sub-tenants with relationship type

---

## ANPR API

ManAgeX exposes a REST API for ANPR camera systems to check plate access in real time.

```
POST https://api.managex.sg/v1/anpr/check
Authorization: Bearer {api_key}

{ "plate": "SJK4521T", "gate_id": "carpark-a", "property_id": "riviera-gardens" }
→ { "access": "granted", "reason": "pre_registered_guest", "unit": "#02-14" }
```

Full specification: [`docs/api-anpr.md`](docs/api-anpr.md)  
Tested with: Hikvision DS-2CD2T47G2-L, Dahua IPC-HFW3849S-AS-PV

---

## File structure

```
managex/
├── index.html               ← MA portal (full admin app + BluGraph/MA hierarchy views)
├── resident-app.html        ← Resident mobile app
├── README.md
├── docs/
│   ├── FEATURES.md          ← Full feature inventory — what's real vs. simulated
│   ├── architecture.md      ← System design, data model, production roadmap
│   └── api-anpr.md          ← ANPR REST API specification
├── assets/                  ← Shared client JS (app-state, app-utils, paynow-sandbox) + import template
├── server/                  ← PayNow sandbox backend for local dev (Node, SSE)
├── netlify/functions/       ← Same PayNow sandbox backend, deployed (Netlify Functions + Blobs)
└── shared/                  ← Bank-simulation/SGQR/HMAC/CORS logic shared by both backend copies
```

See [`docs/FEATURES.md`](docs/FEATURES.md) for what each module actually does.

---

## Deploy to GitHub Pages

1. Fork or push this repo to GitHub
2. Go to **Settings → Pages**
3. Set source: **Deploy from branch → main → / (root)**
4. Visit `https://{username}.github.io/managex/`

No build step required. The demo is fully self-contained HTML.

---

## Production roadmap (AWS)

| Component | Technology |
|-----------|-----------|
| Frontend | React / Next.js → CloudFront + S3 |
| API | Node.js + TypeScript → API Gateway + Lambda |
| Database | PostgreSQL → RDS Multi-AZ |
| File storage | Log cards, docs → S3 + presigned URLs |
| Auth | Cognito (MA staff) + OTP (residents) |
| SMS | Twilio (QR pass delivery) |
| Email | SendGrid (statements, reminders) |
| PayNow | PayNow SGQR / UEN push API |
| Card payments | Stripe (Phase 2) |
| ANPR API | Lambda + API Gateway + Redis hot-cache |

See [`docs/architecture.md`](docs/architecture.md) for full design.

---

## Singapore-specific features

- **PayNow** UEN-based QR payments — scan with any Singapore banking app (DBS, OCBC, UOB, Maybank, etc.)
- **ANPR** integration tested with cameras common in Singapore condominiums
- **GeBIZ / government procurement** compatible tenant and asset registry
- Designed for **MCST** (Management Corporation Strata Title) structures
- Supports **FIN / NRIC / passport** ID for visitors and residents
- **SVY21 / EGM2008** references available in property metadata (for integration with URA/SLA data)

---

## Contributing

This is a demo / prototype. For production development enquiries, open an issue or contact the maintainer.

---

## Licence

MIT — free to use, adapt, and deploy.
