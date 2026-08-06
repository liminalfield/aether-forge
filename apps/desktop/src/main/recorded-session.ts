import type { UnversionedEventDraft } from '@aether-forge/core';
import {
  FACE_DANGER,
  MOMENTUM_CHANGED,
  MOVE_INVOKED,
  MOVE_RESOLVED,
  STARFORGED_SYSTEM_ID,
} from '@aether-forge/system-ironsworn';
import { COIN, COIN_FLIPPED, TOY_SYSTEM_ID } from '@aether-forge/system-toy';

import {
  ENTRY_CREATED,
  ORACLE_CONSULTED,
  ROLL_PERFORMED,
  sequenceCheck,
  type RollPerformedV1,
} from '@aether-forge/core';

/**
 * A session, written down as it would have happened.
 *
 * This is the regression net for the whole engine. Replaying it exercises the
 * log, translation on read, core projections and both modules' projections at
 * once, and the expected state is fixed in the test rather than computed, so a
 * change in behaviour anywhere shows up as a difference here.
 *
 * It deliberately mixes core events with two modules' events, including events
 * neither module should react to, because a module quietly reacting to another
 * module's events is exactly the fault that would otherwise go unnoticed.
 *
 * Rolls joined it once they had a declared shape, including a coin flipped as a
 * plain core roll with no module event behind it, and an oracle consulted from
 * a die typed in by hand.
 *
 * A whole check joined it after that: a stat suggested and taken, a roll, an
 * outcome, and an effect the player refused. That refusal is the point. A
 * session where every suggestion was accepted would not exercise the thing the
 * audit trail exists for.
 */

const entry = (text: string): UnversionedEventDraft => ({ type: ENTRY_CREATED, payload: { text } });

const flip = (result: 'heads' | 'tails'): UnversionedEventDraft => ({
  type: COIN_FLIPPED,
  systemId: TOY_SYSTEM_ID,
  payload: { result },
});

const momentum = (by: number, reason: string): UnversionedEventDraft => ({
  type: MOMENTUM_CHANGED,
  systemId: STARFORGED_SYSTEM_ID,
  payload: { by, reason },
});

/**
 * A coin flipped as a core roll and nothing else, which is the toy module's
 * claim that a system can need no events of its own.
 */
const coin = (value: 1 | 2): UnversionedEventDraft => ({
  type: ROLL_PERFORMED,
  payload: {
    request: { dice: [COIN] },
    dice: [{ sides: 2, value, source: { kind: 'digital' } }],
  },
});

/** A die typed in by hand, and the row it landed on. Two events, not one. */
const byHand = (sides: number, value: number): UnversionedEventDraft => ({
  type: ROLL_PERFORMED,
  payload: {
    request: { dice: [{ sides, count: 1 }] },
    dice: [{ sides, value, source: { kind: 'manual' } }],
  },
});

/** Obviously-dummy content. Nothing here comes from a published table. */
const consulted = (from: number, to: number, text: string): UnversionedEventDraft => ({
  type: ORACLE_CONSULTED,
  payload: {
    table: 'example.dummy-tables/what-the-silence-holds',
    package: { id: 'example.dummy-tables', version: '0.4.1' },
    row: { from, to, text },
  },
});

/**
 * One complete check, and the effect nobody took.
 *
 * Written through the sequencer rather than by hand, so the fixture cannot
 * drift out of the order core actually produces. Causation is dropped here:
 * the fixture appends drafts one at a time and has no identifiers to point at
 * until they are written, which is a real gap and is noted in the test.
 */
function aCheckWhoseEffectWasRefused(): readonly UnversionedEventDraft[] {
  const roll: RollPerformedV1 = {
    request: {
      dice: [
        { sides: 6, count: 1, label: 'action' },
        { sides: 10, count: 2, label: 'challenge' },
      ],
    },
    dice: [
      { sides: 6, value: 4, source: { kind: 'manual' } },
      { sides: 10, value: 2, source: { kind: 'digital' } },
      { sides: 10, value: 9, source: { kind: 'digital' } },
    ],
  };

  const inputs = { stat: 2, bonus: 0 };
  const outcome = FACE_DANGER.interpret(roll, inputs);
  const proposed = outcome.suggests[0];
  if (proposed === undefined)
    throw new Error('the fixture expects this outcome to propose one thing');

  return sequenceCheck({
    check: FACE_DANGER,
    systemId: STARFORGED_SYSTEM_ID,
    offered: [
      {
        input: 'stat',
        label: 'Use edge',
        value: 2,
        why: 'the shuttle is built for this',
        answer: 'accepted',
      },
    ],
    inputs,
    roll,
    outcome,
    // Refused. The campaign keeps the momentum it had, and the log says the
    // player was asked.
    answers: { [proposed.id]: { kind: 'declined' } },
    events: { invoked: MOVE_INVOKED, resolved: MOVE_RESOLVED },
  }).map((sequenced) => sequenced.draft);
}

export const RECORDED_SESSION: readonly UnversionedEventDraft[] = [
  entry('The Sundered Reach, forty years after the last supply run.'),
  entry('I take the shuttle down through the debris field.'),
  flip('heads'),
  momentum(1, 'a clean approach'),
  entry('The landing pad is intact. Nothing else is.'),
  entry('Something moved in the cargo bay.'),
  flip('tails'),
  momentum(-2, 'caught in the open'),
  entry('I should not have called out.'),
  entry('It answers in my mother tongue, which is worse.'),
  flip('heads'),
  momentum(1, 'it did not attack'),
  entry('We speak for an hour. It has been alone for eleven years.'),
  entry('It asks me to carry a message. I say yes before I think.'),
  momentum(2, 'a vow sworn'),
  entry('The message is a name and a set of coordinates.'),
  flip('tails'),
  momentum(-1, 'the shuttle will not start'),
  entry('The airlock did not open.'),
  entry('It opened on the second try, which is somehow worse.'),
  flip('heads'),
  momentum(1, 'clear of the field'),
  entry('Burning hard for the outer belt.'),
  entry('Eleven years is a long time to wait for someone to say yes.'),
  momentum(3, 'a promise kept in mind'),
  entry('I have not stopped thinking about the name.'),
  flip('heads'),
  flip('heads'),
  momentum(-4, 'a bad reckoning at the belt'),
  entry('The coordinates are wrong. Or the name is.'),
  entry('Turning back is not a thing I am able to do.'),
  flip('tails'),
  momentum(1, 'a plan, of a sort'),
  entry('I will find out which.'),
  coin(1),
  byHand(100, 47),
  consulted(41, 60, 'Someone has been here more recently than the dust suggests.'),
  entry('The dust is wrong. Someone swept it.'),
  coin(2),
  entry('Whatever kept them tidy is still aboard, and it has heard me.'),
  ...aCheckWhoseEffectWasRefused(),
  entry('I could have taken the loss. I did not.'),
  entry('End of session.'),
];
