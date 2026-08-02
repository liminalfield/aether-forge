import { describe, expect, it } from 'vitest';

import { tokens } from './index.js';

describe('@aether-forge/ui', () => {
  it('exposes a token scale', () => {
    expect(tokens.space.md).toBe('16px');
    expect(Object.keys(tokens.color).length).toBeGreaterThan(0);
  });
});
