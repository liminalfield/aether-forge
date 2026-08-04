/**
 * Working out current state by reading the events in order.
 *
 * A projection starts from nothing and applies each event in turn. The
 * character sheet is a projection. So is a track's current value, and the list
 * of threads that have not moved recently. None of them are stored: they are
 * worked out again from the log.
 *
 * See `design/event-log-and-projections.md`.
 */

import type { EventEnvelope } from './event.js';
import { ok, type Result } from './result.js';
import type { TranslatingLog, TranslatingLogFailure } from './translating-log.js';

/**
 * How one view of a campaign is built.
 *
 * `apply` must be predictable: given the same state and the same event it must
 * always return the same thing. That means no reading the clock, no random
 * values, no depending on the order things come out of a lookup table, and
 * nothing read from outside the event it was handed.
 *
 * This is not decoration. The same log must always produce the same state, or
 * the campaign cannot be trusted and bugs in it cannot be chased. Nothing here
 * can enforce it, which is why every projection is checked by replaying it
 * twice.
 */
export interface Projection<State> {
  /** Names this view, for reporting and for holding several at once. */
  readonly id: string;

  /** The state of a campaign with no events at all. */
  initial(): State;

  /**
   * The state after one more event.
   *
   * Most projections care about a handful of event types and should return the
   * state untouched for everything else.
   */
  apply(state: State, event: EventEnvelope): State;
}

/**
 * Build a projection from events already in hand.
 *
 * Separate from reading a log so that a projection can be checked against a
 * fixed list of events, which is what makes it testable without storage.
 */
export function replay<State>(
  projection: Projection<State>,
  events: Iterable<EventEnvelope>,
): State {
  let state = projection.initial();
  for (const event of events) {
    state = projection.apply(state, event);
  }
  return state;
}

/**
 * Build a projection by reading a campaign from the beginning.
 *
 * Reads through translation, so a projection only ever sees the current shape
 * of an event and never grows special cases for older ones.
 */
export function buildFromLog<State>(
  projection: Projection<State>,
  log: TranslatingLog,
): Result<State, TranslatingLogFailure> {
  const events = log.read();
  if (!events.ok) return events;
  return ok(replay(projection, events.value));
}
