// The stdin kit for a process edge: reading the payload a runner piped in, which is the ONE thing
// an entrypoint does before it does anything else. Three guarantees, each paid for:
//
//   1. A TTY IS GUARDED. `for await` on a TTY stdin never ends, so without the guard a hand-run
//      entrypoint hangs instead of falling back to its defaults.
//   2. BYTES BECOME TEXT ONCE. The naive `raw += chunk` decodes each chunk on its own, so a
//      multi-byte character split on a chunk boundary is destroyed. Measured, cutting through an é:
//        expected  "résumé: écrit à côté"      raw += chunk  "r??sumé: écrit à côté"
//      Only decoding over the joined buffer cannot split a character, and what flows through an
//      edge is human prose: accents, dashes, emoji.
//   3. EAGAIN MEANS "NOT YET", NEVER "NOTHING" (sync form). See readStdinSync.

import { readSync } from 'node:fs';
import { isatty } from 'node:tty';

/**
 * The whole of stdin as UTF-8, or '' when there is no pipe. Decodes ONCE over the joined buffer,
 * never per chunk, so a multi-byte character straddling a chunk boundary survives.
 */
export async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return '';
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}

/**
 * How long a read tolerates a writer that has not written yet, across EAGAIN retries only. A
 * blocking fd never spends it (the read simply waits), so this bounds exactly one situation: a
 * NON-BLOCKING fd 0 whose writer is still starting up. Bounded rather than infinite because a hook
 * that hangs is worse than a hook that falls back to neutral, and generous relative to the
 * milliseconds a hook runner takes to write a payload.
 */
const EAGAIN_BUDGET_MS = 2000;

/** Synchronous pause, the only form available without an event loop turn. */
function pauseSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * The whole of stdin as UTF-8, synchronously, or '' when there is no pipe or the read fails.
 *
 * The sync form exists because many edges are sync from end to end (they decide and process.exit),
 * and making them async only to read stdin would put an await between the payload and the exit for
 * nothing.
 *
 * Returns '' rather than throwing on a failed read, so a caller never has to distinguish "no
 * payload" from "unreadable payload": both mean the same thing to an edge, which is that it has
 * nothing to act on and must fall back to neutral.
 *
 * TWO DEFECTS OF THE PREVIOUS FORM, one cause. It guarded on `process.stdin.isTTY` and then called
 * readFileSync(0), and TOUCHING `process.stdin` is what broke the read it was guarding: constructing
 * that stream puts fd 0 in NON-BLOCKING mode, so the read raised EAGAIN whenever the writer had not
 * written yet, the catch turned that into '', and the edge fell back to neutral without a word.
 * Measured on a built hook: a writer 50 ms late made it read 0 bytes and exit 0 SILENTLY where an
 * immediate writer had it read 95 bytes and exit 2. Nothing was reported, which is what makes the
 * class dangerous: every gate on this kit is one slow writer away from passing a turn it never
 * examined.
 *
 * So the TTY test is `isatty(0)`, which asks the fd and never constructs the stream, and the read
 * is a loop that treats EAGAIN as "not yet" instead of as "nothing", within a budget. The loop is
 * also what makes the fix hold when fd 0 arrives non-blocking from the PARENT, which no discipline
 * of ours can prevent.
 *
 * Reads into chunks and decodes ONCE over the joined buffer, never per chunk, so a multi-byte
 * character straddling a read boundary survives (the guarantee this module exists to keep).
 */
export function readStdinSync(): string {
  if (isatty(0)) return '';
  const chunks: Buffer[] = [];
  const buf = Buffer.allocUnsafe(64 * 1024);
  const deadline = Date.now() + EAGAIN_BUDGET_MS;
  for (;;) {
    let read: number;
    try {
      read = readSync(0, buf, 0, buf.length, null);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      // EAGAIN: a non-blocking fd with nothing available YET. EINTR: a signal cut the read.
      if ((code === 'EAGAIN' || code === 'EINTR') && Date.now() < deadline) {
        pauseSync(2);
        continue;
      }
      break; // anything else (or the budget spent): fail open on what was already read
    }
    if (read === 0) break; // EOF: the writer closed its end
    chunks.push(Buffer.from(buf.subarray(0, read)));
  }
  return Buffer.concat(chunks).toString('utf8');
}

/**
 * The payload parsed as a JSON OBJECT, or null when stdin was absent, not JSON, or JSON that is not
 * an object. Never throws.
 *
 * The object check is deliberately stricter than the `JSON.parse` it replaces, and it closes a real
 * hole: `JSON.parse("null")` and `JSON.parse("123")` both SUCCEED, so a bare
 * `try { input = JSON.parse(...) } catch { exit(0) }` lets a null or a number through its catch and
 * then reads a field off it, throwing where nothing was guarding. Every edge wants a payload object
 * or nothing, so that is what this returns.
 */
export function parseStdin<T>(raw: string): T | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as T;
  } catch {
    return null;
  }
}
