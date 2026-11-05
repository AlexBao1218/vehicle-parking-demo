# Integration verification

Verified locally on 2026-11-05:

- TypeScript typecheck and production build pass. ESLint reports no errors (five pre-existing warnings in Vehicle components).
- Search, application, approvals and applicant history checked at 1440px and 375px; fixed header wrapping and the existing fixed-width change-type selector. Both Vehicle and Uber forms fit 375px.
- Parking site details, parked vehicles and enlarged schematic render successfully.
- Excel paste creates multiple rows; two rows submit together and can be independently approved, edited or rejected.
- Change mode accepts email plus one changed field; administrator detail keeps all 14 original fields. Public request projection omits original account values and edit history.
- Combined archive includes Vehicle and Uber requests. Reset removes both stores. No browser page errors during the route and workflow checks.
- Known private identifiers from source fixtures were scanned across tracked source, documentation and build output with no matches. Internal fixtures, migrations, credentials, exports and history were not copied.

This is a static public demonstration, not a production security boundary or live Feishu integration. Historical commits of the existing public repository were not rewritten.
