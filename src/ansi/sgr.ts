// SGR escape building for plain notices: the accent kit a hook or a CLI needs when it prints one
// styled line without dragging in a rendering layer. A full template engine (@tayomi/cc-views)
// owns anything richer.

/** ESC, built unambiguously (no literal control byte in source). */
const E = String.fromCharCode(27);

/** One SGR sequence: `sgr('1;38;5;208')` is bold orange. Consumers name their own accents with it. */
export const sgr = (code: string): string => `${E}[${code}m`;

export const RESET = sgr('0');
export const BOLD = sgr('1');
export const DIM = sgr('2');
