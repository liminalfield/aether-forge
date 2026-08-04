import { describe, expect, it } from 'vitest';

import { openCampaign } from './campaign.js';
import type { EventEnvelope } from './event.js';
import { createMemoryEventLog } from './memory-log.js';
import { isVisibleToModule, type ModuleProjection } from './module-projection.js';
import type { Projection } from './projection.js';
import { createEventSchemas } from './schema.js';
import { createTranslatingLog, type TranslatingLog } from './translating-log.js';

const ENTRY = 'core.entry.created';
const COIN = 'sys.toy-coinflip.coin.flipped';
const OTHER = 'sys.somebody-else.thing.happened';

/** How many entries the campaign has. A core view. */
const entryCount: Projection<number> = {
  id: 'core.entry-count',
  initial: () => 0,
  apply: (state, event) => (event.type === ENTRY ? state + 1 : state),
};

/** What the toy module keeps: heads so far, and what core knew at the time. */
interface CoinTally {
  readonly heads: number;
  readonly entriesWhenLastFlipped: number;
}

const coinTally: ModuleProjection<CoinTally> = {
  id: 'sys.toy-coinflip.tally',
  systemId: 'toy-coinflip',
  initial: () => ({ heads: 0, entriesWhenLastFlipped: 0 }),
  apply: (state, event, context) =>
    event.type === COIN
      ? {
          heads: state.heads + ((event.payload as { result: string }).result === 'heads' ? 1 : 0),
          entriesWhenLastFlipped: context.stateOf(entryCount),
        }
      : state,
};

function aLog(): TranslatingLog {
  let tick = 0;
  const schemas = createEventSchemas();
  for (const type of [ENTRY, COIN, OTHER]) {
    schemas.declare({ type, currentVersion: 1, translations: [] });
  }
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
    projections: [entryCount as Projection<unknown>],
    moduleProjections: [coinTally as ModuleProjection<unknown>],
  });
  if (!opened.ok) throw new Error(`could not open: ${opened.failure.kind}`);
  return opened.value;
}

describe('which events a module is shown', () => {
  const anEvent = (type: string, systemId?: string): EventEnvelope =>
    ({
      id: 'e',
      campaignId: 'c',
      seq: 1,
      at: 'now',
      type,
      schemaVersion: 1,
      payload: {},
      ...(systemId === undefined ? {} : { systemId }),
    }) as EventEnvelope;

  it('shows a module its own events', () => {
    expect(isVisibleToModule(anEvent(COIN, 'toy-coinflip'), 'toy-coinflip')).toBe(true);
  });

  it('shows a module core events, which belong to nobody', () => {
    expect(isVisibleToModule(anEvent(ENTRY), 'toy-coinflip')).toBe(true);
  });

  it('never shows a module another module s events', () => {
    // It could not read the data anyway. Being able to try is how two modules
    // quietly become one.
    expect(isVisibleToModule(anEvent(OTHER, 'somebody-else'), 'toy-coinflip')).toBe(false);
  });
});

describe('a module working out its own state', () => {
  it('builds from what is already recorded', () => {
    const log = aLog();
    log.append({ type: COIN, systemId: 'toy-coinflip', payload: { result: 'heads' } });
    log.append({ type: COIN, systemId: 'toy-coinflip', payload: { result: 'tails' } });
    log.append({ type: COIN, systemId: 'toy-coinflip', payload: { result: 'heads' } });

    expect(openWith(log).moduleStateOf(coinTally).heads).toBe(2);
  });

  it('keeps up to date as events arrive', () => {
    const campaign = openWith(aLog());
    campaign.append({ type: COIN, systemId: 'toy-coinflip', payload: { result: 'heads' } });

    expect(campaign.moduleStateOf(coinTally).heads).toBe(1);
  });

  it('can read a core projection, and sees it up to date', () => {
    const campaign = openWith(aLog());
    campaign.append({ type: ENTRY, payload: { text: 'a' } });
    campaign.append({ type: ENTRY, payload: { text: 'b' } });
    campaign.append({ type: COIN, systemId: 'toy-coinflip', payload: { result: 'heads' } });

    expect(campaign.moduleStateOf(coinTally).entriesWhenLastFlipped).toBe(2);
  });

  it('is not disturbed by another module s events', () => {
    const campaign = openWith(aLog());
    campaign.append({ type: COIN, systemId: 'toy-coinflip', payload: { result: 'heads' } });
    campaign.append({ type: OTHER, systemId: 'somebody-else', payload: { anything: true } });

    expect(campaign.moduleStateOf(coinTally).heads).toBe(1);
  });

  it('agrees with reopening the campaign', () => {
    const log = aLog();
    const campaign = openWith(log);
    campaign.append({ type: ENTRY, payload: { text: 'a' } });
    campaign.append({ type: COIN, systemId: 'toy-coinflip', payload: { result: 'heads' } });

    expect(openWith(log).moduleStateOf(coinTally)).toEqual(campaign.moduleStateOf(coinTally));
  });

  it('refuses to answer for a module view it was not opened with', () => {
    const campaign = openWith(aLog());
    const unheld: ModuleProjection<number> = {
      id: 'sys.toy-coinflip.never-asked-for',
      systemId: 'toy-coinflip',
      initial: () => 0,
      apply: (s) => s,
    };

    expect(() => campaign.moduleStateOf(unheld)).toThrow(/was not opened with/);
  });
});
