import type { EventEnvelope } from '@aether-forge/core';
import { asProjection, describeProjectionIsPredictable } from '@aether-forge/core/testing';
import { describe, expect, it } from 'vitest';

import {
  COMPATIBLE_CORE_CONTRACT_VERSION,
  IRONSWORN_SYSTEM_ID,
  MOMENTUM_CHANGED,
  momentum,
  STARFORGED_SYSTEM_ID,
  STARTING_MOMENTUM,
} from './index.js';

function aChange(seq: number, by: number): EventEnvelope {
  return {
    id: `event-${seq}`,
    campaignId: 'campaign-under-test',
    seq,
    at: '2026-08-04T09:00:00.000Z',
    type: MOMENTUM_CHANGED,
    schemaVersion: 1,
    systemId: STARFORGED_SYSTEM_ID,
    payload: { by },
  };
}

const aSession = (): readonly EventEnvelope[] => [
  aChange(1, 1),
  aChange(2, 1),
  aChange(3, -2),
  aChange(4, 3),
];

describe('@aether-forge/system-ironsworn', () => {
  it('declares both supported system ids', () => {
    expect(STARFORGED_SYSTEM_ID).toBe('ironsworn-starforged');
    expect(IRONSWORN_SYSTEM_ID).toBe('ironsworn-classic');
  });

  it('tracks the core contract version', () => {
    expect(COMPATIBLE_CORE_CONTRACT_VERSION).toBe(1);
  });
});

describe('momentum', () => {
  const run = (events: readonly EventEnvelope[]) =>
    events.reduce(
      (state, event) => momentum.apply(state, event, { stateOf: () => undefined as never }),
      momentum.initial(),
    );

  it('starts where the rules say it starts', () => {
    expect(momentum.initial().current).toBe(STARTING_MOMENTUM);
  });

  it('is the sum of every recorded change', () => {
    expect(run(aSession()).current).toBe(STARTING_MOMENTUM + 1 + 1 - 2 + 3);
  });

  it('remembers how far it went in each direction', () => {
    const state = run(aSession());
    expect(state.highest).toBe(5);
    expect(state.lowest).toBe(2);
  });

  it('does not cap it, because a cap is a suggestion and not a fact', () => {
    // The rules put a ceiling on momentum. That ceiling belongs to what the
    // application suggests, not to what it records. Clamping here would make
    // the events add up to one number while the state showed another.
    const runaway = Array.from({ length: 20 }, (_, index) => aChange(index + 1, 1));
    expect(run(runaway).current).toBe(STARTING_MOMENTUM + 20);
  });

  it('ignores a change it cannot read', () => {
    const nonsense: EventEnvelope = { ...aChange(1, 1), payload: { by: 'quite a lot' } };
    expect(run([nonsense]).changes).toBe(0);
  });
});

// The other half of the canary, held to the same checks as the toy module.
describeProjectionIsPredictable('momentum', () => asProjection(momentum), aSession);
