# Integration lifecycle

1. Obtain an OpenAPI specification you are authorized to use. For an undocumented API, establish a verified contract first; do not invent an official API.
2. Run `c4c integrate <source> --name <name>` to save a snapshot, generate a Fetch SDK and Zod validators, and record hashes. The source is downloaded once, and the generator reads the local snapshot. Implicit external references and local generator configuration files are not used.
3. Write a small provider adapter outside `integrations/<name>/`. Keep provider-specific normalization, status mapping, provenance, pagination cursors, and application identifiers in this adapter.
4. Store anonymized real responses separately from generated code. Validate them with the generated Zod schemas and application invariants: filters must take effect, pagination must advance, updates must be retained, and an outage must be reported as an error rather than an empty result.
5. Run `c4c check <directory> --json` in your existing CI or scheduled job. Exit code `2` means the report needs review; exit code `1` means the check failed and cannot establish whether the integration has changed.
6. After review, run `c4c update <directory> --expect <candidateHash>`, then compile the consuming application, run fixture tests, and perform a limited live check. Use your normal GitHub tools to commit or open a PR. Keep live checks read-only.

## Using a generated SDK

```text
OpenAPI → c4c CLI → SDK + Zod
                         ↓
                  Provider adapter
                         ↓
              Application / Workflow SDK
```

Use `@c4c/core` when the application needs to attach a contract to a callable function. SDK generation works independently of this package.

## Limits and security

Specifications must be JSON OpenAPI 3.0.x or 3.1.x, with a maximum size of 10 MiB, a depth of 100, and 200,000 JSON nodes. Only local JSON Pointer references are supported. Invalid references and path-item references are rejected; dereference path-item references beforehand. YAML and WSDL have no automatic fallback.

HTTP sources must use public HTTPS URLs without credentials, query strings, fragments, or nonstandard ports. Downloads have a 15-second timeout and do not follow redirects. DNS addresses are validated in the HTTPS lookup used for the connection. Do not disable TLS verification or bypass authentication. CLI errors must not expose headers, environment values, or response bodies. Supply private specifications as local files. JSON examples may contain secrets, so review the specification before `git add`.

The generated SDK is limited to 50 MiB and 10,000 entries. Symlinks are prohibited inside the managed tree. Writes use a sibling lock file, `.<name>.c4c-lock`, created with `wx`. SDK and schema hashes are checked before an update and again after generation, before replacing the directory.

## Recovering from an interrupted update

Promotion uses two rename operations on the same filesystem: the existing directory becomes `<name>.c4c-backup`, then the staging directory takes its place. This is not a distributed transaction or a guaranteed crash-atomic swap. If the second rename fails normally, the update rolls back. If the process crashes, the backup and lock may remain. Inspect the snapshots, restore the intact one, and only then remove the stale lock. Do not delete backups automatically based on their age.

Keep running servers separate from the managed SDK directory during updates. Review, build, and commit the update before deploying the application through its normal process. Concurrent use on a shared network filesystem requires external coordination.

## What `check` cannot detect

An API can return HTTP 200 with different semantics, silently change a filter, break pagination, introduce a quota, or reject an expired key without changing its OpenAPI specification. Detect these cases with separate read-only provider contract tests and limited live checks. Generated Zod validators detect response shape mismatches; they cannot establish every semantic invariant. An unchanged specification does not establish that the data source is healthy.
