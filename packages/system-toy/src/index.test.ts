import { asProjection, describeProjectionIsPredictable } from '@aether-forge/core/testing';
import { ROLL_PERFORMED, type EventEnvelope, type RollPerformedV1 } from '@aether-forge/core';
import { describe, expect, it } from 'vitest';

import {
  coinRolls,
  coinTally,
  COIN,
  COIN_FLIPPED,
  COMPATIBLE_CORE_CONTRACT_VERSION,
  readCoinFlip,
  TOY_SYSTEM_ID,
  type CoinTally,
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

describe('a coin flip with no module event at all', () => {
  function aCoinRoll(value: number): RollPerformedV1 {
    return {
      request: { dice: [COIN] },
      dice: [{ sides: 2, value, source: { kind: 'digital' } }],
    };
  }

  function rolled(...payloads: readonly unknown[]): readonly EventEnvelope[] {
    return payloads.map((payload, index) => ({
      id: `event-${index + 1}`,
      seq: index + 1,
      at: '2026-08-05T09:00:00.000Z',
      type: ROLL_PERFORMED,
      schemaVersion: 1,
      payload,
    }));
  }

  function tally(events: readonly EventEnvelope[]): CoinTally {
    return events.reduce(
      (state, event) => coinRolls.apply(state, event, { stateOf: () => undefined as never }),
      coinRolls.initial(),
    );
  }

  it('reads which way the coin fell', () => {
    expect(readCoinFlip(aCoinRoll(1))).toBe('heads');
    expect(readCoinFlip(aCoinRoll(2))).toBe('tails');
  });

  it('counts flips without a single event of its own', () => {
    // The module contract claims this system needs zero events of its own. This
    // is that claim, held to account.
    expect(tally(rolled(aCoinRoll(1), aCoinRoll(2), aCoinRoll(1)))).toEqual({
      flips: 3,
      heads: 2,
      tails: 1,
    });
  });

  it('needed no change to core to do it', () => {
    // Nothing here is toy-shaped: a request, some dice, a value. If a coin flip
    // ever needs core to learn something new, the contract is wrong and the toy
    // is not what needs fixing.
    const flip = aCoinRoll(1);
    expect(flip.request.dice[0]?.sides).toBe(2);
    expect(flip.dice[0]?.source).toEqual({ kind: 'digital' });
  });

  it('ignores rolls that are not coins', () => {
    const aTenSidedDie: RollPerformedV1 = {
      request: { dice: [{ sides: 10, count: 1 }] },
      dice: [{ sides: 10, value: 7, source: { kind: 'manual' } }],
    };
    const twoCoinsAtOnce: RollPerformedV1 = {
      request: { dice: [{ sides: 2, count: 2, label: 'coin' }] },
      dice: [
        { sides: 2, value: 1, source: { kind: 'digital' } },
        { sides: 2, value: 2, source: { kind: 'digital' } },
      ],
    };

    expect(readCoinFlip(aTenSidedDie)).toBeUndefined();
    expect(readCoinFlip(twoCoinsAtOnce)).toBeUndefined();
    expect(tally(rolled(aTenSidedDie, twoCoinsAtOnce))).toEqual({ flips: 0, heads: 0, tails: 0 });
  });

  it('ignores a two-sided die that was not asked for as a coin', () => {
    // The label is the only thing separating this module's coin from any other
    // two-sided roll, so it has to be the thing that decides.
    const anUnlabelledD2: RollPerformedV1 = {
      request: { dice: [{ sides: 2, count: 1 }] },
      dice: [{ sides: 2, value: 1, source: { kind: 'digital' } }],
    };
    const aDifferentLabel: RollPerformedV1 = {
      request: { dice: [{ sides: 2, count: 1, label: 'omen' }] },
      dice: [{ sides: 2, value: 1, source: { kind: 'digital' } }],
    };

    expect(readCoinFlip(anUnlabelledD2)).toBeUndefined();
    expect(readCoinFlip(aDifferentLabel)).toBeUndefined();
    expect(tally(rolled(anUnlabelledD2, aDifferentLabel))).toEqual({
      flips: 0,
      heads: 0,
      tails: 0,
    });
  });

  it('counts core rolls only, never the module own event', () => {
    const theModuleEvent: EventEnvelope = {
      id: 'event-99',
      seq: 99,
      at: '2026-08-05T09:00:00.000Z',
      type: COIN_FLIPPED,
      schemaVersion: 1,
      systemId: TOY_SYSTEM_ID,
      payload: { result: 'heads' },
    };

    expect(tally([theModuleEvent])).toEqual({ flips: 0, heads: 0, tails: 0 });
  });

  it('cannot tell its own coin from an identical roll another system made', () => {
    // Not a bug in this module, and it does not have a fix here. A module
    // projection is shown every core event, a core roll says nothing about
    // which system caused it, and a system with no events of its own has
    // nothing else to go on. Written down so the limitation is a known one.
    const someoneElsesCoin: RollPerformedV1 = {
      request: { dice: [{ sides: 2, count: 1, label: 'coin' }] },
      dice: [{ sides: 2, value: 1, source: { kind: 'digital' } }],
    };

    expect(tally(rolled(someoneElsesCoin))).toEqual({ flips: 1, heads: 1, tails: 0 });
  });
});
