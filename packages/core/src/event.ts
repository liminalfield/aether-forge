/**
 * The shape of a recorded event.
 *
 * This is the most permanent thing in the project. Once a campaign exists on
 * someone's disk, its events are in this shape and have to stay readable
 * forever. See `design/event-log-and-projections.md`.
 *
 * Every field is readonly. An event is a record of something that happened, and
 * nothing that happened can later become something else. Correcting the past
 * means appending an event that supersedes an earlier one.
 */

import type { CampaignId, EventId, SystemId } from './identifiers.js';

/**
 * An event type owned by core, for example `core.entry.revised`.
 *
 * Core defines these, understands their data, and may read inside it.
 */
export type CoreEventType = `core.${string}`;

/**
 * An event type owned by a system module, for example
 * `sys.toy-coinflip.coin.flipped`.
 *
 * Core stores these, hands them back, and asks the owning module to make sense
 * of them. It never reads inside the data itself, which is what keeps modules
 * replaceable.
 */
export type ModuleEventType = `sys.${string}`;

/** Every event type is owned either by core or by exactly one module. */
export type EventType = CoreEventType | ModuleEventType;

/** The fields every event carries, whoever owns it. */
interface RecordedEvent<Payload> {
  /** Unique within the campaign, and sortable by creation order. */
  readonly id: EventId;

  /** The campaign this belongs to. */
  readonly campaignId: CampaignId;

  /**
   * Position in the campaign: 1, 2, 3, and so on.
   *
   * This is the ordering, and the only ordering. It is assigned when the event
   * is appended and never changes.
   */
  readonly seq: number;

  /**
   * When this happened, by the writing machine's clock, as an ISO 8601 string.
   *
   * For a person reading their own log. Never used to sort, compare or resolve
   * anything, because clocks go backwards and machines have the wrong date.
   */
  readonly at: string;

  /** Which version of this event type's data shape was used when it was written. */
  readonly schemaVersion: number;

  /**
   * The event that directly caused this one, if any.
   *
   * Always points backwards, because an event cannot know what it will go on to
   * cause. To follow a chain forwards, look for events pointing at this one.
   */
  readonly causationId?: EventId;

  /**
   * The earlier event this one supersedes, if any.
   *
   * A superseding event carries the whole new value rather than describing a
   * change to the old one, so that nothing ever has to be undone.
   */
  readonly revises?: EventId;

  /** The event's data. Its shape depends on the type and the schema version. */
  readonly payload: Payload;
}

/**
 * An event owned by core.
 *
 * `systemId` is forbidden rather than merely absent. A core event belonging to
 * a system module is not a thing, and the type says so.
 */
export interface CoreEvent<Payload = unknown> extends RecordedEvent<Payload> {
  readonly type: CoreEventType;
  readonly systemId?: never;
}

/**
 * An event owned by a system module.
 *
 * `systemId` is required, so a module event can always be routed back to the
 * module that understands it. Core code should treat `payload` as `unknown`;
 * the type parameter exists for the module that owns it.
 */
export interface ModuleEvent<Payload = unknown> extends RecordedEvent<Payload> {
  readonly type: ModuleEventType;
  readonly systemId: SystemId;
}

/** Any recorded event. */
export type EventEnvelope<Payload = unknown> = CoreEvent<Payload> | ModuleEvent<Payload>;

/** The prefix that marks an event type as belonging to a system module. */
const MODULE_TYPE_PREFIX = 'sys.';

/**
 * Whether this event belongs to a system module.
 *
 * Narrows the type, so code that has checked can rely on `systemId` being
 * present without asserting it.
 */
export function isModuleEvent<Payload>(
  event: EventEnvelope<Payload>,
): event is ModuleEvent<Payload> {
  return event.type.startsWith(MODULE_TYPE_PREFIX);
}

/** Whether this event belongs to core. */
export function isCoreEvent<Payload>(event: EventEnvelope<Payload>): event is CoreEvent<Payload> {
  return !isModuleEvent(event);
}
