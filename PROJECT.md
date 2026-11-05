# Vehicle, parking and account request demo

## Owner guide

This public portfolio demo uses generic company/site labels, generated parking diagrams, redacted vehicle identity fields and explicitly synthetic account examples. It contains no live backend integration. Browser data stays in localStorage; Reset data restores all sample records.

Run `npm install`, then `npm run dev`. The existing GitHub repository is the release target. Validate changes before pushing; publishing may trigger the repository's configured hosting integration.

Try **Vehicle → Search by Location** for parking details, diagrams and parked vehicles. Try **Uber** for email lookup and **New Application → Uber** for spreadsheet-style requests. The existing example account is `example.user@example.com` in Company A. Each submitted row is independently editable, approvable or rejectable. Representative, notification recipient and account holder are separate fields. Feishu delivery is unavailable; the application shows message previews only.

## Agent guide

Preserve the public Vehicle and parking implementation. Never copy internal exports, source fixtures, migration files, screenshots, credentials, tenant IDs or private history into this repository. Build privacy scan terms outside the repository; do not document actual private identifiers here.

- `client/src/platform`: browser runtime, fleet store and API bridge.
- `client/src/data/demo-dataset.ts`: generic fleet and parking fixtures and diagrams.
- `client/src/preview`: standalone Uber workflows with generic sample data.
- `source-schema.json`: generic account table headings only.
- `client/src/pages`: shared search, application, approvals and history UI.

Run `npm run typecheck`, `npm run lint`, `npm run build`. Check each route at desktop and 375px, parking diagram interactions, account batch submission, individual decisions, history and reset. Scan tracked source/docs plus build output for private data before release. Browser role switching is a demonstration feature, not security; all records shipped with this static demo must be safe for public access.
