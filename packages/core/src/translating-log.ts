/**
 * A log that always speaks the current shape of every event.
 *
 * Translation sits between reading and everything else. An event written years
 * ago under an older shape is brought up to date on its way out, so nothing
 * downstream ever handles an old shape or accumulates special cases for one.
 *
 * Writing goes the other way: the current version is stamped on from the
 * declared shapes, so no caller has to know or repeat it. A caller that names
 * its own version can name a stale one, and nothing would notice.
 *
 * The stored log is untouched by any of this. Translation happens on the way
 * out, every time. See `design/event-log-and-projections.md`.
 */

import { isModuleEvent, type EventEnvelope } from './event.js';
import type { CampaignId } from './identifiers.js';
import type { CoreEventDraft, EventLog, LogFailure, ModuleEventDraft, ReadRange } from './log.js';
import { failed, ok, type Result } from './result.js';
import type { EventSchemas, SchemaFailure } from './schema.js';

/** A draft without a version, because the declared shapes decide that. */
export type UnversionedCoreEventDraft<Payload = unknown> = Omit<
  CoreEventDraft<Payload>,
  'schemaVersion'
>;

export type UnversionedModuleEventDraft<Payload = unknown> = Omit<
  ModuleEventDraft<Payload>,
  'schemaVersion'
>;

export type UnversionedEventDraft<Payload = unknown> =
  UnversionedCoreEventDraft<Payload> | UnversionedModuleEventDraft<Payload>;

/**
 * Whether an unversioned draft belongs to a system module.
 *
 * Separate from the guard for versioned drafts. They are different shapes, and
 * sharing one guard would mean widening a type to make it fit, which is how a
 * check stops checking.
 */
function isUnversionedModuleDraft<Payload>(
  draft: UnversionedEventDraft<Payload>,
): draft is UnversionedModuleEventDraft<Payload> {
  return draft.type.startsWith('sys.');
}

/** A translation threw. It is ordinary code and can have ordinary bugs. */
export interface TranslationFailed {
  readonly kind: 'translation-failed';
  readonly type: string;
  readonly fromVersion: number;
  readonly detail: string;
  readonly cause?: unknown;
}

export type TranslatingLogFailure = LogFailure | SchemaFailure | TranslationFailed;

export interface TranslatingLog {
  readonly campaignId: CampaignId;

  append<Payload>(
    draft: UnversionedEventDraft<Payload>,
  ): Result<EventEnvelope<Payload>, TranslatingLogFailure>;

  read(range?: ReadRange): Result<readonly EventEnvelope[], TranslatingLogFailure>;

  count(): Result<number, LogFailure>;
}

export function createTranslatingLog(log: EventLog, schemas: EventSchemas): TranslatingLog {
  function bringUpToDate(event: EventEnvelope): Result<EventEnvelope, TranslatingLogFailure> {
    const steps = schemas.translationsFrom(event.type, event.schemaVersion);
    if (!steps.ok) return steps;

    // Already current, which is the ordinary case and costs nothing.
    if (steps.value.length === 0) return ok(event);

    const currentVersion = schemas.currentVersion(event.type);
    if (!currentVersion.ok) return currentVersion;

    let payload: unknown = event.payload;
    for (const step of steps.value) {
      try {
        payload = step.translate(payload);
      } catch (cause) {
        return failed({
          kind: 'translation-failed',
          type: event.type,
          fromVersion: step.fromVersion,
          detail: `translating ${event.type} from version ${step.fromVersion} threw`,
          cause,
        });
      }
    }

    const updated = { payload, schemaVersion: currentVersion.value };

    // Branched rather than spread over the union, so that core and module
    // events stay distinguishable to the compiler.
    return ok(isModuleEvent(event) ? { ...event, ...updated } : { ...event, ...updated });
  }

  return {
    campaignId: log.campaignId,

    append<Payload>(
      draft: UnversionedEventDraft<Payload>,
    ): Result<EventEnvelope<Payload>, TranslatingLogFailure> {
      const version = schemas.currentVersion(draft.type);
      if (!version.ok) return version;

      // An event that records a change stays as it happened. Correcting one
      // means appending a further change, not replacing the original, or the
      // events stop adding up to the state.
      if (draft.revises !== undefined) {
        const style = schemas.correctionStyle(draft.type);
        if (!style.ok) return style;
        if (style.value === 'records-a-change') {
          return failed({ kind: 'cannot-be-superseded', type: draft.type });
        }
      }

      const schemaVersion = version.value;
      return isUnversionedModuleDraft(draft)
        ? log.append<Payload>({ ...draft, schemaVersion })
        : log.append<Payload>({ ...draft, schemaVersion });
    },

    read(range?: ReadRange): Result<readonly EventEnvelope[], TranslatingLogFailure> {
      const stored = log.read(range);
      if (!stored.ok) return stored;

      const current: EventEnvelope[] = [];
      for (const event of stored.value) {
        const brought = bringUpToDate(event);
        if (!brought.ok) return brought;
        current.push(brought.value);
      }

      return ok(current);
    },

    count(): Result<number, LogFailure> {
      return log.count();
    },
  };
}
