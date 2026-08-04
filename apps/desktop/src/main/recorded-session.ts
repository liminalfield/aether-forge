import type { UnversionedEventDraft } from '@aether-forge/core';
import { MOMENTUM_CHANGED, STARFORGED_SYSTEM_ID } from '@aether-forge/system-ironsworn';
import { COIN_FLIPPED, TOY_SYSTEM_ID } from '@aether-forge/system-toy';

import { ENTRY_CREATED } from './event-types';

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
 * **Not yet covered: rolls and suggestions.** Those event families have no
 * declared shape yet, and inventing one to make a fixture look complete would
 * commit the project to a permanent shape for the sake of a test. They join
 * this fixture when they are designed.
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
  entry('End of session.'),
];
