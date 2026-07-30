// The stdin read is not unit-testable in-process: the defect it now closes is a property of the FILE
// DESCRIPTOR (fd 0 non-blocking, a writer that has not written yet), so it only shows in a real process
// fed by a real pipe. This drives exactly that: the module is bundled as a probe, then run under a shell
// with an immediate writer and with a LATE one.
//
// It is the regression the previous form failed 8 times out of 8: touching `process.stdin` put fd 0 in
// non-blocking mode, the read raised EAGAIN, the catch returned '' and the edge fell back to neutral in
// silence. A test that only called readStdinSync() inside vitest would have stayed green throughout.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildSync } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
let dir: string;
let probe: string;
let payload: string;

/** The payload a hook runner would write: a JSON object, with a multi-byte character in it. */
const PAYLOAD = JSON.stringify({ prompt_id: 'p-1', last_assistant_message: 'résumé écrit à côté' });

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'utils-stdin-'));
  probe = join(dir, 'probe.mjs');
  payload = join(dir, 'payload.json');
  writeFileSync(payload, PAYLOAD, 'utf8');
  // The probe prints what the read returned, so an assertion reads a length and a decoded string
  // rather than an exit code that could be right for the wrong reason.
  const src = join(dir, 'probe.ts');
  writeFileSync(
    src,
    `import { readStdinSync } from ${JSON.stringify(join(here, 'stdin.ts'))};\n` +
      `const s = readStdinSync();\nprocess.stdout.write(JSON.stringify({ n: s.length, s }));\n`,
    'utf8',
  );
  buildSync({ entryPoints: [src], bundle: true, platform: 'node', format: 'esm', outfile: probe, logLevel: 'silent' });
});

afterAll(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
});

/** Run the probe with its stdin fed by `writer`, a shell command, and return what it read. */
function readWith(writer: string): { n: number; s: string } {
  const out = execFileSync('sh', ['-c', `${writer} | node ${JSON.stringify(probe)}`], { encoding: 'utf8' });
  return JSON.parse(out) as { n: number; s: string };
}

describe('readStdinSync: a payload survives a writer that is not ready yet', () => {
  it('reads the whole payload from an immediate writer', () => {
    const r = readWith(`cat ${JSON.stringify(payload)}`);
    expect(r.n).toBe(PAYLOAD.length);
    expect(JSON.parse(r.s)).toMatchObject({ prompt_id: 'p-1' });
  });

  it('reads the whole payload from a LATE writer, instead of silently reading nothing', () => {
    const r = readWith(`(sleep 0.15; cat ${JSON.stringify(payload)})`);
    expect(r.n).toBe(PAYLOAD.length);
    expect(JSON.parse(r.s)).toMatchObject({ last_assistant_message: 'résumé écrit à côté' });
  });

  it('reads a payload written in SEVERAL late chunks, decoding once over the whole', () => {
    const r = readWith(`(sleep 0.1; printf '%s' '{"a":"ré'; sleep 0.1; printf '%s' "sumé\\"}")`);
    expect(JSON.parse(r.s)).toEqual({ a: 'résumé' });
  });

  it('returns the empty string when the writer closes with nothing to say', () => {
    expect(readWith('true')).toEqual({ n: 0, s: '' });
  });
});
