# c4c 0.2

Preserve the small boundary: typed callable contracts + dev-time integration lifecycle. Read README.md and docs/migration.md before changing architecture.

Two independent packages. Core has no runtime dependencies. CLI emits standalone Fetch/Zod code through the pinned upstream generator. Never parse generated TypeScript with regex or synthesize a pretend-valid schema. Do not restore a workflow runtime, global procedure registry, UI, auth manager or background daemon to solve a caller's problem.

`check` is read-only: exit 0 unchanged, 2 review needed, 1 unable to check. Never hide outages as success. Updating requires the reviewed hash, preserves the previous integration on generation failure and refuses to erase hand edits. Structural drift is not a proof of compatibility. No automatic deployment/auto-merge of a changed upstream API.

Run `npm run check` and `npm run test:codegen`. The latter uses the real generator and mocked HTTP, not a live provider. Tests use only synthetic fixtures. No browsers, DB services or model downloads in CI. Keep tokens out of logs/artifacts/specs. Version 0.2 is not published to npm by this change.

Old implementation is retained in archive/v0.1, not alongside the new core.
