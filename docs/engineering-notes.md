# Engineering notes from the original build (scrubbed)

Incidents and rules recorded during the production build on Feishu Spark. Identifiers, table ids and plates are removed; the lessons are kept.

## Plugin instances cannot be changed by the agent (2026-09)

The platform refuses `UPDATE` calls on Bitable plugin instances from the AI tool with "may have side effects on external systems". Retrying or hand-editing the capability JSON is not allowed either. Field mappings must be changed in the plugin panel by a human; afterwards, confirm the projected `outputSchema` shows the new field. A missing read-side field does not error and is indistinguishable from an empty value, so always verify against the schema, never against the data.

## Draft storage moved from Bitable to PostgreSQL (2026-08)

Drafts and requests were first stored in a Bitable "Change Requests" table through plugin calls from the client. That made the request cart slow, exposed write scopes to the browser, and made edit history impossible. They moved to a `change_requests` table (Drizzle) behind `server/modules/change-requests/`, attachments moved to the platform's file bucket with the download URL stored in the row, and the client switched to `crApi.*`. The six legacy plugin instances stayed registered but unused; the platform's pre-commit "plugin link check" flags them as unreferenced, which is a false positive.

## Parking link field name mismatch

Symptom: after a plate search the parking block always said "no parking location", even for vehicles with a linked site. Root cause: the Bitable link column was named differently from what the mapping function read, so the extractor returned an empty string and the parking fetch was skipped. Fix: align the three places that name the column (record mapper, search `fieldNames`, cache-restore `fieldNames`). Bonus fix: restoring the cached vehicle used a full-table `searchRecords` to find one row; replaced with `getRecord({ recordID })`.

## Test-data rules (owner-mandated, order is not negotiable)

1. **Restore first, delete second.** Before deleting test logbook rows or requests, restore the fleet-table fields they changed, using `log_from` from the same test's logbook rows (or the baseline read before the test) as the source of truth, and paste the read-back values. Never delete records first: `log_from` is the only restoration evidence.
2. **Baseline before each round.** Read and record the current value of every field the test will touch. Do not rely on memory or the previous conversation.
3. **Fictional plates for request tests.** Application-flow tests use invented plates. Only tests that must verify the fleet-table write-back use the whitelisted test vehicle from `.env`.
4. **When the original value is unknown**, say so and ask the owner to check the Excel master. Do not guess.

## Anonymous requests to admin endpoints returned 500 instead of 403 (2026-09)

In the sandbox the `@NeedLogin` guard does not block anonymous calls, so an empty `userId` reached a `user_profile` equality comparison and PostgreSQL raised `42846 Input has too few columns` (`ROW()::user_profile`). Fix: `requireAdmin` rejects an empty or blank user id with `ForbiddenException` before any query; any later `user_profile` comparison must check non-empty first.

## English display layer over Chinese contract values (2026-09)

The UI is English, but the stored values and the Bitable contract are Chinese (`草稿` / `待审批` / `已批准` / `已拒絕`, `有限高` / `無限高`, the change-type ids). The only mapping exit is `client/src/data/labels.ts` (`getStatusLabel`, `getParkingValueLabel`). Never translate stored values, only their rendering.

## Admin page structure

`/admin` has two tabs, Approvals and After Approval. The vehicle-sync comparison list lives in a drawer opened from the sync status bar; the request archive is a drawer opened from a history icon next to the tabs. There is no standalone `/archive` route.
