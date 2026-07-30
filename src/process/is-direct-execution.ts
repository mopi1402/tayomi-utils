// The one direct-execution guard for every entrypoint: "was THIS module the one node was asked
// to run", which is the question each hook, CLI and gate asks before calling its main().
//
// It takes the URL as a PARAMETER rather than reading import.meta.url itself: that is what makes
// the function testable at all (a module cannot fake its own URL), and it keeps the guard's shape
// out of every module that merely imports it. A guard is TRUE inside an esbuild bundle, so a
// module that carries one and gets imported runs a second main() in the same process, and the two
// fight over stdin (commit 249da20 in the tayomi repo, a whole debugging session).
//
// WHY THE COMPARISON IS NOT THE OBVIOUS ONE. Two spellings were in the tree and both were wrong:
//
//   process.argv[1] === fileURLToPath(import.meta.url)
//   import.meta.url === `file://${process.argv[1]}`
//
// The first breaks under a SYMLINK. Node resolves the module URL to its real path but leaves
// argv[1] exactly as it was typed, so an invocation through a symlinked path compares a link
// against its target and main() never runs. Measured on a built bundle: `node dist/validate-spec.js
// --help` prints the usage, the same file reached through a symlink prints NOTHING and exits 0.
//
// The second breaks under a path that needs PERCENT-ENCODING, which needs no symlink to trigger: a
// space is enough. import.meta.url is encoded (`My%20Projects`), a template literal is not
// (`My Projects`), so the two are never equal. Measured: the same hook emits its envelope from a
// plain path and emits nothing from a directory whose name contains a space.
//
// Both failures are SILENT and identical in shape: no output, exit 0. For a hook that reads as
// neutral, and for a gate it reads as green, which is the worse half. Comparing real paths on both
// sides fixes both at once: fileURLToPath decodes the URL, realpathSync resolves the links.

import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Was the module identified by `importMetaUrl` the entrypoint node was invoked with?
 *
 * Pass `import.meta.url` from the calling module. Compares REAL paths on both sides, so a symlinked
 * invocation and a path needing percent-encoding both still count as direct execution (see the
 * header for the two bugs that motivated each half).
 *
 * Fail-safe to `false`: no argv[1], or a path that cannot be resolved, means we cannot confirm
 * direct execution, so main() does not run. Note the cost of that default, since it is a real
 * trade-off and not a free win: for a hook, not running is neutral, but for a verify gate it is a
 * silent exit 0, which reads as green. The fail-safe is kept because the throw it guards against is
 * a resolution error on the script node has already loaded (a deleted file, a permission race), and
 * treating that as "keep running" would be guessing about a filesystem we just failed to read.
 */
export function isDirectExecution(importMetaUrl: string): boolean {
  try {
    const invoked = process.argv[1];
    if (!invoked) return false;
    return realpathSync(invoked) === realpathSync(fileURLToPath(importMetaUrl));
  } catch {
    return false;
  }
}
