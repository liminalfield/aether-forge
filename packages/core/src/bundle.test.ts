import { describe, expect, it } from 'vitest';

import {
  compareHistories,
  exportCampaign,
  fingerprintOf,
  importCampaign,
  type CampaignBundle,
} from './bundle.js';
import { journalEventTypes, ENTRY_CREATED } from './journal.js';
import type { EventLog } from './log.js';
import { createMemoryEventLog } from './memory-log.js';
import { createEventSchemas } from './schema.js';
import { createTranslatingLog } from './translating-log.js';

/** A campaign on one machine. Each gets its own identifiers, as in life. */
function aMachine(campaignId = 'the-sundered-reach', prefix = 'a'): EventLog {
  let tick = 0;
  return createMemoryEventLog({
    campaignId,
    now: () => `2026-08-04T09:00:0${(tick += 1)}.000Z`,
    nextEventId: () => `${prefix}-event-${tick}`,
  });
}

function write(log: EventLog, texts: readonly string[]): void {
  const schemas = createEventSchemas();
  for (const definition of journalEventTypes) schemas.declare(definition);
  const writing = createTranslatingLog(log, schemas);
  for (const text of texts) writing.append({ type: ENTRY_CREATED, payload: { text } });
}

const bundleFrom = (log: EventLog): CampaignBundle => {
  const exported = exportCampaign(log, '2026-08-04T12:00:00.000Z');
  if (!exported.ok) throw new Error('could not export');
  return exported.value;
};

describe('exporting', () => {
  it('carries every event, exactly as stored', () => {
    const home = aMachine();
    write(home, ['first', 'second']);

    const bundle = bundleFrom(home);

    expect(bundle.events).toHaveLength(2);
    expect(bundle.events[0]?.payload).toEqual({ text: 'first' });
    expect(bundle.campaignId).toBe('the-sundered-reach');
  });

  it('gives the same fingerprint for the same history, every time', () => {
    const home = aMachine();
    write(home, ['first', 'second']);

    expect(bundleFrom(home).fingerprint).toBe(bundleFrom(home).fingerprint);
  });

  it('gives a different fingerprint once something else happens', () => {
    const home = aMachine();
    write(home, ['first']);
    const before = bundleFrom(home).fingerprint;

    write(home, ['second']);

    expect(bundleFrom(home).fingerprint).not.toBe(before);
  });

  it('gives different fingerprints to campaigns that only share a name', () => {
    const one = aMachine('the-sundered-reach', 'a');
    const other = aMachine('the-sundered-reach', 'b');
    write(one, ['first']);
    write(other, ['first']);

    expect(fingerprintOf(bundleFrom(one).events)).not.toBe(fingerprintOf(bundleFrom(other).events));
  });
});

describe('bringing a campaign home', () => {
  /** Play at home, carry it away, play there. */
  function playedElsewhere(): { home: EventLog; brought: CampaignBundle } {
    const home = aMachine();
    write(home, ['first', 'second']);

    // Its own identifiers, because it is a different machine.
    const away = aMachine('the-sundered-reach', 'b');
    importCampaign(away, bundleFrom(home));
    write(away, ['third on the train', 'fourth on the train']);

    return { home, brought: bundleFrom(away) };
  }

  it('takes the events it is missing, and asks nothing', () => {
    const { home, brought } = playedElsewhere();

    const imported = importCampaign(home, brought);

    expect(imported.ok && imported.value.restored).toBe(2);
  });

  it('leaves the campaign saying what it would have said all along', () => {
    const { home, brought } = playedElsewhere();
    importCampaign(home, brought);

    const asIfNeverCarried = aMachine('the-sundered-reach', 'c');
    write(asIfNeverCarried, ['first', 'second', 'third on the train', 'fourth on the train']);

    // Not byte for byte. Events written on the other machine keep the identity
    // and the moment they were first recorded, which is the point: the journey
    // is not supposed to rewrite them. What has to match is what the campaign
    // says, and the order it says it in.
    const textsOf = (log: EventLog): readonly unknown[] => {
      const events = log.read();
      if (!events.ok) throw new Error('could not read');
      return events.value.map((event) => event.payload);
    };

    expect(textsOf(home)).toEqual(textsOf(asIfNeverCarried));
  });

  it('keeps the identity and the time each event was first recorded', () => {
    const { home, brought } = playedElsewhere();
    importCampaign(home, brought);

    const events = home.read();
    expect(events.ok && events.value[2]?.id).toBe(brought.events[2]?.id);
    expect(events.ok && events.value[2]?.at).toBe(brought.events[2]?.at);
  });

  it('does nothing when there is nothing new', () => {
    const home = aMachine();
    write(home, ['first']);

    expect(importCampaign(home, bundleFrom(home))).toEqual({ ok: true, value: { restored: 0 } });
  });

  it('does nothing when the bundle is the older copy', () => {
    const home = aMachine();
    write(home, ['first']);
    const stale = bundleFrom(home);
    write(home, ['second']);

    expect(importCampaign(home, stale)).toEqual({ ok: true, value: { restored: 0 } });
  });
});

describe('when both copies were played', () => {
  function bothMovedOn(): { home: EventLog; brought: CampaignBundle } {
    const home = aMachine();
    write(home, ['first', 'second']);

    const away = aMachine('the-sundered-reach', 'b');
    importCampaign(away, bundleFrom(home));
    write(away, ['played on the train']);

    // And then played at home as well, before it came back.
    write(home, ['played at home']);

    return { home, brought: bundleFrom(away) };
  }

  it('refuses, and says where they parted', () => {
    const { home, brought } = bothMovedOn();

    const imported = importCampaign(home, brought);

    expect(!imported.ok && imported.failure).toEqual({ kind: 'diverged', agreedUntil: 2 });
  });

  it('leaves this copy exactly as it was, losing nothing', () => {
    const { home, brought } = bothMovedOn();
    const before = home.read();
    importCampaign(home, brought);
    const after = home.read();

    expect(after.ok && after.value).toEqual(before.ok && before.value);
  });

  it('leaves the bundle intact, so it can be kept as its own campaign', () => {
    const { home, brought } = bothMovedOn();
    importCampaign(home, brought);

    expect(brought.events).toHaveLength(3);
  });
});

describe('a bundle that does not belong here', () => {
  it('refuses a campaign that only shares a name', () => {
    const home = aMachine('the-sundered-reach', 'a');
    write(home, ['first']);
    const stranger = aMachine('the-sundered-reach', 'b');
    write(stranger, ['a completely different first']);

    const imported = importCampaign(home, bundleFrom(stranger));

    expect(!imported.ok && imported.failure.kind).toBe('a-different-campaign');
  });

  it('refuses a bundle from a different campaign entirely', () => {
    const home = aMachine('the-sundered-reach', 'a');
    const other = aMachine('somewhere-else', 'b');
    write(other, ['first']);

    const imported = importCampaign(home, bundleFrom(other));

    expect(!imported.ok && imported.failure.kind).toBe('a-different-campaign');
  });

  it('refuses a bundle written in a format this build does not know', () => {
    const home = aMachine();
    const fromTheFuture = { ...bundleFrom(home), format: 99 };

    const imported = importCampaign(home, fromTheFuture);

    expect(!imported.ok && imported.failure.kind).toBe('unknown-bundle-format');
  });
});

describe('comparing two histories directly', () => {
  it('sees an empty campaign as simply behind', () => {
    const away = aMachine();
    write(away, ['first']);

    expect(compareHistories([], bundleFrom(away)).kind).toBe('behind');
  });
});
