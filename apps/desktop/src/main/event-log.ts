import type {
  CampaignId,
  CoreEventType,
  EventDraft,
  EventEnvelope,
  EventLog,
  LogEnvironment,
  LogFailure,
  ModuleEventType,
  ReadRange,
} from '@aether-forge/core';
import { failed, isModuleEventDraft, ok, type Result } from '@aether-forge/core';
import type Database from 'better-sqlite3';

/**
 * The campaign log, stored in SQLite.
 *
 * Core describes what a log has to do; this is the implementation that ships.
 * It is held to the same behaviour checks as the in-memory one, imported from
 * `@aether-forge/core/testing`, so the two stay interchangeable.
 *
 * There is no campaign column. One campaign is one database file, so storing
 * the campaign on every row would repeat the filename ten thousand times. The
 * log stamps it onto events as they are read, from the campaign it was opened
 * for.
 */

interface EventRow {
  readonly id: string;
  readonly seq: number;
  readonly at: string;
  readonly type: string;
  readonly schema_version: number;
  readonly system_id: string | null;
  readonly causation_id: string | null;
  readonly revises: string | null;
  readonly payload: string;
}

function isCoreEventType(type: string): type is CoreEventType {
  return type.startsWith('core.');
}

function isModuleEventType(type: string): type is ModuleEventType {
  return type.startsWith('sys.');
}

/**
 * Turn a stored row back into an event.
 *
 * Throws on a row that cannot be one. Only a log edited outside the application
 * can produce that, and it is better to say so than to hand back something
 * shaped like an event but not one. The caller turns it into a failure.
 */
function toEvent(row: EventRow, campaignId: CampaignId): EventEnvelope {
  const common = {
    id: row.id,
    campaignId,
    seq: row.seq,
    at: row.at,
    schemaVersion: row.schema_version,
    // JSON.parse returns any; narrowing it to unknown is the point.
    payload: JSON.parse(row.payload) as unknown,
    // Absent and present-but-empty are different things, so optional fields are
    // added only when they are there.
    ...(row.causation_id === null ? {} : { causationId: row.causation_id }),
    ...(row.revises === null ? {} : { revises: row.revises }),
  };

  if (row.system_id !== null && isModuleEventType(row.type)) {
    return { ...common, type: row.type, systemId: row.system_id };
  }

  if (row.system_id === null && isCoreEventType(row.type)) {
    return { ...common, type: row.type };
  }

  throw new Error(
    `event ${row.id} at position ${row.seq} has type "${row.type}" ` +
      `and ${row.system_id === null ? 'no owning module' : `owning module "${row.system_id}"`}, ` +
      'which is not a shape this log can produce',
  );
}

function storageFailed(detail: string, cause: unknown): Result<never, LogFailure> {
  return failed({ kind: 'storage-failed', detail, cause });
}

export function openEventLog(
  db: Database.Database,
  campaignId: CampaignId,
  environment: LogEnvironment,
): EventLog {
  const nextSeq = db.prepare<[], { next: number }>(
    'SELECT COALESCE(MAX(seq), 0) + 1 AS next FROM events',
  );

  const insert = db.prepare(
    `INSERT INTO events (id, seq, at, type, schema_version, system_id, causation_id, revises, payload)
     VALUES (@id, @seq, @at, @type, @schemaVersion, @systemId, @causationId, @revises, @payload)`,
  );

  const selectRange = db.prepare<[number, number], EventRow>(
    'SELECT * FROM events WHERE seq >= ? AND seq <= ? ORDER BY seq',
  );

  const selectCount = db.prepare<[], { total: number }>('SELECT COUNT(*) AS total FROM events');

  /**
   * Reads the next position and writes the row in one transaction, so two
   * appends cannot both decide they are number 47.
   *
   * Only the main process writes, so there is nothing to contend with today.
   * The transaction is what makes that a property of the code rather than a
   * hope, and it is what will still be true if that assumption ever changes.
   *
   * Returns only what the log decided, so that the caller can attach it to the
   * draft without losing what the payload's type was.
   */
  const allocateAndInsert = db.transaction((draft: EventDraft) => {
    const seq = nextSeq.get()?.next ?? 1;
    const id = environment.nextEventId();
    const at = environment.now();

    insert.run({
      id,
      seq,
      at,
      type: draft.type,
      schemaVersion: draft.schemaVersion,
      systemId: isModuleEventDraft(draft) ? draft.systemId : null,
      causationId: draft.causationId ?? null,
      revises: draft.revises ?? null,
      payload: JSON.stringify(draft.payload),
    });

    return { id, campaignId, seq, at };
  });

  return {
    campaignId,

    append<Payload>(draft: EventDraft<Payload>): Result<EventEnvelope<Payload>, LogFailure> {
      try {
        const recorded = allocateAndInsert(draft);
        return ok(
          isModuleEventDraft(draft) ? { ...draft, ...recorded } : { ...draft, ...recorded },
        );
      } catch (cause) {
        return storageFailed(`could not append a ${draft.type} event`, cause);
      }
    },

    read(range?: ReadRange): Result<readonly EventEnvelope[], LogFailure> {
      try {
        const from = range?.from ?? 1;
        const to = range?.to ?? Number.MAX_SAFE_INTEGER;
        return ok(selectRange.all(from, to).map((row) => toEvent(row, campaignId)));
      } catch (cause) {
        return storageFailed('could not read the campaign log', cause);
      }
    },

    count(): Result<number, LogFailure> {
      try {
        return ok(selectCount.get()?.total ?? 0);
      } catch (cause) {
        return storageFailed('could not count the campaign log', cause);
      }
    },
  };
}
