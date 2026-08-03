/**
 * What a campaign log has to be able to do.
 *
 * Core describes this and does not implement it, because core touches no
 * filesystem. The desktop application supplies a SQLite implementation, and an
 * in-memory one ships here so that everything built on top of a log can be
 * tested without a database.
 *
 * See `design/event-log-and-projections.md`.
 *
 * ## Why this is synchronous
 *
 * The storage implementation is SQLite on local disk, read and written by one
 * process, and the project has ruled out ever requiring a server. There is
 * nothing to wait for. Making every call asynchronous would add ceremony to
 * every caller in exchange for a possibility the product has excluded.
 *
 * If a log ever has to live somewhere with latency, this is the decision that
 * changes, and it changes everything above it. That is the reason it is written
 * down rather than assumed.
 */

import type { CampaignId, EventId } from './identifiers.js';
import type { CoreEvent, EventEnvelope, ModuleEvent } from './event.js';
import type { Result } from './result.js';

/**
 * An event before it has been recorded.
 *
 * The caller says what happened. The log decides where it lands: its
 * identifier, its position, and when it was written. Those are not the
 * caller's to choose, which is why they are absent here.
 */
export type CoreEventDraft<Payload = unknown> = Omit<
  CoreEvent<Payload>,
  'id' | 'campaignId' | 'seq' | 'at'
>;

export type ModuleEventDraft<Payload = unknown> = Omit<
  ModuleEvent<Payload>,
  'id' | 'campaignId' | 'seq' | 'at'
>;

export type EventDraft<Payload = unknown> = CoreEventDraft<Payload> | ModuleEventDraft<Payload>;

/** Which part of the log to read. Both bounds include the event they name. */
export interface ReadRange {
  /** Lowest position to include. Defaults to the first event. */
  readonly from?: number;
  /** Highest position to include. Defaults to the last event. */
  readonly to?: number;
}

/**
 * Something went wrong reaching the log itself.
 *
 * This is deliberately narrow. It covers the storage being unreadable or
 * refusing a write, and nothing else. A malformed event is not represented
 * here because the types prevent one being offered.
 */
export interface LogFailure {
  readonly kind: 'storage-failed';
  /** Readable description, suitable for a log line or a report. */
  readonly detail: string;
  /** Whatever the implementation caught, if anything. */
  readonly cause?: unknown;
}

/**
 * One campaign's log.
 *
 * A log instance belongs to exactly one campaign, which is why appending does
 * not take a campaign identifier. That mirrors storage, where a campaign is one
 * file.
 */
export interface EventLog {
  /** The campaign this log belongs to. */
  readonly campaignId: CampaignId;

  /**
   * Record something that happened.
   *
   * Returns the event as stored, including the position it was given. Positions
   * are assigned here and never by the caller, so that they cannot collide.
   */
  append<Payload>(draft: EventDraft<Payload>): Result<EventEnvelope<Payload>, LogFailure>;

  /**
   * Read events in the order they happened.
   *
   * A range outside the log is not a failure. It reads as nothing, because
   * asking for events that do not exist yet is a normal thing to do while
   * catching up.
   */
  read(range?: ReadRange): Result<readonly EventEnvelope[], LogFailure>;

  /** How many events the campaign has. */
  count(): Result<number, LogFailure>;
}

/**
 * The two things a log needs from the outside world.
 *
 * Time and identity are the only unpredictable inputs to writing an event, so
 * they are supplied rather than reached for. That keeps core free of the
 * platform, and it lets a test make both predictable and assert on exact
 * values.
 */
export interface LogEnvironment {
  /** The current time, as an ISO 8601 string. */
  readonly now: () => string;
  /** A fresh identifier, unique within the campaign and sortable. */
  readonly nextEventId: () => EventId;
}

/** Whether a draft belongs to a system module. */
export function isModuleEventDraft<Payload>(
  draft: EventDraft<Payload>,
): draft is ModuleEventDraft<Payload> {
  return draft.type.startsWith('sys.');
}
