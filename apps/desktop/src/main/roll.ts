import { randomInt } from 'node:crypto';

import type { DieValue, RollPerformedV1, RollRequest } from '@aether-forge/core';
import { validateRoll } from '@aether-forge/core';

/**
 * Rolling dice, and taking dice somebody threw themselves.
 *
 * Randomness lives here, beside the other two unpredictable inputs this layer
 * already supplies when an event is written: the time, and the identifier. A
 * projection is a pure function of the log, so nothing that reads the log may
 * reach for a random number, and this is the only place allowed to.
 *
 * Handing in die values is not a concession for testing. It is manual entry,
 * which every roll surface has to accept anyway, because somebody throwing real
 * dice types in what they showed. A test that needs known dice uses the route a
 * player uses with dice on the table, so there is no test-only path here to
 * keep honest.
 *
 * See `design/rolling-dice.md` and `design/the-verdict-card.md`.
 */

/** A request that cannot be turned into a roll. */
export type RollRefused =
  | {
      /** Somebody handed in a different number of dice than the check asked for. */
      readonly kind: 'wrong-number-of-dice';
      readonly asked: number;
      readonly given: number;
    }
  | { readonly kind: 'die-is-not-a-whole-number'; readonly index: number }
  | { readonly kind: 'die-outside-its-range'; readonly index: number; readonly detail: string };

/**
 * Every die a request asks for, flattened, keeping the order it asked in.
 *
 * A spec asking for two ten-sided dice becomes two dice, because from here on
 * everything works per die: a person can throw one of them and let the
 * application roll the other.
 */
function expand(request: RollRequest): readonly number[] {
  return request.dice.flatMap((spec) => Array.from({ length: spec.count }, () => spec.sides));
}

/**
 * Roll what was asked for, or record what somebody threw.
 *
 * `thrown` is the values a person typed in, in the order the request asks for
 * them. Absent means the application rolls. There is no third case: a roll is
 * either asked for or handed over.
 *
 * The two produce identical events apart from where each die says it came from,
 * which is the whole point and is what the test at this level checks.
 */
export function performRoll(
  request: RollRequest,
  thrown?: readonly number[],
):
  | { readonly ok: true; readonly value: RollPerformedV1 }
  | {
      readonly ok: false;
      readonly failure: RollRefused;
    } {
  const sides = expand(request);

  if (thrown !== undefined && thrown.length !== sides.length) {
    return {
      ok: false,
      failure: { kind: 'wrong-number-of-dice', asked: sides.length, given: thrown.length },
    };
  }

  const dice: DieValue[] = sides.map((faces, index) => {
    const handed = thrown?.[index];

    return handed === undefined
      ? // One to the number of faces, inclusive. randomInt's upper bound is
        // exclusive, and it draws from the same source the platform uses for
        // keys rather than from Math.random.
        { sides: faces, value: randomInt(1, faces + 1), source: { kind: 'digital' } }
      : { sides: faces, value: handed, source: { kind: 'manual' } };
  });

  const roll: RollPerformedV1 = { request, dice };

  // The only thing ever refused about a roll: a die showing a number it does
  // not have. Not a rule, and not legality. A person typing 12 for a
  // ten-sided die has mistyped, and recording it would put a number in the log
  // that nothing downstream can explain.
  const checked = validateRoll(roll);
  if (checked.ok) return { ok: true, value: checked.value };

  const failure = checked.failure;
  if (failure.kind === 'die-value-is-not-whole') {
    return { ok: false, failure: { kind: 'die-is-not-a-whole-number', index: failure.index } };
  }

  if (failure.kind === 'die-outside-its-range') {
    return {
      ok: false,
      failure: {
        kind: 'die-outside-its-range',
        index: failure.index,
        detail: `a ${String(failure.sides)}-sided die cannot show ${String(failure.value)}`,
      },
    };
  }

  if (failure.kind === 'die-has-impossible-sides') {
    return {
      ok: false,
      failure: {
        kind: 'die-outside-its-range',
        index: failure.index,
        detail: `a die cannot have ${String(failure.sides)} sides`,
      },
    };
  }

  // The remaining two failures are about a roll replacing an earlier one, and
  // nothing here replaces anything. Rerolling is its own piece of work.
  return {
    ok: false,
    failure: { kind: 'die-outside-its-range', index: 0, detail: failure.kind },
  };
}
