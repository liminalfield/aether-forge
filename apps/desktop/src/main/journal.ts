import { describeFailure, journal, type JournalEntry, type OpenCampaign } from '@aether-forge/core';

import type { IpcFailure, IpcResult, JournalEntryView, JournalView } from '../shared/ipc';
import { ENTRY_CREATED, type EntryCreatedV1 } from '@aether-forge/core';

/**
 * Writing journal entries into the campaign log.
 *
 * The shape of what it writes is declared in `event-types.ts`, alongside every
 * other event type this build knows. Nothing here names a version: the log
 * stamps the current one from those declarations, because a caller that names
 * its own version can name a stale one and nothing would notice.
 */

function toView(entry: JournalEntry): JournalEntryView {
  return {
    id: entry.id,
    text: entry.text,
    currentVersionId: entry.currentVersionId,
    corrections: entry.corrections,
  };
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
export function recordEntry(campaign: OpenCampaign, text: unknown): IpcResult<JournalEntryView> {
  if (typeof text !== 'string') {
    return asIpcFailure('invalid-request', 'a journal entry needs text');
  }

  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return asIpcFailure('invalid-request', 'a journal entry cannot be empty');
  }

  const appended = campaign.append<EntryCreatedV1>({
    type: ENTRY_CREATED,
    payload: { text: trimmed },
  });

  if (!appended.ok) {
    return asIpcFailure(appended.failure.kind, describeFailure(appended.failure));
  }

  // The entry as it now stands, so the window can show it without asking for
  // the whole journal again.
  const written = campaign.stateOf(journal).entries.find((entry) => entry.id === appended.value.id);
  if (!written) {
    return asIpcFailure(
      'projection-failed',
      'the entry was recorded but the journal did not show it',
    );
  }

  return { ok: true, value: toView(written) };
}

/**
 * Every entry in the campaign, oldest first.
 *
 * Reads state the campaign already holds, so this costs nothing beyond copying
 * it. Nothing is re-read from disk.
 */
export function readJournal(campaign: OpenCampaign): IpcResult<JournalView> {
  return { ok: true, value: { entries: campaign.stateOf(journal).entries.map(toView) } };
}
