import {
  createMemoryEventLog,
  createTranslatingLog,
  entities as entitiesProjection,
  journal,
  openCampaign,
  suggestions,
  type EventLog,
  type OpenCampaign,
  type Projection,
} from '@aether-forge/core';
import { CHARACTER_TEMPLATE, STARFORGED_SYSTEM_ID } from '@aether-forge/system-ironsworn';
import { describe, expect, it } from 'vitest';

import { changeEntity, createEntity, readEntities } from './entities';
import { declareEventTypes } from './event-types';

function aStoredLog(): EventLog {
  let tick = 0;
  return createMemoryEventLog({
    campaignId: 'campaign-under-test',
    now: () => `2026-08-08T09:00:00.${String(1000 + (tick += 1)).slice(1)}Z`,
    nextEventId: () => `event-${String(tick)}`,
  });
}

function openOver(stored: EventLog = aStoredLog()): OpenCampaign {
  const log = createTranslatingLog(stored, declareEventTypes());
  const opened = openCampaign(log, {
    projections: [
      journal as Projection<unknown>,
      suggestions as Projection<unknown>,
      entitiesProjection as Projection<unknown>,
    ],
  });
  if (!opened.ok) throw new Error('could not open the campaign');
  return opened.value;
}

/** Entity ids a test can predict. */
function countingIds(): () => string {
  let n = 0;
  return () => `entity-${String((n += 1))}`;
}

describe('creating an entity', () => {
  it('records a free-form entity exactly as asked, which is first-class', () => {
    const campaign = openOver();

    const made = createEntity(campaign, countingIds(), { fields: { name: 'The indenture' } });

    expect(made.ok && made.value.name).toBe('The indenture');
    expect(made.ok && made.value.entityType).toBeUndefined();
    expect(made.ok && made.value.tracks).toEqual([]);
  });

  it('records an entity with no fields at all, because it matters before it is described', () => {
    const made = createEntity(openOver(), countingIds(), {});

    expect(made.ok).toBe(true);
    expect(made.ok && made.value.name).toBeUndefined();
  });

  it('starts a character from its template: stats at one, meters full, tracks caused by the creation', () => {
    const campaign = openOver();

    const made = createEntity(campaign, countingIds(), {
      entityType: CHARACTER_TEMPLATE.typeId,
      fields: { name: 'Vess' },
    });

    if (!made.ok) throw new Error(made.failure.detail);
    expect(made.value.typeName).toBe('Character');
    expect(made.value.fields['edge']).toBe(1);
    expect(made.value.fields['wits']).toBe(1);
    expect(made.value.tracks.map((track) => [track.id, track.filled, track.segments])).toEqual([
      ['health', 5, 5],
      ['spirit', 5, 5],
      ['supply', 5, 5],
    ]);
    expect(made.value.tracks[0]?.label).toBe('Health');
  });

  it('lets the request disagree with its template, and records the disagreement', () => {
    const made = createEntity(openOver(), countingIds(), {
      entityType: CHARACTER_TEMPLATE.typeId,
      fields: { name: 'Vess', iron: 4 },
    });

    // The template says iron starts at 1. The player said 4. The player is
    // sovereign and 4 is what the log holds.
    expect(made.ok && made.value.fields['iron']).toBe(4);
  });

  it('creates a typed entity no loaded module describes, exactly as asked', () => {
    const made = createEntity(openOver(), countingIds(), {
      entityType: 'sys.someone-elses-system.thing',
      fields: { name: 'A relic' },
    });

    expect(made.ok && made.value.typeName).toBeUndefined();
    expect(made.ok && made.value.entityType).toBe('sys.someone-elses-system.thing');
  });

  it('refuses a field holding structure, which is shape and the only refusal', () => {
    const made = createEntity(openOver(), countingIds(), {
      fields: { name: { first: 'V' } },
    });

    expect(!made.ok && made.failure.kind).toBe('invalid-request');
  });
});

describe('changing an entity', () => {
  it('sets the named fields and answers with the entity as it now stands', () => {
    const campaign = openOver();
    const made = createEntity(campaign, countingIds(), { fields: { name: 'Vess', iron: 1 } });
    if (!made.ok) throw new Error(made.failure.detail);

    const changed = changeEntity(campaign, { entityId: made.value.id, fields: { iron: 2 } });

    expect(changed.ok && changed.value.fields).toEqual({ name: 'Vess', iron: 2 });
  });

  it('refuses to change an entity this campaign has never seen, before anything is written', () => {
    const changed = changeEntity(openOver(), { entityId: 'nobody', fields: { iron: 2 } });

    expect(!changed.ok && changed.failure.kind).toBe('unknown-entity');
  });

  it('refuses junk without writing it into a permanent log', () => {
    const campaign = openOver();
    const changed = changeEntity(campaign, { entityId: 'e', fields: { name: ['a', 'list'] } });

    expect(!changed.ok && changed.failure.kind).toBe('invalid-request');
  });
});

describe('reading the entities', () => {
  it('answers in the order they came to exist, named and unnamed alike', () => {
    const campaign = openOver();
    const ids = countingIds();
    createEntity(campaign, ids, { fields: { name: 'Vess' } });
    createEntity(campaign, ids, { fields: {} });

    const read = readEntities(campaign);

    if (!read.ok) throw new Error(read.failure.detail);
    expect(read.value.entities.map((entity) => entity.name)).toEqual(['Vess', undefined]);
  });

  it('reads them back identically after the campaign is closed and opened again', () => {
    const stored = aStoredLog();
    const campaign = openOver(stored);
    createEntity(campaign, countingIds(), {
      entityType: `sys.${STARFORGED_SYSTEM_ID}.character`,
      fields: { name: 'Vess' },
    });
    const before = readEntities(campaign);

    const reopened = readEntities(openOver(stored));

    expect(reopened).toEqual(before);
  });
});
