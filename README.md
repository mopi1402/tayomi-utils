# @tayomi/utils

Process-edge Node primitives, consumed by the TAYOMI framework and by `@tayomi/cc-views`
as a regular npm dependency. Built inside the tayomi workspace for now; the target shape
is an autonomous package in its own repository (the workspace is the construction site,
not the owner).

## Charter (what earns an entry here)

Every function in this package exists to **retire a cross-boundary clone**: the same code was
maintained in two or more packages that may not import each other (layering rule
`no-sibling-plugin-import`), and drifted-copy risk is the whole reason this package exists.
Concretely:

- **Tiny, dependency-free, Node-only.** A primitive an entrypoint needs at the process edge.
  Anything with a domain (TAYOMI's wire formats, specs, gate vocabulary) does NOT belong here.
- **No module-level state, no side effect at import** (`sideEffects: false` is a promise, not
  an optimization flag).
- **No main(), ever.** A module carrying a self-exec guard must never be imported
  (one-main-per-process, commit 249da20).
- Each function carries the *why* of its existence: the incident or the clone it retired.

Not a junk drawer: a helper that only one package uses lives in that package.

## Import contract

Two doors, both stable; the file layout underneath is neither:

```ts
import { isDirectExecution } from '@tayomi/utils';          // the root barrel
import { readStdinSync } from '@tayomi/utils/io';           // a domain subpath
```

A domain is born with its first function, never empty. Current domains:

| Domain | Contents |
| --- | --- |
| `process` | `isDirectExecution` (the entrypoint guard: real paths on both sides) |
| `io` | `readStdin`, `readStdinSync`, `parseStdin` (the stdin kit: TTY guard, joined-buffer decode, EAGAIN-as-not-yet); `stringField` (the payload interrogation every hook edge retypes) |
| `ansi` | `sgr`, `RESET`, `BOLD`, `DIM` (one-line notice styling; anything richer is @tayomi/cc-views) |
