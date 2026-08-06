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
  readRoll,
  ROLL_PERFORMED,
  type CheckDefinition,
  type DieSpec,
  type EventTypeDefinition,
  type ModuleProjection,
  type RollPerformedV1,
  type SystemId,
} from '@aether-forge/core';

export const TOY_SYSTEM_ID: SystemId = 'toy-coinflip';

/** The contract version this module was written against. */
export const COMPATIBLE_CORE_CONTRACT_VERSION = CORE_CONTRACT_VERSION;

/**
 * A coin is a two-sided die.
 *
 * The label is this module's own word for it. Core stores it and never reads
 * it, and it is how a coin flip is told apart from any other two-sided roll.
 */
export const COIN: DieSpec = { sides: 2, count: 1, label: 'coin' };

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
  { type: COIN_FLIPPED, currentVersion: 1, translations: [], corrections: 'records-a-change' },
];

/**
 * A coin flip with no module event at all.
 *
 * The module contract's stress test claims this system needs zero events of its
 * own, because a coin flip is a `core.roll.performed` with a two-sided die.
 * Everything below exists to hold that claim to account. It is the cheapest
 * possible check that the roll event is not secretly shaped around Ironsworn.
 *
 * The module event above is kept, because it is what exercises the paths a
 * module event goes through: isolation from other modules, translation on read,
 * and a projection over data core cannot see inside. The two are different
 * canaries and both are worth having.
 */

/** Which way a coin fell. Heads is the low face, the way a printed die reads. */
export function readCoinFlip(roll: RollPerformedV1): 'heads' | 'tails' | undefined {
  const asked = roll.request.dice;
  if (asked.length !== 1 || asked[0]?.label !== COIN.label) return undefined;

  const die = roll.dice[0];
  if (roll.dice.length !== 1 || die === undefined || die.sides !== 2) return undefined;

  if (die.value === 1) return 'heads';
  if (die.value === 2) return 'tails';
  return undefined;
}

/**
 * How the coin has fallen, worked out from core rolls alone.
 *
 * Reads `core.roll.performed` and nothing else. No event of this module's own
 * takes part, which is the whole point.
 *
 * **A limitation worth knowing about.** A module projection is shown every core
 * event, so this sees every roll in the campaign, including rolls that have
 * nothing to do with this system. All it can do is recognise its own by the
 * shape it asked for: one two-sided die labelled `coin`. Nothing stops another
 * module asking for exactly that. The contract offers no way to scope a core
 * roll to the system that caused it, and a system with no events of its own has
 * nothing else to go on. See the note in `02-MODULE-CONTRACT.md`.
 */
export const coinRolls: ModuleProjection<CoinTally> = {
  id: 'sys.toy-coinflip.rolls',
  systemId: TOY_SYSTEM_ID,

  initial: () => ({ flips: 0, heads: 0, tails: 0 }),

  apply: (state, event) => {
    if (event.type !== ROLL_PERFORMED) return state;

    const roll = readRoll(event.payload);
    if (roll === undefined) return state;

    const fell = readCoinFlip(roll);
    if (fell === undefined) return state;

    return {
      flips: state.flips + 1,
      heads: state.heads + (fell === 'heads' ? 1 : 0),
      tails: state.tails + (fell === 'tails' ? 1 : 0),
    };
  },
};

/**
 * The whole system, as one check.
 *
 * The module contract's stress test says this needs no inputs, no suggestions
 * and no module events. Everything below is that claim held to account. If a
 * coin flip cannot be a check trivially, the contract is wrong and the toy is
 * not what needs fixing.
 *
 * It proposes nothing, which is the part worth noticing. A check that has an
 * opinion about what should happen next is the ordinary case, and a check with
 * no opinion at all has to work just as well.
 */
export const CALL_IT: CheckDefinition = {
  id: 'toy-coinflip/call-it',
  name: 'Call it',
  roll: { dice: [COIN] },
  inputs: [],

  interpret: (roll) => {
    const fell = roll === null ? undefined : readCoinFlip(roll);

    if (fell === 'heads') {
      return { id: 'heads', label: 'Heads', summary: 'It came up heads.', suggests: [] };
    }
    if (fell === 'tails') {
      return { id: 'tails', label: 'Tails', summary: 'It came up tails.', suggests: [] };
    }

    // A roll that is not a coin. The check says so rather than picking a side,
    // because guessing here would put a campaign in a state nobody could
    // explain from the log.
    return { id: 'not-a-coin', label: 'Not a coin', summary: 'That was not a coin.', suggests: [] };
  },
};

/** The checks this module offers. One is enough to keep the contract honest. */
export const checks: readonly CheckDefinition[] = [CALL_IT];
