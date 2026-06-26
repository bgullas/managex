# ManAgeX — Feature Reference

This is the single reference for **what exists in this project right now**, organized by area, with an explicit call-out of what's genuinely real vs. what's simulated for demo purposes. Architecture/production roadmap lives in [`architecture.md`](architecture.md); this doc is the feature inventory.

Live demo: **https://bgullas.github.io/managex/** (MA portal) and **https://bgullas.github.io/managex/resident-app.html** (resident app).

---

## 1. Platform hierarchy (BluGraph → MA company → Property)

Simulated entirely client-side in `assets/app-state.js` (`platform` object) — **no real authentication or data isolation between browsers**, by deliberate agreement, since this stays a static GitHub Pages demo. A role switcher in the sidebar (`#role-switcher`, calls `switchRole()`) flips between three shells:

| Role | What it shows | Key functions (`index.html`) |
|------|----------------|-------------------------------|
| **BluGraph (Super Admin)** | Platform-wide KPIs (MA companies, total properties, total units, active MAs); a card per MA company with module-enabled badges (Residents/Operations/Governance/Finance) that are actually toggleable; drill-down into each MA's property list | `renderBluegraphDashboard()`, `toggleMaModule(maId, module)`, `viewMaCompanyProperties(maId)` |
| **MA Company** (e.g. Frontline) | Editable company name/contact email, logo upload (FileReader → dataURL, same pattern as the PayNow QR upload), default module toggles for properties under this MA, property list table | `renderMaCompanyDashboard()`, `handleMaLogoUpload()`, `saveMaCompanyDetails()` |
| **Property MA Office** | The full operational app below (everything in sections 2–7) | unchanged — this is "today's app" |

**Seed data**: 3 MA companies (Frontline Property Management, Harbourfront Estate Management, Greenview Facilities Pte Ltd), 5 properties total. **Only Riviera Gardens has full operational data** — the other 4 properties (Marina Breeze Residences, Orchard Heights, etc.) are shallow stubs (name/address/units/status only) used to populate the BluGraph/MA-level lists. Switching the property selector to one of them shows a toast and stays on Riviera Gardens — full per-property data partitioning was explicitly out of scope for this pass.

---

## 2. MA Portal (`index.html`) — full page list

| Page (NAV id) | What it does |
|---|---|
| `dashboard` | KPIs, live access event feed, pending approvals, fee collection summary, facility occupancy, **upcoming contract renewals widget** |
| `tenants` | Unit/owner/tenant registry, sub-tenant relationships, approve/reject pending registrations, Excel import simulation |
| `vehicles` | Vehicle registry, ANPR approval workflow |
| `access` | Guest management, walk-in registration desk, ANPR vehicle passes, filterable access log |
| `security` | **New.** Read-only security staff dashboard: today's visitors, scheduled contractors, approved renovation works on-site |
| `facilities` | Booking calendar (day/week/month), occupancy analytics, facility registry with per-unit slot limits |
| `maintenance` | Repair/work-order ticketing (kanban-style: Open / In progress / Resolved) |
| `renovations` | **New.** Resident renovation requests — approve/reject, print, feeds the Security page once approved |
| `announcements` | MA-posted notices board, targetable by tower/unit |
| `documents` | Document repository (by-laws, insurance certs, etc.) |
| `polls` | AGM e-voting / activity polls — see §4 |
| `parcels` | Parcel/delivery logging and collection tracking |
| `vendors` | Vendor/contractor registry with **contract value, renewal terms, uploaded contract doc, renewal history, print** |
| `feedback` | **New.** Resident feedback/complaints review queue |
| `governance` | **New.** Glanceable compliance overview — AGM deadline countdown, contracts renewing soon, minutes display-window status, open polls |
| `minutes` | **New.** Meeting minutes register with BMSMA Sch. 2 14-day mandatory display tracking |
| `quotations` | **New.** Quotation/tender tracker per work item, with a non-blocking "consider more quotes" nudge above $3,000 with <3 quotes |
| `council` | **New.** Council members registry, validates Chairman/Secretary/Treasurer office-bearers are filled |
| `fees` | 12-month fee calendar per unit, collection reports |
| `payments` | PayNow QR (generated or MA-uploaded image), payment history, **sandbox dynamic-QR generation** (§5) |
| `reports` | Generated reports (collection, access, utilisation, etc.) with CSV export |
| `settings` | PayNow QR setup (generate vs. upload), demo data reset |

## 3. Resident App (`resident-app.html`) — full screen list

| Screen (`view-` id) | What it does |
|---|---|
| `home` | Fee status hero, active guest passes, recent activity, latest announcement |
| `guests` | Invite guests (real QR generation), vehicle/ANPR pass |
| `payment` | Pay management fee via PayNow (sandbox dynamic QR with live/polled status, falls back to client-generated QR if sandbox backend is offline) |
| `book` | Facility booking with conflict checking |
| `vehicles` | Registered vehicles, add vehicle (2-vehicle cap enforced) |
| `profile` | Household residents, sub-tenants |
| `renovation` | **New.** Submit a renovation request (work description, contractor, dates, document upload) → MA approval queue |
| `feedback` | **New.** Submit feedback/complaint (category, message) |
| `services` | **New.** Static directory — MA office hours, emergency contacts, essential contractors |
| `updates` | **New.** Live weather from `api.data.gov.sg` (real public API call, see §6) + illustrative municipal announcements (clearly labeled) |

---

## 4. Governance module (BMSMA-aligned)

Built to reflect actual Singapore Building Maintenance and Strata Management Act (BMSMA) practice, not just generic "polls":

- **Meeting Minutes Register** — tracks the BMSMA Second Schedule requirement that minutes be displayed for ≥14 days; each record shows *Displaying* / *Display period complete* / *Not yet posted*.
- **Quotation/Tender Tracker** — logs multiple quotes per work item; shows an informational (never blocking) nudge to obtain more quotes when a work item is above a configurable threshold (default $3,000) with fewer than 3 quotes logged.
- **Council Members Registry** — flags if any of the BMSMA-relevant office-bearer roles (Chairman/Secretary/Treasurer) is unfilled.
- **AGM Compliance Tracker** — countdown to the 15-month statutory AGM deadline (BMSMA), with overdue/approaching/compliant status.
- **Polls** carry a `category` (AGM Resolution / Council Decision / Community Activity) and, for AGM Resolutions, a `resolutionType` (Ordinary >50% / Special ≥75%) with automatic pass/fail computed against real vote counts. The MA can record **proxy votes** on behalf of units that didn't vote electronically, shown separately from direct votes in the results breakdown.

## 5. PayNow sandbox payment backend

Full detail in [`architecture.md`](architecture.md#paynow-payment-integration--sandbox-implementation) — summary:

- **Real**: HMAC-SHA256 webhook signature verification (rejects forged calls with 401), idempotency on `transactionId`, strict intent/webhook separation (client can never set `paid` directly), the EMVCo SGQR payload (TLV + CRC16) built server-side.
- **Mocked**: there is no real bank — `mockBank.createDynamicQR()` invents the QR/reference locally, and a sandbox-only "simulate paying in my banking app" button stands in for an actual resident scan.
- **Deployed live** at `https://managex-paynow-sandbox.netlify.app` (Netlify Functions + Netlify Blobs) — the public GitHub Pages demo talks to this directly over HTTPS. A second copy runs locally (`server/index.js`, plain Node, full SSE) for local dev. Both share the same `shared/mockBank.js` logic so they can't drift apart. The frontend (`assets/paynow-sandbox.js`) auto-falls-back from SSE to polling when talking to the serverless deployment, and falls back further to a pure client-generated QR if the sandbox backend is unreachable at all.

## 6. Resident "Updates" — real public API integration

The Updates screen in `resident-app.html` makes a genuine `fetch()` to `https://api.data.gov.sg/v1/environment/2-hour-weather-forecast` (no API key required, public Singapore government endpoint) and renders the live forecast for Bishan. This is explicitly labeled "Live data from api.data.gov.sg — real public API, not simulated" in the UI. If the fetch fails (network/CORS/API changes), it falls back to a static placeholder rather than breaking the page. The municipal-announcements section below it is static/illustrative content, explicitly labeled "(Illustrative)" — not a real feed.

## 7. Renovation request workflow

1. Resident submits a request (`resident-app.html` → `view-renovation`) — work description, contractor name/contact, proposed dates, optional supporting document upload.
2. Lands in `renovationRequests` (MX state) with status `Pending review`, visible on the MA portal's `renovations` page.
3. MA approves or rejects (same visual pattern as the existing Owners & Tenants approval queue). Both the request and the approval outcome have a **Print** button.
4. Once approved, the work automatically appears in the **Security Dashboard**'s "Approved renovation works on-site" list — pending requests are never visible to security, only approved ones.

This full pipeline (submit → approve → appears in Security) has been manually tested end-to-end in a live browser session.

## 8. Print support

`MXUtil.printRecord(title, html)` in `assets/app-utils.js` opens an isolated, black-on-white print window (independent of the app's dark theme) and triggers `window.print()`. Wired to:
- Guest visitor pass
- Vendor contract record
- Council meeting minutes entry
- Quotation / work item record
- Renovation request (both the request and the approval outcome)

---

## What's real vs. simulated — quick reference

| Area | Real | Simulated |
|---|---|---|
| Multi-tenant hierarchy | Data model, role switcher, module toggles, drill-down | No real auth, no per-property data isolation (only Riviera Gardens has full data) |
| PayNow payments | HMAC verification, idempotency, SGQR payload construction, live Netlify deployment | The "bank" itself; the resident's "scan and pay" step (sandbox button stands in for it) |
| Governance / BMSMA features | Threshold math (resolution pass/fail), 14-day display-window calculation, AGM deadline countdown — all computed against real dates/data you enter | The underlying records are demo seed data, not connected to an actual MCST's real minutes/AGM history |
| Resident weather feed | Live `fetch()` to a real public Singapore government API | Municipal announcements card (clearly labeled illustrative) |
| Renovation/feedback workflows | Full submit → approve → downstream-visibility pipeline | No real document storage (files become local dataURLs, not uploaded anywhere) |
| Everything else (tenants, vehicles, facilities, fees, reports, etc.) | Full client-side CRUD against localStorage | Demo seed data; no server-side persistence or multi-device sync |

## Known limitations

- Single-browser, single-device data only (localStorage) — nothing syncs across devices/browsers.
- No real authentication anywhere — the role switcher and property selector are unguarded UI state.
- File uploads (contract docs, renovation supporting docs, logos) are stored as base64 dataURLs in localStorage, not uploaded to real storage — fine for a demo, will hit localStorage size limits with many/large files.
- Only one property (Riviera Gardens) has a fully populated operational dataset.
- `server/` (local PayNow sandbox) and the deployed Netlify Functions version must be kept in sync manually if `shared/mockBank.js` changes — they already share that file, so this is low-risk, just worth knowing.

## Where to look in code

| Concern | File(s) |
|---|---|
| Shared state/store | `assets/app-state.js` |
| Shared utilities (toast, QR, validators, print) | `assets/app-utils.js` |
| MA portal | `index.html` |
| Resident app | `resident-app.html` |
| PayNow sandbox client | `assets/paynow-sandbox.js` |
| PayNow sandbox backend (local dev) | `server/` |
| PayNow sandbox backend (deployed) | `netlify/functions/`, `netlify.toml` |
| Shared bank-sim/SGQR/HMAC/CORS logic | `shared/` |
| System design / production roadmap | `docs/architecture.md` |
| ANPR API spec | `docs/api-anpr.md` |
