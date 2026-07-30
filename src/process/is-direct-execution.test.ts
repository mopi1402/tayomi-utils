// What these cover: the two spellings this helper replaced were both silently wrong, so the tests
// that matter are the two paths that broke them (a symlink, and a path needing percent-encoding).
// Each is driven against a REAL file on disk, because the whole question is what the filesystem
// resolves, and a mocked fs would pin the assumption instead of the behaviour.

import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isDirectExecution } from './is-direct-execution.js';

describe('isDirectExecution', () => {
  let dir: string;
  const originalArgv1 = process.argv[1];

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'tayomi-direct-'));
  });

  afterEach(() => {
    process.argv[1] = originalArgv1;
    rmSync(dir, { recursive: true, force: true });
  });

  /** Point argv[1] at `p`, as node would when asked to run it. */
  const invokedAs = (p: string): void => {
    process.argv[1] = p;
  };

  it('is true when argv[1] is the module itself', () => {
    const file = join(dir, 'entry.js');
    writeFileSync(file, '');
    invokedAs(file);
    expect(isDirectExecution(pathToFileURL(file).href)).toBe(true);
  });

  it('is true through a SYMLINK, which the argv[1] === fileURLToPath spelling got wrong', () => {
    const target = join(dir, 'entry.js');
    const link = join(dir, 'link.js');
    writeFileSync(target, '');
    symlinkSync(target, link);
    // node leaves argv[1] as typed (the link) but resolves the module URL to the target.
    invokedAs(link);
    expect(isDirectExecution(pathToFileURL(target).href)).toBe(true);
  });

  it('is true when the path needs PERCENT-ENCODING, which the `file://${argv[1]}` spelling got wrong', () => {
    const sub = join(dir, 'My Projects');
    mkdirSync(sub);
    const file = join(sub, 'entry.js');
    writeFileSync(file, '');
    invokedAs(file);
    const url = pathToFileURL(file).href;
    expect(url).toContain('My%20Projects'); // the encoding a template literal does not do
    expect(isDirectExecution(url)).toBe(true);
  });

  it('is false when argv[1] is a DIFFERENT module (the case the guard exists for)', () => {
    const entry = join(dir, 'entry.js');
    const other = join(dir, 'other.js');
    writeFileSync(entry, '');
    writeFileSync(other, '');
    invokedAs(other);
    expect(isDirectExecution(pathToFileURL(entry).href)).toBe(false);
  });

  it('is false when there is no argv[1] at all', () => {
    const file = join(dir, 'entry.js');
    writeFileSync(file, '');
    // @ts-expect-error deliberately reproducing an argv with no script slot
    process.argv[1] = undefined;
    expect(isDirectExecution(pathToFileURL(file).href)).toBe(false);
  });

  it('is false, never throwing, when a path cannot be resolved', () => {
    const gone = join(dir, 'deleted.js');
    invokedAs(gone);
    expect(() => isDirectExecution(pathToFileURL(gone).href)).not.toThrow();
    expect(isDirectExecution(pathToFileURL(gone).href)).toBe(false);
  });
});
