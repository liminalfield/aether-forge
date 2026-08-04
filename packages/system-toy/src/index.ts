/**
 * `@aether-forge/system-toy`: the canary module.
 *
 * A trivial coin-flip journaling system whose only job is to keep the module
 * contract honest: core's test suite runs every contract-consuming path against
 * both this module and `system-ironsworn`, permanently. A contract change that
 * the toy cannot implement trivially is a contract bug, not a toy bug.
 */

import {
  CORE_CONTRACT_VERSION,
  type EventTypeDefinition,
  type ModuleProjection,
  type SystemId,
} from '@aether-forge/core';

export const TOY_SYSTEM_ID: SystemId = 'toy-coinflip';

/** The contract version this module was written against. */
export const COMPATIBLE_CORE_CONTRACT_VERSION = CORE_CONTRACT_VERSION;

/** A coin is a two-sided die. */
export const COIN = { sides: 2, count: 1 } as const;

/** The one event this module owns. */
export const COIN_FLIPPED = 'sys.toy-coinflip.coin.flipped';

export interface CoinFlipped {
  readonly result: 'heads' | 'tails';
}

/**
 * Core hands a payload over as `unknown`, because core is not allowed to know
 * what is in it. Only this module can say, so only this module checks.
 */
function isCoinFlipped(payload: unknown): payload is CoinFlipped {
  if (typeof payload !== 'object' || payload === null) return false;
  const result = (payload as { result?: unknown }).result;
  return result === 'heads' || result === 'tails';
}

export interface CoinTally {
  readonly flips: number;
  readonly heads: number;
  readonly tails: number;
}

/** How the coin has fallen so far. */
export const coinTally: ModuleProjection<CoinTally> = {
  id: 'sys.toy-coinflip.tally',
  systemId: TOY_SYSTEM_ID,

  initial: () => ({ flips: 0, heads: 0, tails: 0 }),

  apply: (state, event) => {
    if (event.type !== COIN_FLIPPED || !isCoinFlipped(event.payload)) return state;

    return {
      flips: state.flips + 1,
      heads: state.heads + (event.payload.result === 'heads' ? 1 : 0),
      tails: state.tails + (event.payload.result === 'tails' ? 1 : 0),
    };
  },
};

/**
 * The event shapes this module owns, and how it reads its own history.
 *
 * Declared by the module rather than by the application, because the module is
 * the only thing that knows what its events mean or how they have changed.
 */
export const eventTypes: readonly EventTypeDefinition[] = [
  { type: COIN_FLIPPED, currentVersion: 1, translations: [] },
];
