import { describe, expect, it } from 'vitest';

import { openCampaign } from './campaign.js';
import { createMemoryEventLog } from './memory-log.js';
import { buildFromLog, type Projection } from './projection.js';
import { createEventSchemas } from './schema.js';
import { createTranslatingLog, type TranslatingLog } from './translating-log.js';

const ENTRY = 'core.entry.created';

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

/** Counts every event, whatever it is, so two projections are held at once. */
const everything: Projection<number> = {
  id: 'core.every-event',
  initial: () => 0,
  apply: (state) => state + 1,
};

function aLog(): TranslatingLog {
  let tick = 0;
  const schemas = createEventSchemas();
  schemas.declare({ type: ENTRY, currentVersion: 1, translations: [] });
  return createTranslatingLog(
    createMemoryEventLog({
      campaignId: 'campaign-under-test',
      now: () => `2026-08-04T09:00:0${(tick += 1)}.000Z`,
      nextEventId: () => `event-${tick}`,
    }),
    schemas,
  );
}

function openWith(log: TranslatingLog) {
  const opened = openCampaign(log, {
    projections: [journalSummary as Projection<unknown>, everything as Projection<unknown>],
  });
  if (!opened.ok) throw new Error(`could not open: ${opened.failure.kind}`);
  return opened.value;
}

describe('opening a campaign', () => {
  it('starts from nothing when there is nothing', () => {
    expect(openWith(aLog()).stateOf(journalSummary)).toEqual({ entries: 0, latest: null });
  });

  it('builds state from what is already recorded', () => {
    const log = aLog();
    log.append({ type: ENTRY, payload: { text: 'The airlock did not open.' } });
    log.append({ type: ENTRY, payload: { text: 'It opened on the second try.' } });

    expect(openWith(log).stateOf(journalSummary)).toEqual({
      entries: 2,
      latest: 'It opened on the second try.',
    });
  });

  it('refuses to answer for a projection it was not opened with', () => {
    const campaign = openWith(aLog());
    const unheld: Projection<number> = { id: 'never-asked-for', initial: () => 0, apply: (s) => s };

    expect(() => campaign.stateOf(unheld)).toThrow(/was not opened with/);
  });
});

describe('appending', () => {
  it('brings the state up to date without rereading the campaign', () => {
    const campaign = openWith(aLog());

    campaign.append({ type: ENTRY, payload: { text: 'The airlock did not open.' } });

    expect(campaign.stateOf(journalSummary)).toEqual({
      entries: 1,
      latest: 'The airlock did not open.',
    });
  });

  it('keeps every projection it was opened with up to date', () => {
    const campaign = openWith(aLog());
    campaign.append({ type: ENTRY, payload: { text: 'a' } });
    campaign.append({ type: ENTRY, payload: { text: 'b' } });

    expect(campaign.stateOf(everything)).toBe(2);
  });

  it('leaves the state alone when the append fails', () => {
    const campaign = openWith(aLog());
    // An event type nobody declared cannot be written.
    const appended = campaign.append({ type: 'core.nothing.declared', payload: {} });

    expect(appended.ok).toBe(false);
    expect(campaign.stateOf(everything)).toBe(0);
  });
});

describe('updating in place agrees with reading the whole campaign again', () => {
  /**
   * The claim this task exists to make. If these ever disagree, the campaign
   * shows one thing while it is open and a different thing after a restart,
   * which is the worst kind of bug this design can have.
   */
  it('gives the same answer either way, after every single event', () => {
    const log = aLog();
    const campaign = openWith(log);

    const written = ['first', 'second', 'third', 'fourth', 'fifth'];
    for (const text of written) {
      campaign.append({ type: ENTRY, payload: { text } });

      const fromScratch = buildFromLog(journalSummary, log);
      if (!fromScratch.ok) throw new Error('could not rebuild');

      expect(campaign.stateOf(journalSummary)).toEqual(fromScratch.value);
    }
  });

  it('agrees with a campaign reopened from the same log', () => {
    const log = aLog();
    const campaign = openWith(log);
    campaign.append({ type: ENTRY, payload: { text: 'The airlock did not open.' } });
    campaign.append({ type: ENTRY, payload: { text: 'It opened on the second try.' } });

    expect(openWith(log).stateOf(journalSummary)).toEqual(campaign.stateOf(journalSummary));
  });
});

describe('when a projection is broken', () => {
  const broken: Projection<number> = {
    id: 'broken',
    initial: () => 0,
    apply: () => {
      throw new Error('this projection has a bug');
    },
  };

  it('names it rather than failing silently', () => {
    const log = aLog();
    const opened = openCampaign(log, { projections: [broken as Projection<unknown>] });
    if (!opened.ok) throw new Error('expected to open on an empty campaign');

    const appended = opened.value.append({ type: ENTRY, payload: { text: 'a' } });

    expect(!appended.ok && appended.failure).toMatchObject({
      kind: 'projection-failed',
      projectionId: 'broken',
    });
  });

  it('reports it on opening a campaign that already has events', () => {
    const log = aLog();
    log.append({ type: ENTRY, payload: { text: 'a' } });

    const opened = openCampaign(log, { projections: [broken as Projection<unknown>] });
    expect(!opened.ok && opened.failure.kind).toBe('projection-failed');
  });
});
