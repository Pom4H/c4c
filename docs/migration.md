# Migrating from the c4c runtime to Workflow SDK

## Migration scope

Workflow SDK replaces the custom c4c engine while preserving workflows around typed tools. Core and code generation remain small, independently usable packages. Workflow execution uses native SDK functions.

Version 0.1 is preserved in the [archive/v0.1 branch](https://github.com/Pom4H/c4c/tree/archive/v0.1). Version 0.2 retains code generation snapshots and the integration review process. The runnable example is in [`examples/workflows`](../examples/workflows/README.md). It uses the native SDK and requires migration from the old interpreter; it is not a drop-in compatibility layer.

| Previous implementation | Replacement |
|---|---|
| Procedure contract and handler | Callable `define()` tool with `.contract` |
| Custom workflow runner | `use workflow` and `start()` from Workflow SDK |
| Runtime node dispatch | Named `use step` functions that call the same tools |
| Custom queue, timers, and replay | SDK runtime and the selected World |
| Custom hooks and resume | `defineHook`, a schema, and `.create()` / `.resume()` |
| Custom execution log and visualizer | `workflow inspect`, `workflow web`, and Vercel observability |
| Implicit registry | Explicit tool set and contract introspection |

## Migrating an application from 0.1

1. Preserve domain input/output contracts and call permissions. Extract each handler into an ordinary function.
2. Put I/O in an explicit, statically declared `use step` function.
3. Move sequencing, branching, parallelism, and waits into `use workflow`.
4. Validate identity, scopes, and signatures in event handlers before resuming a typed hook.
5. Choose Vercel World or Postgres World with a long-lived server. Use the official bootstrap to manage the runtime schema.
6. Verify start, status, approval, cancellation, restart recovery, and side-effect idempotency on the selected backend.
7. Finish existing runs with the old engine, or migrate them through explicitly recorded business checkpoints. The SDK cannot read the 0.1 execution log or automatically replay its runs.

Verify application-specific behavior with that application's tests, including existing triggers, authorization policies, artifacts, and UI. The example demonstrates the integration structure; it does not establish functional parity for every application built on 0.1.

## Integration lifecycle compatibility

`c4c integrate`, `c4c check`, and `c4c update` retain their snapshots, pinned generator, protection for hand edits, and `--expect <candidateHash>` review requirement. Generated SDKs remain independent of c4c.

A workflow can prepare a review and wait for a decision. Apply the actual integration update through a separately authorized CI job or CLI command with the same hash check. Do not write generated source files into a Vercel function's filesystem.
