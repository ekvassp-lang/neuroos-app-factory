import { describe, it, expect } from 'vitest';
import { palette, theme } from './tokens.js';

describe('design tokens', () => {
  it('exposes the NeuroOS palette', () => {
    expect(palette.graphite).toBe('#111827');
    expect(palette.turquoise).toBe('#18D6D1');
    expect(theme.colorBackground).toBe(palette.graphite);
  });
});
