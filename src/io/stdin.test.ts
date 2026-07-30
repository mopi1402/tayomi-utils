// parseStdin's contract is "a payload OBJECT or nothing": the values below are exactly the ones a
// bare JSON.parse would have let through into a field access one line later.

import { describe, it, expect } from 'vitest';
import { parseStdin } from './stdin.js';

describe('parseStdin', () => {
  it('hands back the payload object', () => {
    expect(parseStdin<{ a: number }>('{"a":1}')).toEqual({ a: 1 });
  });

  it('is null on everything JSON.parse accepts that is NOT an object', () => {
    for (const raw of ['null', '123', '"text"', 'true', '[1,2]']) {
      expect(parseStdin(raw)).toBeNull();
    }
  });

  it('is null on absent or broken input, never a throw', () => {
    expect(parseStdin('')).toBeNull();
    expect(parseStdin('{not json')).toBeNull();
  });
});
