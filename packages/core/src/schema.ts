/**
 * Event shapes change; recorded events do not.
 *
 * Every event records which version of its shape was used when it was written.
 * When a shape later changes, a translation turns the older version into the
 * next one. Reading an old event runs it through however many translations it
 * needs, so that everything downstream only ever sees the current shape.
 *
 * The log is never rewritten. A campaign from years ago is read through
 * translations, not migrated.
 *
 * This declares and checks those translations. Applying them when reading is
 * separate, and comes next.
 *
 * See `design/event-log-and-projections.md`.
 */

import type { EventType } from './event.js';
import { failed, ok, type Result } from './result.js';

/**
 * Turns one version of an event's data into the next one.
 *
 * The payload is `unknown` on both sides on purpose. It was read off a disk
 * that may have been written by an older build, so what it actually contains is
 * a belief rather than a fact. Deciding what it was is the translation's job,
 * and it is the right place to be careful about it.
 */
export interface Translation {
  /** The event type this translates. */
  readonly type: EventType;
  /** The version it reads. It produces `fromVersion + 1`. */
  readonly fromVersion: number;
  readonly translate: (payload: unknown) => unknown;
}

/**
 * Whether an event of this type can be corrected, and how.
 *
 * `replaces-a-value` means the event says what something *is*: the text of an
 * entry, a field on an entity. Correcting it means appending an event that
 * supersedes it and carries the whole new value. Later values win and nothing
 * is ever undone.
 *
 * `records-a-change` means the event says what *happened*: a resource moved by
 * two, progress was marked. That happened, and it stays happened. Correcting it
 * means appending a further change that compensates, so the log shows both what
 * occurred and what was done about it. Superseding one would make the events
 * stop adding up to the state.
 */
export type CorrectionStyle = 'replaces-a-value' | 'records-a-change';

/** An event type, the shape it is on now, and how to reach that from older ones. */
export interface EventTypeDefinition {
  readonly type: EventType;
  /** The version new events are written at. Starts at 1. */
  readonly currentVersion: number;
  /**
   * One translation per step: 1 to 2, 2 to 3, and so on up to the current
   * version. A type that has never changed has none.
   */
  readonly translations: readonly Translation[];

  /** Defaults to `replaces-a-value`, which is the ordinary case. */
  readonly corrections?: CorrectionStyle;
}

export type SchemaFailure =
  | { readonly kind: 'already-declared'; readonly type: EventType }
  | { readonly kind: 'unknown-event-type'; readonly type: EventType }
  | {
      readonly kind: 'version-must-be-at-least-one';
      readonly type: EventType;
      readonly given: number;
    }
  | {
      /** A step is missing, so an old event could not be brought up to date. */
      readonly kind: 'incomplete-history';
      readonly type: EventType;
      readonly missingSteps: readonly number[];
    }
  | {
      readonly kind: 'translation-for-another-type';
      readonly type: EventType;
      readonly translationType: EventType;
    }
  | {
      /**
       * Something tried to supersede an event that records a change rather than
       * a value. Such an event stays as it is and is compensated instead.
       */
      readonly kind: 'cannot-be-superseded';
      readonly type: EventType;
    }
  | {
      /**
       * The event was written by a build that knew a later shape than this one
       * does. There is no way to translate forwards into the past.
       */
      readonly kind: 'written-by-a-newer-version';
      readonly type: EventType;
      readonly storedVersion: number;
      readonly knownVersion: number;
    };

export interface EventSchemas {
  /** Declare an event type. Fails rather than overwriting an existing one. */
  declare(definition: EventTypeDefinition): Result<void, SchemaFailure>;

  /** Whether this type has been declared. */
  knows(type: EventType): boolean;

  /**
   * Every type declared so far, in the order they were declared.
   *
   * Here so that a check can ask what a build knows rather than being handed a
   * list and trusting it. Without that, a test covering "every event type" can
   * only cover the ones it was told about, which is how a newly declared type
   * ends up with no coverage and nothing saying so.
   */
  declaredTypes(): readonly EventType[];

  /** The version new events of this type are written at. */
  currentVersion(type: EventType): Result<number, SchemaFailure>;

  /** How an event of this type is corrected. */
  correctionStyle(type: EventType): Result<CorrectionStyle, SchemaFailure>;

  /**
   * The translations needed to bring an event written at `storedVersion` up to
   * the current shape, in the order they must run.
   *
   * An event already at the current version needs none, which is the ordinary
   * case and is not a failure.
   */
  translationsFrom(
    type: EventType,
    storedVersion: number,
  ): Result<readonly Translation[], SchemaFailure>;
}

/**
 * Check that the translations form an unbroken chain up to the current version.
 *
 * Done when the type is declared rather than when an old event is read. A hole
 * in the chain is a mistake made today whose consequence lands years from now,
 * on someone opening an old campaign, which is the worst possible moment to
 * discover it.
 */
function findMissingSteps(definition: EventTypeDefinition): number[] {
  const provided = new Set(definition.translations.map((step) => step.fromVersion));
  const missing: number[] = [];

  for (let version = 1; version < definition.currentVersion; version += 1) {
    if (!provided.has(version)) missing.push(version);
  }

  return missing;
}

export function createEventSchemas(): EventSchemas {
  const declared = new Map<EventType, EventTypeDefinition>();

  return {
    declare(definition: EventTypeDefinition): Result<void, SchemaFailure> {
      const { type, currentVersion, translations } = definition;

      if (declared.has(type)) {
        return failed({ kind: 'already-declared', type });
      }

      if (!Number.isInteger(currentVersion) || currentVersion < 1) {
        return failed({ kind: 'version-must-be-at-least-one', type, given: currentVersion });
      }

      const stray = translations.find((step) => step.type !== type);
      if (stray) {
        return failed({
          kind: 'translation-for-another-type',
          type,
          translationType: stray.type,
        });
      }

      const missingSteps = findMissingSteps(definition);
      if (missingSteps.length > 0) {
        return failed({ kind: 'incomplete-history', type, missingSteps });
      }

      declared.set(type, definition);
      return ok(undefined);
    },

    knows(type: EventType): boolean {
      return declared.has(type);
    },

    declaredTypes(): readonly EventType[] {
      return [...declared.keys()];
    },

    currentVersion(type: EventType): Result<number, SchemaFailure> {
      const definition = declared.get(type);
      return definition
        ? ok(definition.currentVersion)
        : failed({ kind: 'unknown-event-type', type });
    },

    correctionStyle(type: EventType): Result<CorrectionStyle, SchemaFailure> {
      const definition = declared.get(type);
      return definition
        ? ok(definition.corrections ?? 'replaces-a-value')
        : failed({ kind: 'unknown-event-type', type });
    },

    translationsFrom(
      type: EventType,
      storedVersion: number,
    ): Result<readonly Translation[], SchemaFailure> {
      const definition = declared.get(type);
      if (!definition) {
        return failed({ kind: 'unknown-event-type', type });
      }

      if (!Number.isInteger(storedVersion) || storedVersion < 1) {
        return failed({ kind: 'version-must-be-at-least-one', type, given: storedVersion });
      }

      if (storedVersion > definition.currentVersion) {
        return failed({
          kind: 'written-by-a-newer-version',
          type,
          storedVersion,
          knownVersion: definition.currentVersion,
        });
      }

      const needed = definition.translations
        .filter((step) => step.fromVersion >= storedVersion)
        .sort((left, right) => left.fromVersion - right.fromVersion);

      return ok(needed);
    },
  };
}
