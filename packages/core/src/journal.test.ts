import { describe, expect, it } from 'vitest';

import { openCampaign } from './campaign.js';
import { ENTRY_CREATED, ENTRY_REVISED, journal, journalEventTypes } from './journal.js';
import { createMemoryEventLog } from './memory-log.js';
import type { Projection } from './projection.js';
import { createEventSchemas } from './schema.js';
import { createTranslatingLog, type TranslatingLog } from './translating-log.js';

const A_DELTA = 'sys.example.resource.moved';

function aLog(): TranslatingLog {
  let tick = 0;
  const schemas = createEventSchemas();
  for (const definition of journalEventTypes) schemas.declare(definition);
  schemas.declare({
    type: A_DELTA,
    currentVersion: 1,
    translations: [],
    corrections: 'records-a-change',
  });

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
  const opened = openCampaign(log, { projections: [journal as Projection<unknown>] });
  if (!opened.ok) throw new Error(`could not open: ${opened.failure.kind}`);
  return opened.value;
}

describe('correcting an entry', () => {
  it('shows the corrected text', () => {
    const campaign = openWith(aLog());
    const written = campaign.append({
      type: ENTRY_CREATED,
      payload: { text: 'The airlock did not open.' },
    });
    if (!written.ok) throw new Error('could not write');

    campaign.append({
      type: ENTRY_REVISED,
      revises: written.value.id,
      payload: { text: 'The airlock opened on the second try.' },
    });

    expect(campaign.stateOf(journal).entries).toEqual([
      {
        id: written.value.id,
        text: 'The airlock opened on the second try.',
        corrections: 1,
      },
    ]);
  });

  it('leaves the original event in the log, exactly as written', () => {
    const log = aLog();
    const campaign = openWith(log);
    const written = campaign.append({
      type: ENTRY_CREATED,
      payload: { text: 'The airlock did not open.' },
    });
    if (!written.ok) throw new Error('could not write');
    campaign.append({
      type: ENTRY_REVISED,
      revises: written.value.id,
      payload: { text: 'Better.' },
    });

    const events = log.read();
    if (!events.ok) throw new Error('could not read');

    expect(events.value).toHaveLength(2);
    expect(events.value[0]?.payload).toEqual({ text: 'The airlock did not open.' });
    expect(events.value[1]?.revises).toBe(written.value.id);
  });

  it('can correct a correction, and still knows which entry it is', () => {
    const campaign = openWith(aLog());
    const written = campaign.append({ type: ENTRY_CREATED, payload: { text: 'first' } });
    if (!written.ok) throw new Error('could not write');

    const once = campaign.append({
      type: ENTRY_REVISED,
      revises: written.value.id,
      payload: { text: 'second' },
    });
    if (!once.ok) throw new Error('could not correct');

    campaign.append({ type: ENTRY_REVISED, revises: once.value.id, payload: { text: 'third' } });

    expect(campaign.stateOf(journal).entries).toEqual([
      { id: written.value.id, text: 'third', corrections: 2 },
    ]);
  });

  it('gives the same answer read back from the beginning', () => {
    const log = aLog();
    const campaign = openWith(log);
    const written = campaign.append({ type: ENTRY_CREATED, payload: { text: 'first' } });
    if (!written.ok) throw new Error('could not write');
    campaign.append({
      type: ENTRY_REVISED,
      revises: written.value.id,
      payload: { text: 'second' },
    });

    // Nothing was undone on the way. Reading forwards from nothing lands in the
    // same place as correcting it while open did.
    expect(openWith(log).stateOf(journal)).toEqual(campaign.stateOf(journal));
  });

  it('ignores a correction of something this campaign has never seen', () => {
    const campaign = openWith(aLog());
    campaign.append({
      type: ENTRY_REVISED,
      revises: 'an-event-from-somewhere-else',
      payload: { text: 'nonsense' },
    });

    expect(campaign.stateOf(journal).entries).toEqual([]);
  });
});

describe('an event that records a change', () => {
  it('cannot be superseded', () => {
    const campaign = openWith(aLog());
    const happened = campaign.append({ type: A_DELTA, systemId: 'example', payload: { by: 2 } });
    if (!happened.ok) throw new Error('could not write');

    const attempted = campaign.append({
      type: A_DELTA,
      systemId: 'example',
      revises: happened.value.id,
      payload: { by: 3 },
    });

    expect(!attempted.ok && attempted.failure.kind).toBe('cannot-be-superseded');
  });

  it('is compensated instead, and the log shows both', () => {
    const log = aLog();
    const campaign = openWith(log);
    campaign.append({ type: A_DELTA, systemId: 'example', payload: { by: 2 } });
    campaign.append({ type: A_DELTA, systemId: 'example', payload: { by: -2 } });

    const events = log.read();
    if (!events.ok) throw new Error('could not read');

    // What happened, and what was done about it. Both are still there.
    expect(events.value.map((event) => event.payload)).toEqual([{ by: 2 }, { by: -2 }]);
  });
});
