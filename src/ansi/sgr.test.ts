import { describe, it, expect } from 'vitest';
import { sgr, RESET, BOLD, DIM } from './sgr.js';

describe('sgr', () => {
  it('builds the escape a terminal expects', () => {
    expect(sgr('1;38;5;208')).toBe('\u001b[1;38;5;208m');
  });

  it('names the three universal attributes', () => {
    expect(RESET).toBe('\u001b[0m');
    expect(BOLD).toBe('\u001b[1m');
    expect(DIM).toBe('\u001b[2m');
  });
});
