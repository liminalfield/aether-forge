import { asProjection, describeProjectionIsPredictable } from '@aether-forge/core/testing';
import type { EventEnvelope } from '@aether-forge/core';
import { describe, expect, it } from 'vitest';

import {
  coinTally,
  COIN,
  COIN_FLIPPED,
  COMPATIBLE_CORE_CONTRACT_VERSION,
  TOY_SYSTEM_ID,
} from './index.js';

function aFlip(seq: number, result: 'heads' | 'tails'): EventEnvelope {
  return {
    id: `event-${seq}`,
    campaignId: 'campaign-under-test',
    seq,
    at: '2026-08-04T09:00:00.000Z',
    type: COIN_FLIPPED,
    schemaVersion: 1,
    systemId: TOY_SYSTEM_ID,
    payload: { result },
  };
}

const someFlips = (): readonly EventEnvelope[] => [
  aFlip(1, 'heads'),
  aFlip(2, 'tails'),
  aFlip(3, 'heads'),
];

describe('@aether-forge/system-toy', () => {
  it('identifies itself and tracks the core contract version', () => {
    expect(TOY_SYSTEM_ID).toBe('toy-coinflip');
    expect(COMPATIBLE_CORE_CONTRACT_VERSION).toBe(1);
  });

  it('models a coin as a two-sided die', () => {
    expect(COIN.sides).toBe(2);
  });
});

describe('the coin tally', () => {
  it('starts at nothing', () => {
    expect(coinTally.initial()).toEqual({ flips: 0, heads: 0, tails: 0 });
  });

  it('counts how the coin has fallen', () => {
    const tally = someFlips().reduce(
      (state, event) => coinTally.apply(state, event, { stateOf: () => undefined as never }),
      coinTally.initial(),
    );

    expect(tally).toEqual({ flips: 3, heads: 2, tails: 1 });
  });

  it('ignores an event whose payload is not a coin flip', () => {
    const nonsense: EventEnvelope = { ...aFlip(4, 'heads'), payload: { result: 'sideways' } };
    const tally = coinTally.apply(coinTally.initial(), nonsense, {
      stateOf: () => undefined as never,
    });

    expect(tally.flips).toBe(0);
  });
});

// The canary. If a contract change makes this awkward, the contract is wrong.
describeProjectionIsPredictable('the coin tally', () => asProjection(coinTally), someFlips);
