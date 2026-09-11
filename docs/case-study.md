# Case study: Vehicle & Parking Info

An internal fleet-administration app built on Feishu Spark (妙搭) for the transport team of a Hong Kong utility group. This document describes the production system; the public demo in this repository runs the same client code on a synthetic fleet with identifying fields redacted.

## 1. Context

The team maintained the company fleet record in an Excel "Fleet List" master with a macro-driven logbook, and a copy of it in a Feishu Bitable base. Any change to a vehicle (which department it belongs to, who coordinates it, where it parks, its status) arrived by email or chat, was typed into the Bitable draft table by an administrator, and later re-typed into the Excel master so the macro could produce the logbook rows. Looking up where a vehicle is parked meant opening the base, finding the row, then opening the linked parking-site record and its floor-plan attachment.

Scale, for the owner to fill: `[TO FILL: number of vehicles]` vehicles across `[TO FILL: number of sites]` parking sites, `[TO FILL: number of users]` staff who look things up, `[TO FILL: requests per month]` change requests a month.

## 2. What was built

Four screens, one shared registry of change types:

- **Search** — by plate (autocomplete after one character, whitelist of twelve vehicle fields, parking-site name and floor plans in the result card, a lightbox for the plans) or by parking site (site attributes such as height limit, car lift, allowed vehicle types, EV charging; floor plans and street views; the table of vehicles parked there, filterable by plate and department; a row click jumps back to plate mode). Admins additionally get a collapsible "Full Details" with the remaining fleet-list columns grouped as Registration / Financial / Equipment / Other.
- **New Request** — a cart. Pick a vehicle, pick a change type, the form adapts: field changes show Log-From (current value read live from the fleet record) and Log-To (candidates from the distinct values of that column, or the parking-site list, or free text); card re-issues and "Other" show a mandatory description instead. Drafts are stored server-side, editable, deletable, and submitted as one batch.
- **Approvals** (admin) — a two-column console: pending list on the left, details on the right with edit-history badge, attachment previews, Edit / Reject / Approve. A status bar above shows how many approved changes have reached their effective date but are not yet written back, with a drawer to review current vs. new value and execute the write-back.
- **After Approval** (admin) — "Fleet Record Updates": approved logbook rows whose date has arrived, select all, copy as six-column TSV in the exact order the Excel macro expects, mark complete. Below it "Follow-up": approved requests that need offline action (card re-issues, "Other"), checkbox to mark done. A hidden history icon opens the **Request Archive**: every non-draft request with plate / type / status / date filters, pagination, expandable detail with edit history.
- **My Requests** — the applicant's own submissions with status, comment and edit history. Admins can switch to this view with "View as regular user".

## 3. Architecture

```
React 19 + TypeScript client ── capabilityClient ──▶ Bitable plugin instances (Fleet List DRAFT, Parking Location & Map)
        │
        └── axiosForBackend /api ──▶ NestJS (Spark fullstack) ──▶ PostgreSQL (Drizzle): change_requests, logbook, administrators
                                          │
                                          ├──▶ Bitable write plugin (batchUpdateRecords) with read-back verification
                                          └──▶ platform file bucket (attachments)
```

See `docs/architecture.mmd` and `docs/data-model.mmd`.

The client reads the fleet and parking tables directly through the platform's capability client for search and autocomplete; everything that changes state goes through the API. The API is three NestJS modules — `change-requests` (draft lifecycle), `approval` (everything an admin does), `parking-locations` (reverse lookup) — sharing one TypeScript contract in `shared/api.interface.ts` and one change-type registry in `shared/change-types.ts`.

## 4. Data model

`change_requests` holds the whole request lifecycle in one row: type, vehicle (Bitable record id plus plate as the durable business key), Log-From / Log-To, effective date, remark, attachments (JSONB), status, approver, approval time and comment, `vehicle_synced_at`, `edit_history` (JSONB), `follow_up_completed_at`. `logbook` rows are generated on approval and carry their own `sync_status` for the Excel export. `administrators` is a one-column table of platform user ids.

The fleet record itself stays in Bitable. The app never copies it; it reads the columns it needs and writes back exactly one field per approved change.

## 5. Key decisions

**One registry, two booleans.** Every change type is a row in `shared/change-types.ts` with `writesLogbook` (does this change eventually go back to the Excel master?) and `syncsVehicleField` (does approval write the fleet record?). Field changes are true/true; "Remark on change" is true/false; card re-issues and "Other" are false/false. Module-load assertions enforce the invariants: a type that writes the fleet record must also write the logbook (otherwise Excel and Bitable silently diverge), must name its column, and a type with an unimplemented side-effect handler cannot be enabled. Before this, the same information lived in five places across client and server.

**Effective-date gating of the write-back.** Approval always records the decision and the logbook row, but only writes the fleet record if the effective date is today or earlier. Future-dated changes wait; a status bar counts approved-but-unsynced changes whose date has arrived, and the admin executes them from a drawer that shows the current value next to the new one.

**Write, read back, re-resolve.** A Bitable write is not trusted until the record is read back and the field equals the expected value. If the write fails or the check fails, the service re-resolves the record id from the plate (the base had been fully re-imported once, which regenerates every record id) and retries once. Failures throw; approval is a transaction, so a failed write-back leaves the request pending rather than "approved but nothing happened".

**Explicit failure over silent success.** The project had been bitten twice by silent no-ops (an empty plugin field mapping, a misread sync-status flag). Unregistered change types, unimplemented handlers and unavailable columns all throw with a message that names the fix.

**Test mode.** An environment flag restricts approval and write-back to whitelisted test plates during rollout; the client shows an amber banner and marks test rows in the export table so nobody copies them into the master.

**English display over Chinese storage.** Status values, Bitable option values and change-type ids are Chinese contract values shared with the base and the Excel macro. The UI is English; the single mapping exit is `client/src/data/labels.ts`, and stored values are never translated.

**Admin edits with history.** An admin can correct a pending request (type, values, date, remark) before approving; every edit appends a `{ editedAt, editedBy, changes[] }` entry that the applicant sees as an "Edited" badge with the diff.

## 6. Incidents worth remembering

- The parking link column in Bitable was named differently from what the mapper read; the extractor returned an empty string and the parking block always said "not linked". Three call sites named the column; they now share one name.
- In the sandbox the login guard lets anonymous calls through, so an empty user id reached a `user_profile` comparison and PostgreSQL returned `42846`. Admin checks now reject empty ids before any query.
- The platform refuses AI-initiated changes to Bitable plugin instances; field mappings are changed by hand in the plugin panel and verified against the projected schema, because a missing read field is indistinguishable from an empty value.

More in `docs/engineering-notes.md`.

## 7. Outcomes

`[TO FILL: time from request to fleet-record update before / after]`
`[TO FILL: admin hours per month saved on re-typing]`
`[TO FILL: number of requests processed since launch]`

## 8. What the public demo changes

Same page code, two replacements: the Feishu Spark runtime becomes a local shim (`client/src/platform/index.tsx`) that serves the capability calls from a synthetic fleet, and the NestJS API becomes an in-browser module (`client/src/platform/backend.ts`) that mirrors the services' rules over `localStorage`. Plates, sites, departments and people are placeholders; identifying and financial columns show a redaction bar; site images are labelled schematics; attachment upload states that it is unavailable. The original backend modules are kept in `reference/server/` as documentation.
