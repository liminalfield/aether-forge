import { createMemoryEventLog, createTranslatingLog, openCampaign } from '@aether-forge/core';
import type {
  ModuleProjection,
  OpenCampaign,
  Projection,
  TranslatingLog,
} from '@aether-forge/core';
import { momentum } from '@aether-forge/system-ironsworn';
import { coinTally } from '@aether-forge/system-toy';
import { describe, expect, it } from 'vitest';

import { declareEventTypes, ENTRY_CREATED } from './event-types';
import { RECORDED_SESSION } from './recorded-session';

/** How many entries the campaign has, and what the last one said. A core view. */
interface JournalSummary {
  readonly entries: number;
  readonly latest: string | null;
}

const journalSummary: Projection<JournalSummary> = {
  id: 'core.journal-summary',
  initial: () => ({ entries: 0, latest: null }),
  apply: (state, event) =>
    event.type === ENTRY_CREATED
      ? { entries: state.entries + 1, latest: (event.payload as { text: string }).text }
      : state,
};

function anEmptyCampaign(): TranslatingLog {
  let tick = 0;
  return createTranslatingLog(
    createMemoryEventLog({
      campaignId: 'the-sundered-reach',
      // Fixed, because a fixture whose output depends on when it ran is not a
      // fixture.
      now: () => `2026-08-04T09:${String((tick += 1)).padStart(2, '0')}:00.000Z`,
      nextEventId: () => `event-${String(tick).padStart(3, '0')}`,
    }),
    declareEventTypes(),
  );
}

function playTheSession(): OpenCampaign {
  const opened = openCampaign(anEmptyCampaign(), {
    projections: [journalSummary as Projection<unknown>],
    moduleProjections: [
      coinTally as ModuleProjection<unknown>,
      momentum as ModuleProjection<unknown>,
    ],
  });
  if (!opened.ok) throw new Error(`could not open: ${opened.failure.kind}`);

  for (const draft of RECORDED_SESSION) {
    const appended = opened.value.append(draft);
    if (!appended.ok) throw new Error(`could not record ${draft.type}: ${appended.failure.kind}`);
  }

  return opened.value;
}

describe('a recorded session', () => {
  it('records every event in it', () => {
    expect(playTheSession().count()).toEqual({ ok: true, value: RECORDED_SESSION.length });
  });

  it('is long enough to be worth replaying', () => {
    expect(RECORDED_SESSION.length).toBeGreaterThanOrEqual(30);
  });

  it('produces exactly the same state every time it is played', () => {
    // The claim the whole model rests on. Fixed expected values rather than a
    // comparison between two runs, so that a change in behaviour is caught even
    // if it changes both runs in the same way.
    const campaign = playTheSession();

    expect(campaign.stateOf(journalSummary)).toEqual({
      entries: 18,
      latest: 'End of session.',
    });
    expect(campaign.moduleStateOf(coinTally)).toEqual({ flips: 8, heads: 5, tails: 3 });
    expect(campaign.moduleStateOf(momentum)).toEqual({
      current: 4,
      highest: 7,
      lowest: 1,
      changes: 9,
    });
  });

  it('gives the same answer played twice', () => {
    const once = playTheSession();
    const again = playTheSession();

    expect(again.stateOf(journalSummary)).toEqual(once.stateOf(journalSummary));
    expect(again.moduleStateOf(coinTally)).toEqual(once.moduleStateOf(coinTally));
    expect(again.moduleStateOf(momentum)).toEqual(once.moduleStateOf(momentum));
  });

  it('has each module counting only what belongs to it', () => {
    const campaign = playTheSession();

    // Worth being exact about what this shows. Both modules also filter by
    // event type themselves, so this would still pass if core stopped keeping
    // them apart. Core's filtering is proved directly in
    // packages/core/src/module-projection.test.ts, by a module that counts
    // everything it is shown.
    //
    // What this does show is that the two modules reach different totals from
    // the same session, which is what a reader of the log would expect.
    expect(campaign.moduleStateOf(coinTally).flips).toBe(8);
    expect(campaign.moduleStateOf(momentum).changes).toBe(9);
  });
});
