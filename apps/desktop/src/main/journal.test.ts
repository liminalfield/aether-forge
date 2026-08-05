import {
  createMemoryEventLog,
  createTranslatingLog,
  openCampaign,
  journal,
  type EventLog,
  type OpenCampaign,
  type Projection,
} from '@aether-forge/core';
import { describe, expect, it } from 'vitest';

import { declareEventTypes } from './event-types';
import { correctEntry, readJournal, recordEntry } from './journal';

function aCampaign(): { campaign: OpenCampaign; stored: EventLog } {
  let tick = 0;
  const stored = createMemoryEventLog({
    campaignId: 'campaign-under-test',
    now: () => `2026-08-05T09:00:0${(tick += 1)}.000Z`,
    nextEventId: () => `event-${tick}`,
  });

  const opened = openCampaign(createTranslatingLog(stored, declareEventTypes()), {
    projections: [journal as Projection<unknown>],
  });
  if (!opened.ok) throw new Error('could not open');

  return { campaign: opened.value, stored };
}

describe('correcting an entry', () => {
  it('supersedes the version that currently holds the text', () => {
    // Not visible from the window, which only ever sees entries. Checked here
    // because it is the difference between a history that reads as a chain and
    // one that reads as several events all superseding the original.
    const { campaign, stored } = aCampaign();
    const written = recordEntry(campaign, 'first');
    if (!written.ok) throw new Error('could not record');

    correctEntry(campaign, written.value.id, 'second');
    correctEntry(campaign, written.value.id, 'third');

    const events = stored.read();
    if (!events.ok) throw new Error('could not read');

    expect(events.value.map((event) => event.revises ?? null)).toEqual([
      null,
      events.value[0]?.id,
      events.value[1]?.id,
    ]);
  });

  it('leaves one entry saying the latest thing', () => {
    const { campaign } = aCampaign();
    const written = recordEntry(campaign, 'first');
    if (!written.ok) throw new Error('could not record');

    correctEntry(campaign, written.value.id, 'second');
    const read = readJournal(campaign);

    expect(read.ok && read.value.entries).toHaveLength(1);
    expect(read.ok && read.value.entries[0]?.text).toBe('second');
    expect(read.ok && read.value.entries[0]?.corrections).toBe(1);
  });

  it('refuses an entry this campaign does not have', () => {
    const { campaign } = aCampaign();
    const result = correctEntry(campaign, 'somewhere-else', 'nonsense');

    expect(!result.ok && result.failure.kind).toBe('unknown-entry');
  });

  it('refuses empty text, and says why', () => {
    const { campaign } = aCampaign();
    const written = recordEntry(campaign, 'first');
    if (!written.ok) throw new Error('could not record');

    const result = correctEntry(campaign, written.value.id, '   ');

    expect(!result.ok && result.failure.detail).toBe('a journal entry cannot be empty');
  });
});
