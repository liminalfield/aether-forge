import { describe, expect, it } from 'vitest';

import { COIN, COMPATIBLE_CORE_CONTRACT_VERSION, TOY_SYSTEM_ID } from './index.js';

describe('@aether-forge/system-toy', () => {
  it('identifies itself and tracks the core contract version', () => {
    expect(TOY_SYSTEM_ID).toBe('toy-coinflip');
    expect(COMPATIBLE_CORE_CONTRACT_VERSION).toBe(1);
  });

  it('models a coin as a two-sided die', () => {
    expect(COIN.sides).toBe(2);
  });
});
