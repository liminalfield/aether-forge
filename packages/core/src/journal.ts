/**
 * Prose entries, and correcting them.
 *
 * Core owns the `core.entry.*` family, so it declares those shapes rather than
 * leaving each application to invent them.
 *
 * An entry is identified by the event that created it. Correcting one appends
 * an event that supersedes the last version and carries the whole new text.
 * Later text wins, and nothing ever has to be undone. A chain of corrections
 * resolves back to the entry it belongs to, so correcting a correction works
 * without anything special.
 *
 * See `design/event-log-and-projections.md`.
 */

import type { EventEnvelope } from './event.js';
import type { EventId } from './identifiers.js';
import type { Projection } from './projection.js';
import type { EventTypeDefinition } from './schema.js';

export const ENTRY_CREATED = 'core.entry.created';
export const ENTRY_REVISED = 'core.entry.revised';

/** Version 1 of a written entry. */
export interface EntryCreatedV1 {
  readonly text: string;
}

/**
 * Version 1 of a corrected entry.
 *
 * Carries the whole new text, not a description of what changed. The event's
 * `revises` says which version it replaces.
 */
export interface EntryRevisedV1 {
  readonly text: string;
}

function hasText(payload: unknown): payload is { text: string } {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    typeof (payload as { text?: unknown }).text === 'string'
  );
}

export const journalEventTypes: readonly EventTypeDefinition[] = [
  { type: ENTRY_CREATED, currentVersion: 1, translations: [], corrections: 'replaces-a-value' },
  { type: ENTRY_REVISED, currentVersion: 1, translations: [], corrections: 'replaces-a-value' },
];

export interface JournalEntry {
  /** The event that created it. An entry keeps this identity through corrections. */
  readonly id: EventId;
  readonly text: string;
  /** How many times it has been corrected. */
  readonly corrections: number;
}

export interface Journal {
  /** In the order they were written. */
  readonly entries: readonly JournalEntry[];
  /**
   * Which entry each event belongs to, so that correcting a correction
   * resolves back to the original entry.
   *
   * A plain object rather than a Map, so the state stays something that can be
   * written out unchanged when snapshots arrive.
   */
  readonly entryOf: Readonly<Record<EventId, EventId>>;
}

/** Every entry in the campaign, with corrections already applied. */
export const journal: Projection<Journal> = {
  id: 'core.journal',

  initial: () => ({ entries: [], entryOf: {} }),

  apply: (state, event: EventEnvelope): Journal => {
    if (event.type === ENTRY_CREATED && hasText(event.payload)) {
      return {
        entries: [...state.entries, { id: event.id, text: event.payload.text, corrections: 0 }],
        entryOf: { ...state.entryOf, [event.id]: event.id },
      };
    }

    if (event.type === ENTRY_REVISED && hasText(event.payload)) {
      // A correction that supersedes nothing, or supersedes something this
      // campaign has never seen, is not something to guess about.
      const supersedes = event.revises;
      if (supersedes === undefined) return state;

      const entryId = state.entryOf[supersedes];
      if (entryId === undefined) return state;

      const text = event.payload.text;

      return {
        entries: state.entries.map((entry) =>
          entry.id === entryId ? { ...entry, text, corrections: entry.corrections + 1 } : entry,
        ),
        entryOf: { ...state.entryOf, [event.id]: entryId },
      };
    }

    return state;
  },
};
