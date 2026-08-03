import type { EventLog } from '@aether-forge/core';

import type { IpcFailure, IpcResult, RecordedEntry } from '../shared/ipc';

/**
 * Writing journal entries into the campaign log.
 *
 * ## The first payload schema
 *
 * `core.entry.created` version 1 carries `{ text: string }`.
 *
 * This is the first event payload the project has ever declared, and payload
 * schemas are permanent: once someone's campaign contains one of these, it has
 * to stay readable. It can still change, but only by declaring version 2 and
 * writing a translation from version 1, never by editing what is stored.
 *
 * A journal entry holding its text is about as safe a first schema as exists,
 * since the session log is the product and prose is what it is made of. The
 * fuller design, covering inline mentions and inline roll results, belongs to
 * the journal's own design record.
 */

export const ENTRY_CREATED = 'core.entry.created';
export const ENTRY_CREATED_SCHEMA_VERSION = 1;

export interface EntryCreated {
  readonly text: string;
}

function asIpcFailure(kind: string, detail: string): IpcResult<never> {
  const failure: IpcFailure = { kind, detail };
  return { ok: false, failure };
}

/**
 * Record a journal entry.
 *
 * Validates its input rather than trusting it. This is called with whatever
 * arrives over IPC, and the window is a different process, so "the caller is
 * our own code" is an assumption rather than a fact.
 */
export function recordEntry(log: EventLog, text: unknown): IpcResult<RecordedEntry> {
  if (typeof text !== 'string') {
    return asIpcFailure('invalid-request', 'a journal entry needs text');
  }

  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return asIpcFailure('invalid-request', 'a journal entry cannot be empty');
  }

  const appended = log.append<EntryCreated>({
    type: ENTRY_CREATED,
    schemaVersion: ENTRY_CREATED_SCHEMA_VERSION,
    payload: { text: trimmed },
  });

  if (!appended.ok) {
    return asIpcFailure(appended.failure.kind, appended.failure.detail);
  }

  return { ok: true, value: { seq: appended.value.seq } };
}

/** How many events this campaign has recorded. */
export function countEvents(log: EventLog): IpcResult<number> {
  const counted = log.count();
  return counted.ok
    ? { ok: true, value: counted.value }
    : asIpcFailure(counted.failure.kind, counted.failure.detail);
}
