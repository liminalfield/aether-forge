import { describe, expect, it } from 'vitest';

import {
  COMPATIBLE_CORE_CONTRACT_VERSION,
  IRONSWORN_SYSTEM_ID,
  STARFORGED_SYSTEM_ID,
} from './index.js';

describe('@aether-forge/system-ironsworn', () => {
  it('declares both supported system ids', () => {
    expect(STARFORGED_SYSTEM_ID).toBe('ironsworn-starforged');
    expect(IRONSWORN_SYSTEM_ID).toBe('ironsworn-classic');
  });

  it('tracks the core contract version', () => {
    expect(COMPATIBLE_CORE_CONTRACT_VERSION).toBe(1);
  });
});
