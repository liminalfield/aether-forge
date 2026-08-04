import { describe, expect, it } from 'vitest';

import type { EventEnvelope } from './event.js';
import { createMemoryEventLog } from './memory-log.js';
import { buildFromLog, replay, type Projection } from './projection.js';
import { createEventSchemas } from './schema.js';
import { describeProjectionIsPredictable } from './testing/projection-contract.js';
import { createTranslatingLog } from './translating-log.js';

const ENTRY = 'core.entry.created';

/** How many entries the campaign has, and what the most recent one said. */
interface JournalSummary {
  readonly entries: number;
  readonly latest: string | null;
}

const journalSummary: Projection<JournalSummary> = {
  id: 'core.journal-summary',
  initial: () => ({ entries: 0, latest: null }),
  apply: (state, event) =>
    event.type === ENTRY
      ? { entries: state.entries + 1, latest: (event.payload as { text: string }).text }
      : state,
};

function anEvent(seq: number, text: string): EventEnvelope {
  return {
    id: `event-${seq}`,
    campaignId: 'campaign-under-test',
    seq,
    at: '2026-08-04T09:00:00.000Z',
    type: ENTRY,
    schemaVersion: 1,
    payload: { text },
  };
}

const aShortCampaign = (): readonly EventEnvelope[] => [
  anEvent(1, 'The airlock did not open.'),
  anEvent(2, 'It opened on the second try.'),
];

describeProjectionIsPredictable('a journal summary', () => journalSummary, aShortCampaign);

describe('replaying events', () => {
  it('starts from nothing', () => {
    expect(replay(journalSummary, [])).toEqual({ entries: 0, latest: null });
  });

  it('applies events in the order given', () => {
    expect(replay(journalSummary, aShortCampaign())).toEqual({
      entries: 2,
      latest: 'It opened on the second try.',
    });
  });

  it('gives a different answer for a different order, which is why order is the log s job', () => {
    const reversed = [...aShortCampaign()].reverse();
    expect(replay(journalSummary, reversed).latest).toBe('The airlock did not open.');
  });
});

describe('building from a campaign', () => {
  function aCampaignWithTwoEntries() {
    let tick = 0;
    const stored = createMemoryEventLog({
      campaignId: 'campaign-under-test',
      now: () => `2026-08-04T09:00:0${(tick += 1)}.000Z`,
      nextEventId: () => `event-${tick}`,
    });
    const schemas = createEventSchemas();
    schemas.declare({ type: ENTRY, currentVersion: 1, translations: [] });

    const log = createTranslatingLog(stored, schemas);
    log.append({ type: ENTRY, payload: { text: 'The airlock did not open.' } });
    log.append({ type: ENTRY, payload: { text: 'It opened on the second try.' } });
    return log;
  }

  it('reads the campaign from the beginning', () => {
    const built = buildFromLog(journalSummary, aCampaignWithTwoEntries());

    expect(built.ok && built.value).toEqual({
      entries: 2,
      latest: 'It opened on the second try.',
    });
  });

  it('reports a campaign it cannot read rather than returning a half-built state', () => {
    const stored = createMemoryEventLog({
      campaignId: 'c',
      now: () => 'now',
      nextEventId: () => 'e',
    });
    const schemas = createEventSchemas();
    schemas.declare({ type: ENTRY, currentVersion: 1, translations: [] });
    createTranslatingLog(stored, schemas).append({ type: ENTRY, payload: { text: 'a' } });

    // A build that no longer declares the type at all.
    const built = buildFromLog(journalSummary, createTranslatingLog(stored, createEventSchemas()));

    expect(!built.ok && built.failure.kind).toBe('unknown-event-type');
  });
});
