// Interrogating the payload parseStdin handed back: every hook edge asks the same question of it,
// "is this field a string", and each edge retyping the typeof dance is how one of them types it wrong.

/**
 * The named field of an unknown payload, iff it IS a string: `undefined` for a missing field, a
 * non-string one, or anything that is not a payload OBJECT, arrays excluded the way parseStdin
 * excludes them. Emptiness is the caller's policy: an empty string is handed back as it stands,
 * because to some fields it is meaningful (a delta) and to others absent (a session id), and only
 * the call site knows which.
 */
export function stringField(payload: unknown, key: string): string | undefined {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) return undefined;
  if (!Object.hasOwn(payload, key)) return undefined;
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : undefined;
}
