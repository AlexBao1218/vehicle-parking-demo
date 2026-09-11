# Vehicle & Parking Info — portfolio demo

A public demo of an internal fleet-administration app, originally built for a corporate transport team on **Feishu Spark (妙搭)**, Feishu's low-code full-stack platform. Staff look up a company vehicle by plate or by parking site, file change requests (department, coordinator, parking site, card re-issues) into a draft cart, and an admin console approves them, writes approved changes back to the fleet record on their effective date, exports logbook rows to the Excel master, and tracks offline follow-ups.

This public version is a standalone static SPA. **No company is named**, **the fleet is synthetic** (plates like `DEMO 101`, sites like `Parking Site 03`, placeholders for departments and people), **identifying and financial fields are redacted** behind explicit grey bars, and **platform-only features show a "Not available in public demo" state** instead of a fake substitute. The original production setup is described in [`docs/case-study.md`](docs/case-study.md).

See [PROJECT.md](PROJECT.md) for the owner handbook and the rules AI agents must follow when editing this repo.

## Screenshots

<!-- TODO: add screenshots after deploy
![Search by plate](docs/screenshots/search.png)
![Admin console](docs/screenshots/admin.png)
![After approval](docs/screenshots/after-approval.png)
-->

## What's real vs simulated

| Feature | Status | Notes |
|---|---|---|
| Search by plate, search by parking site, parked-vehicle table | **Real logic** | Runs over the bundled synthetic fleet; the same page code as production |
| Request cart: drafts, edit, delete, submit all | **Real logic** | Persisted in `localStorage` by an in-browser backend that mirrors the NestJS services |
| Admin console: approve / reject / edit with history, batch tabs | **Real logic** | Same change-type registry (`shared/change-types.ts`) decides what an approval does |
| Write-back to the fleet record on the effective date, sync drawer, sync status bar | **Real logic** | Writes into the synthetic fleet; the drawer shows current vs. new value |
| Fleet Record Updates (TSV copy for Excel), Follow-up list, Request Archive | **Real logic** | Clipboard copy works; archive filters and pagination are real |
| Admin "Full Details" on a vehicle | Partly redacted | Registration numbers, dates, prices, cost centres, vendors show the redaction bar |
| Parking site address, floor plans, street photos | Redacted | Address is a bar; images are labelled schematics so the grid and lightbox still work |
| Attachment upload on a request | Unavailable | The picker and previews work; files are not stored (explicit toast) |
| Feishu identity, admin table, test-mode whitelist | Simulated | The visitor is a fixed demo admin; `/approval-history` shows the applicant view |

Use **Reset data** in the top banner to restore the seeded state.

## Tech stack

- React 19 + TypeScript, Vite
- Tailwind CSS v4, shadcn/ui (Radix), lucide-react, framer-motion, sonner
- react-router-dom v7
- Deployed on Vercel as a static SPA (`vercel.json` rewrites all routes to `index.html`)

## Run locally

```bash
npm install
npm run dev      # http://localhost:4180
npm run build    # outputs to ./dist
```

Also available: `npm run typecheck` and `npm run lint`.

## Project layout

```
client/
├── index.html
└── src/
    ├── index.tsx              # entry: BrowserRouter + error boundary
    ├── app.tsx                # route table
    ├── platform/              # shim for the Feishu Spark runtime + in-browser backend
    │   ├── index.tsx          #   logger, capabilityClient, user, storage, axiosForBackend
    │   ├── backend.ts         #   every /api route, mirroring reference/server/modules
    │   ├── seed.ts            #   seeded requests and logbook rows
    │   └── store.ts           #   localStorage persistence + reset
    ├── data/
    │   ├── demo-dataset.ts    # synthetic vehicles and parking sites
    │   ├── labels.ts          # display-layer English mapping over stored contract values
    │   └── vehicle.ts         # Bitable record → whitelist mapping
    ├── components/            # Layout, Header, DemoBanner, Redacted, ui/
    ├── pages/                 # VehicleSearchPage, ApplicationPage, AdminPage, ApprovalHistoryPage
    └── lib/brand.ts           # naming + disclosure constants
shared/                        # api.interface.ts, change-types.ts (registry), format-logbook-date.ts
reference/server/              # original NestJS modules, kept as documentation (not built)
docs/                          # case study EN/ZH, diagrams, portfolio blurb, engineering notes
```

## Original production setup

The app ran inside a Feishu tenant on Spark: a React client, a NestJS API with PostgreSQL (Drizzle ORM) for requests, logbook and administrators, and Bitable plugin instances for the fleet list and parking-site tables. Approval wrote the new value back to the fleet table through a write plugin with a read-back check and a plate-based record-id re-resolution, generated a logbook row for the Excel master, and left card re-issues and "Other" requests in a follow-up queue. A test mode restricted approvals to whitelisted plates during rollout. Details in [`docs/case-study.md`](docs/case-study.md).
