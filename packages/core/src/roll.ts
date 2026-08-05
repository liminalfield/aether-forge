/**
 * Dice, and where their numbers came from.
 *
 * Core owns the `core.roll.*` family, so it declares the shape rather than
 * leaving each application to invent one.
 *
 * A roll records what dice were asked for and what they showed, and nothing
 * else. No total, because totals are calculated and calculated things are never
 * stored. No stat and no outcome, because whether you add the dice, take the
 * highest, or compare them against each other is a rule, and rules belong to
 * system modules. The events either side of a roll carry the meaning.
 *
 * The numbers are generated once, before the event exists, and written into it.
 * Reading the log back never rolls anything. That is what keeps a projection a
 * pure function of the log: a die whose value were produced during replay would
 * make the campaign different every time it was opened, and it would do it
 * silently.
 *
 * See `design/rolling-dice.md`.
 */

import { failed, ok, type Result } from './result.js';
import type { EventTypeDefinition } from './schema.js';

export const ROLL_PERFORMED = 'core.roll.performed';

/**
 * Dice asked for. Two six-sided dice is `{ sides: 6, count: 2 }`.
 *
 * `label` is a module's own word for what these dice are, so that a module
 * handing back three dice can say which is which. Core stores it and never
 * reads it, which is why a rulebook word is allowed to appear in the value
 * while never appearing in this file.
 */
export interface DieSpec {
  readonly sides: number;
  readonly count: number;
  readonly label?: string;
}

/**
 * Where a die's number came from.
 *
 * A record rather than a word, so a die rolled through a service can carry that
 * service's own identifiers. The alternative, a word plus a sometimes-present
 * field beside it, is the shape that produces "these two disagree" bugs, and a
 * payload schema cannot be tidied up once campaigns exist.
 *
 * `ref` is whatever the service uses to identify the roll, and core never
 * parses it.
 */
export type DieSource =
  | { readonly kind: 'digital' }
  | { readonly kind: 'manual' }
  | { readonly kind: 'service'; readonly service: string; readonly ref: string };

/** One die, and what it showed. */
export interface DieValue {
  readonly sides: number;
  readonly value: number;
  /**
   * Per die rather than per roll, because people mix. Three dice from a service
   * and one typed in after it fell on the floor is an ordinary evening.
   */
  readonly source: DieSource;
}

export interface RollRequest {
  readonly dice: readonly DieSpec[];
}

/**
 * Version 1 of a roll.
 *
 * Keeping the request as well as the result is what makes the event still
 * legible years later, after the module that asked for it has been rewritten or
 * replaced. Without it, a roll of three dice is three numbers with no way to
 * tell what they were for or whether one is missing.
 */
export interface RollPerformedV1 {
  readonly request: RollRequest;
  readonly dice: readonly DieValue[];
}

export const rollEventTypes: readonly EventTypeDefinition[] = [
  { type: ROLL_PERFORMED, currentVersion: 1, translations: [], corrections: 'replaces-a-value' },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readSource(value: unknown): DieSource | undefined {
  if (!isRecord(value)) return undefined;

  if (value['kind'] === 'digital') return { kind: 'digital' };
  if (value['kind'] === 'manual') return { kind: 'manual' };

  if (value['kind'] === 'service') {
    const service = value['service'];
    const ref = value['ref'];
    if (typeof service !== 'string' || typeof ref !== 'string') return undefined;
    return { kind: 'service', service, ref };
  }

  return undefined;
}

function readSpec(value: unknown): DieSpec | undefined {
  if (!isRecord(value)) return undefined;

  const sides = value['sides'];
  const count = value['count'];
  if (typeof sides !== 'number' || typeof count !== 'number') return undefined;

  const label = value['label'];
  if (label === undefined) return { sides, count };
  if (typeof label !== 'string') return undefined;
  return { sides, count, label };
}

function readValue(value: unknown): DieValue | undefined {
  if (!isRecord(value)) return undefined;

  const sides = value['sides'];
  const rolled = value['value'];
  if (typeof sides !== 'number' || typeof rolled !== 'number') return undefined;

  const source = readSource(value['source']);
  if (source === undefined) return undefined;

  return { sides, value: rolled, source };
}

function readEach<Item>(
  value: unknown,
  read: (item: unknown) => Item | undefined,
): Item[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const items: Item[] = [];
  for (const item of value) {
    const parsed = read(item);
    if (parsed === undefined) return undefined;
    items.push(parsed);
  }
  return items;
}

/**
 * Read a roll off an event payload, or say the shape is not one.
 *
 * The payload arrives as `unknown` because it was read off a disk that an older
 * build may have written, so what it contains is a belief rather than a fact.
 *
 * This checks the shape and nothing else. Whether a d10 showing 12 is allowed is
 * a separate question with a separate answer.
 */
export function readRoll(payload: unknown): RollPerformedV1 | undefined {
  if (!isRecord(payload)) return undefined;

  const request = payload['request'];
  if (!isRecord(request)) return undefined;

  const specs = readEach(request['dice'], readSpec);
  if (specs === undefined) return undefined;

  const dice = readEach(payload['dice'], readValue);
  if (dice === undefined) return undefined;

  return { request: { dice: specs }, dice };
}

/**
 * What a die can be wrong about, which is very little.
 *
 * `index` is the die's position in the roll, because several dice of the same
 * size in one roll are otherwise indistinguishable when reporting which one is
 * the problem.
 */
export type RollFailure =
  | {
      /** A d10 showing 12, or showing 0. */
      readonly kind: 'die-outside-its-range';
      readonly index: number;
      readonly sides: number;
      readonly value: number;
    }
  | {
      readonly kind: 'die-value-is-not-whole';
      readonly index: number;
      readonly value: number;
    }
  | {
      /** Without a whole number of sides, one to the number of sides means nothing. */
      readonly kind: 'die-has-impossible-sides';
      readonly index: number;
      readonly sides: number;
    };

/**
 * The only check that exists on a roll: every die shows a whole number from one
 * to the number of sides it has.
 *
 * A value a rule would forbid is allowed. A combination a rule would forbid is
 * allowed. Three sixes on three dice is recorded without comment. The
 * application computes and does not decide, and this is the single place where
 * anything at all is refused.
 *
 * **Deliberately not a general mechanism.** It would be less code to hang an
 * optional validator off `EventTypeDefinition` and let every event type bring
 * its own, and that would create precisely the channel this project does not
 * have: somewhere a module could express "illegal". The absence of that channel
 * is what makes the sovereignty promise structural rather than a matter of
 * discipline. So range checking lives here, on core's own event, reachable only
 * for rolls.
 *
 * Separate from `readRoll` on purpose. Reading is permissive because an event
 * recorded years ago is a fact whatever it contains, and refusing to read one
 * would lose a campaign rather than protect it. This is for the moment a roll is
 * recorded, which is the only moment a number can still be questioned.
 *
 * It does not check that the dice match what was asked for. Whether a roll may
 * record dice nobody asked for is an open question in
 * `design/rolling-dice.md`, and answering it by accident here would settle it
 * the wrong way round.
 */
export function validateRoll(roll: RollPerformedV1): Result<RollPerformedV1, RollFailure> {
  for (const [index, die] of roll.dice.entries()) {
    if (!Number.isInteger(die.sides) || die.sides < 1) {
      return failed({ kind: 'die-has-impossible-sides', index, sides: die.sides });
    }

    if (!Number.isInteger(die.value)) {
      return failed({ kind: 'die-value-is-not-whole', index, value: die.value });
    }

    if (die.value < 1 || die.value > die.sides) {
      return failed({
        kind: 'die-outside-its-range',
        index,
        sides: die.sides,
        value: die.value,
      });
    }
  }

  return ok(roll);
}
