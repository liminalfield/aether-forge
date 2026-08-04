/**
 * How a system module works out its own state.
 *
 * Core may not look inside a module's event data. That rule is what keeps
 * modules replaceable, and it leaves a gap: something has to turn those events
 * into state, and it cannot be core. So the module supplies the calculation,
 * and core holds the result without ever understanding it.
 *
 * Core stores that state exactly as it stores event data: it keeps it, hands it
 * back when asked, and never reads inside.
 *
 * See `design/event-log-and-projections.md`.
 */

import type { EventEnvelope } from './event.js';
import type { SystemId } from './identifiers.js';
import type { Projection } from './projection.js';

/**
 * What a module is allowed to look at besides the event it was handed.
 *
 * Read-only, and core projections only. A module reasonably needs to know
 * things like an entity's current fields. It has no business writing anything,
 * and no business reading another module's state.
 */
export interface ProjectionContext {
  /** The current state of a core projection this campaign holds. */
  stateOf<State>(projection: Projection<State>): State;
}

/**
 * A module's own view of a campaign.
 *
 * The same predictability rule applies as to any projection: given the same
 * state, the same event and the same context, it must always return the same
 * thing. No clock, no random values, nothing read from outside.
 *
 * It must also be plain computation. It runs wherever state is worked out,
 * which is the main process, where there is no window and no page. A module
 * that needs something from the outside world has to be handed it as data.
 */
export interface ModuleProjection<State = unknown> {
  /** Names this view. Namespaced by the module, to avoid colliding with core. */
  readonly id: string;

  /** Which module owns it. Decides which events it is shown. */
  readonly systemId: SystemId;

  initial(): State;

  apply(state: State, event: EventEnvelope, context: ProjectionContext): State;
}

/**
 * Whether a module projection should be shown this event.
 *
 * A module sees core events and its own. It never sees another module's,
 * because it could not read the data anyway and because being able to try is
 * how two modules quietly become one.
 *
 * This is enforced here rather than left to each module to respect.
 */
export function isVisibleToModule(event: EventEnvelope, systemId: SystemId): boolean {
  return event.systemId === undefined || event.systemId === systemId;
}
