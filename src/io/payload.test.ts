// stringField's contract is "the string the payload carries, or undefined": the near-misses are
// exactly the shapes a hook payload takes when the field is absent, mistyped, or the payload is
// not the object the edge expected.

import { describe, it, expect } from 'vitest';
import { stringField } from './payload.js';

const KEY = 'session_id';
const VALUE = 'sess-1';

describe('stringField', () => {
  it('hands back the string the payload carries', () => {
    expect(stringField({ [KEY]: VALUE }, KEY)).toBe(VALUE);
  });

  it('hands back an EMPTY string as it stands, emptiness being the caller policy', () => {
    expect(stringField({ [KEY]: '' }, KEY)).toBe('');
  });

  it('is undefined on a field that is absent or not a string', () => {
    expect(stringField({}, KEY)).toBeUndefined();
    for (const wrong of [7, null, true, ['a'], { nested: VALUE }]) {
      expect(stringField({ [KEY]: wrong }, KEY)).toBeUndefined();
    }
  });

  it('is undefined on a payload that is not an object at all, never a throw', () => {
    for (const payload of [null, undefined, 'text', 7, true]) {
      expect(stringField(payload, KEY)).toBeUndefined();
    }
  });

  it('refuses an ARRAY payload the way parseStdin does, indexed strings included', () => {
    expect(stringField([VALUE], '0')).toBeUndefined();
  });

  it('answers only for the payload OWN fields, never for what every object inherits', () => {
    expect(stringField({}, 'constructor')).toBeUndefined();
    expect(stringField({ [KEY]: VALUE }, 'toString')).toBeUndefined();
  });
});
