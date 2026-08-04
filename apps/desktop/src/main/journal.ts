import { describeFailure, type TranslatingLog } from '@aether-forge/core';

import type { IpcFailure, IpcResult, RecordedEntry } from '../shared/ipc';
import { ENTRY_CREATED, type EntryCreatedV1 } from './event-types';

/**
 * Writing journal entries into the campaign log.
 *
 * The shape of what it writes is declared in `event-types.ts`, alongside every
 * other event type this build knows. Nothing here names a version: the log
 * stamps the current one from those declarations, because a caller that names
 * its own version can name a stale one and nothing would notice.
 */

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
export function recordEntry(log: TranslatingLog, text: unknown): IpcResult<RecordedEntry> {
  if (typeof text !== 'string') {
    return asIpcFailure('invalid-request', 'a journal entry needs text');
  }

  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return asIpcFailure('invalid-request', 'a journal entry cannot be empty');
  }

  const appended = log.append<EntryCreatedV1>({
    type: ENTRY_CREATED,
    payload: { text: trimmed },
  });

  if (!appended.ok) {
    return asIpcFailure(appended.failure.kind, describeFailure(appended.failure));
  }

  return { ok: true, value: { seq: appended.value.seq } };
}

/** How many events this campaign has recorded. */
export function countEvents(log: TranslatingLog): IpcResult<number> {
  const counted = log.count();
  return counted.ok
    ? { ok: true, value: counted.value }
    : asIpcFailure(counted.failure.kind, describeFailure(counted.failure));
}
