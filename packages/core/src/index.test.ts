import { describe, expect, it } from 'vitest';

import { CORE_CONTRACT_VERSION, type Versioned } from './index.js';

describe('@aether-forge/core', () => {
  it('declares a contract version', () => {
    expect(CORE_CONTRACT_VERSION).toBe(1);
  });

  it('versions anything that crosses the log boundary', () => {
    const payload: Versioned = { schemaVersion: 1 };
    expect(payload.schemaVersion).toBeGreaterThan(0);
  });
});
