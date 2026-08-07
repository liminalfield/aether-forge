import { describe, expect, it } from 'vitest';

import {
  entities,
  ENTITY_CHANGED,
  ENTITY_CREATED,
  entityEventTypes,
  nameOf,
  readEntityChanged,
  readEntityCreated,
  type Entities,
  type EntityRecord,
} from './entity.js';
import type { EventEnvelope } from './event.js';
import { replay } from './projection.js';
import { createEventSchemas } from './schema.js';
import { describeProjectionIsPredictable } from './testing/projection-contract.js';
import { describeSchemaTranslations } from './testing/schema-contract.js';

/** An envelope with only what these tests care about varied. */
function anEvent(
  overrides: Partial<EventEnvelope> & Pick<EventEnvelope, 'id' | 'seq' | 'type' | 'payload'>,
): EventEnvelope {
  return {
    at: `2026-08-07T21:00:0${String(overrides.seq)}.000Z`,
    schemaVersion: 1,
    ...overrides,
  };
}

function onlyEntity(state: Entities): EntityRecord {
  const [first] = state.entities;
  if (first === undefined) throw new Error('the state held no entity');
  return first;
}

const CREATED_VESS = anEvent({
  id: 'event-1',
  seq: 1,
  type: ENTITY_CREATED,
  payload: {
    entityId: 'vess',
    entityType: 'sys.test-system.character',
    fields: { name: 'Vess', iron: 1 },
  },
});

const A_CREATION = {
  entityId: '01TESTENTITY0000000000000A',
  entityType: 'sys.test-system.example',
  fields: { name: 'Vess', iron: 1, marked: false },
};

const A_CHANGE = {
  entityId: '01TESTENTITY0000000000000A',
  fields: { iron: 2 },
};

describe('reading an entity creation', () => {
  it('reads a full creation back', () => {
    expect(readEntityCreated(A_CREATION)).toEqual(A_CREATION);
  });

  it('reads a creation with nothing but an id, which is an entity that matters before it is described', () => {
    expect(readEntityCreated({ entityId: 'e-1', fields: {} })).toEqual({
      entityId: 'e-1',
      fields: {},
    });
  });

  it('reads a creation with no type as free-form, not as broken', () => {
    const sparse = readEntityCreated({ entityId: 'e-1', fields: { name: 'the debt' } });
    expect(sparse?.entityType).toBeUndefined();
    expect(sparse?.fields).toEqual({ name: 'the debt' });
  });

  it.each([
    ['no payload at all', undefined],
    ['a missing id', { fields: {} }],
    ['an empty id', { entityId: '', fields: {} }],
    [
      'an empty type, which is neither a type nor its absence',
      { entityId: 'e', entityType: '', fields: {} },
    ],
    ['missing fields', { entityId: 'e' }],
    ['a field holding structure', { entityId: 'e', fields: { name: { first: 'V' } } }],
    ['a field holding a list', { entityId: 'e', fields: { tags: ['a'] } }],
    ['a field holding nothing', { entityId: 'e', fields: { name: null } }],
    ['a field holding an unfinishable number', { entityId: 'e', fields: { iron: Infinity } }],
  ])('says no to %s', (_name, payload) => {
    expect(readEntityCreated(payload)).toBeUndefined();
  });
});

describe('reading an entity change', () => {
  it('reads a change back, carrying only the fields it sets', () => {
    expect(readEntityChanged(A_CHANGE)).toEqual(A_CHANGE);
  });

  it('reads a change setting nothing, which records that nothing was decided rather than guessing', () => {
    expect(readEntityChanged({ entityId: 'e-1', fields: {} })).toEqual({
      entityId: 'e-1',
      fields: {},
    });
  });

  it.each([
    ['a missing id', { fields: { iron: 2 } }],
    ['a field holding structure', { entityId: 'e', fields: { iron: { value: 2 } } }],
  ])('says no to %s', (_name, payload) => {
    expect(readEntityChanged(payload)).toBeUndefined();
  });
});

describe('what the events refuse, and what they never refuse', () => {
  it('has no opinion about field names or values a module might disagree with', () => {
    // Sovereignty check. A stat of -3, an iron of 900, a field no template
    // mentions: all recordable. The only refusal is shape.
    expect(
      readEntityCreated({
        entityId: 'e-1',
        fields: { iron: 900, notInAnyTemplate: 'yes', momentum: -3 },
      }),
    ).toBeDefined();
  });
});

describe('the entities as of now', () => {
  it('holds a created entity with its fields', () => {
    const state = replay(entities, [CREATED_VESS]);

    expect(state.entities).toHaveLength(1);
    expect(state.entities[0]?.fields).toEqual({ name: 'Vess', iron: 1 });
    expect(state.entities[0]?.entityType).toBe('sys.test-system.character');
    expect(state.entities[0]?.createdBy).toBe('event-1');
  });

  it('merges a change over what was known, touching only the fields it names', () => {
    const state = replay(entities, [
      CREATED_VESS,
      anEvent({
        id: 'event-2',
        seq: 2,
        type: ENTITY_CHANGED,
        payload: { entityId: 'vess', fields: { iron: 2 } },
      }),
    ]);

    expect(state.entities[0]?.fields).toEqual({ name: 'Vess', iron: 2 });
    expect(state.entities[0]?.touchedBy).toBe('event-2');
  });

  it('lets an entity created from one keystroke be described later', () => {
    // Create-as-you-write. The debt matters before anyone knows its name.
    const state = replay(entities, [
      anEvent({
        id: 'event-1',
        seq: 1,
        type: ENTITY_CREATED,
        payload: { entityId: 'debt', fields: {} },
      }),
      anEvent({
        id: 'event-2',
        seq: 2,
        type: ENTITY_CHANGED,
        payload: { entityId: 'debt', fields: { name: 'The indenture' } },
      }),
    ]);

    expect(state.entities[0]?.entityType).toBeUndefined();
    expect(nameOf(onlyEntity(state))).toBe('The indenture');
  });

  it('refuses to guess about a change to an entity it has never seen', () => {
    const state = replay(entities, [
      anEvent({
        id: 'event-1',
        seq: 1,
        type: ENTITY_CHANGED,
        payload: { entityId: 'nobody', fields: { iron: 2 } },
      }),
    ]);

    expect(state.entities).toEqual([]);
  });

  it('refuses to guess about a second creation of the same entity', () => {
    const state = replay(entities, [
      CREATED_VESS,
      anEvent({
        id: 'event-2',
        seq: 2,
        type: ENTITY_CREATED,
        payload: { entityId: 'vess', fields: { name: 'Someone else' } },
      }),
    ]);

    expect(state.entities).toHaveLength(1);
    expect(state.entities[0]?.fields['name']).toBe('Vess');
  });

  it("applies a revised change at the revision's own position", () => {
    // The change said iron 2 and was written wrongly; the revision says 3.
    const state = replay(entities, [
      CREATED_VESS,
      anEvent({
        id: 'event-2',
        seq: 2,
        type: ENTITY_CHANGED,
        payload: { entityId: 'vess', fields: { iron: 2 } },
      }),
      anEvent({
        id: 'event-3',
        seq: 3,
        type: ENTITY_CHANGED,
        revises: 'event-2',
        payload: { entityId: 'vess', fields: { iron: 3 } },
      }),
    ]);

    expect(state.entities[0]?.fields['iron']).toBe(3);
  });

  it('lets a revised creation retype the entity', () => {
    const state = replay(entities, [
      anEvent({
        id: 'event-1',
        seq: 1,
        type: ENTITY_CREATED,
        payload: { entityId: 'ship', fields: { name: 'Starfall' } },
      }),
      anEvent({
        id: 'event-2',
        seq: 2,
        type: ENTITY_CREATED,
        revises: 'event-1',
        payload: {
          entityId: 'ship',
          entityType: 'sys.test-system.craft',
          fields: { name: 'Starfall' },
        },
      }),
    ]);

    expect(state.entities[0]?.entityType).toBe('sys.test-system.craft');
  });

  it('ignores a revision whose payload names a different entity than the event it revises', () => {
    const state = replay(entities, [
      CREATED_VESS,
      anEvent({
        id: 'event-2',
        seq: 2,
        type: ENTITY_CHANGED,
        revises: 'event-1',
        payload: { entityId: 'somebody-else', fields: { iron: 9 } },
      }),
    ]);

    expect(state.entities[0]?.fields['iron']).toBe(1);
  });
});

describe('what an entity is called', () => {
  it('is its name field when that is a non-empty string', () => {
    const state = replay(entities, [CREATED_VESS]);
    expect(nameOf(onlyEntity(state))).toBe('Vess');
  });

  it('is nothing when the name is empty or absent, rather than a pretend name', () => {
    const state = replay(entities, [
      anEvent({
        id: 'event-1',
        seq: 1,
        type: ENTITY_CREATED,
        payload: { entityId: 'e', fields: { name: '' } },
      }),
    ]);
    expect(nameOf(onlyEntity(state))).toBeUndefined();
  });
});

describe('the tracks an entity carries', () => {
  const started = anEvent({
    id: 'event-2',
    seq: 2,
    type: 'core.track.started',
    payload: { entityId: 'vess', trackId: 'health', segments: 5, filled: 5 },
  });

  it('starts a track with its shape and its fill', () => {
    const state = replay(entities, [CREATED_VESS, started]);

    expect(onlyEntity(state).tracks).toEqual([
      { id: 'health', segments: 5, filled: 5, startedBy: 'event-2' },
    ]);
    expect(onlyEntity(state).touchedBy).toBe('event-2');
  });

  it('moves by what each advance says, in order', () => {
    const state = replay(entities, [
      CREATED_VESS,
      started,
      anEvent({
        id: 'event-3',
        seq: 3,
        type: 'core.track.advanced',
        payload: { entityId: 'vess', trackId: 'health', by: -2 },
      }),
      anEvent({
        id: 'event-4',
        seq: 4,
        type: 'core.track.advanced',
        payload: { entityId: 'vess', trackId: 'health', by: 1 },
      }),
    ]);

    expect(onlyEntity(state).tracks[0]?.filled).toBe(4);
  });

  it('reports a fill past full and below empty without comment', () => {
    // Sovereignty. Whether twelve of ten means something is the module's
    // business at presentation time.
    const state = replay(entities, [
      CREATED_VESS,
      started,
      anEvent({
        id: 'event-3',
        seq: 3,
        type: 'core.track.advanced',
        payload: { entityId: 'vess', trackId: 'health', by: 9 },
      }),
    ]);

    expect(onlyEntity(state).tracks[0]?.filled).toBe(14);
  });

  it('sets a fill outright when told where the track now stands', () => {
    const state = replay(entities, [
      CREATED_VESS,
      started,
      anEvent({
        id: 'event-3',
        seq: 3,
        type: 'core.track.set',
        payload: { entityId: 'vess', trackId: 'health', filled: 1 },
      }),
    ]);

    expect(onlyEntity(state).tracks[0]?.filled).toBe(1);
  });

  it('refuses to move a track nobody started', () => {
    const state = replay(entities, [
      CREATED_VESS,
      anEvent({
        id: 'event-2',
        seq: 2,
        type: 'core.track.advanced',
        payload: { entityId: 'vess', trackId: 'health', by: 2 },
      }),
    ]);

    expect(onlyEntity(state).tracks).toEqual([]);
  });

  it('refuses a second start of a track the entity already carries', () => {
    const state = replay(entities, [
      CREATED_VESS,
      started,
      anEvent({
        id: 'event-3',
        seq: 3,
        type: 'core.track.started',
        payload: { entityId: 'vess', trackId: 'health', segments: 10, filled: 0 },
      }),
    ]);

    expect(onlyEntity(state).tracks[0]?.segments).toBe(5);
  });

  it('corrects an advance by the difference, keeping every advance made since', () => {
    // The +2 was written wrongly and meant +3. The later -1 stands. The fill
    // lands where it would have, had the log been written right.
    const state = replay(entities, [
      CREATED_VESS,
      started,
      anEvent({
        id: 'event-3',
        seq: 3,
        type: 'core.track.advanced',
        payload: { entityId: 'vess', trackId: 'health', by: 2 },
      }),
      anEvent({
        id: 'event-4',
        seq: 4,
        type: 'core.track.advanced',
        payload: { entityId: 'vess', trackId: 'health', by: -1 },
      }),
      anEvent({
        id: 'event-5',
        seq: 5,
        type: 'core.track.advanced',
        revises: 'event-3',
        payload: { entityId: 'vess', trackId: 'health', by: 3 },
      }),
    ]);

    expect(onlyEntity(state).tracks[0]?.filled).toBe(7);
  });

  it('corrects a start by replacing the shape whole and moving the fill by the difference', () => {
    const state = replay(entities, [
      CREATED_VESS,
      started,
      anEvent({
        id: 'event-3',
        seq: 3,
        type: 'core.track.advanced',
        payload: { entityId: 'vess', trackId: 'health', by: -2 },
      }),
      anEvent({
        id: 'event-4',
        seq: 4,
        type: 'core.track.started',
        revises: 'event-2',
        payload: { entityId: 'vess', trackId: 'health', segments: 4, filled: 4 },
      }),
    ]);

    expect(onlyEntity(state).tracks[0]?.segments).toBe(4);
    expect(onlyEntity(state).tracks[0]?.filled).toBe(2);
  });

  it('corrects a set by stating the fill outright', () => {
    const state = replay(entities, [
      CREATED_VESS,
      started,
      anEvent({
        id: 'event-3',
        seq: 3,
        type: 'core.track.set',
        payload: { entityId: 'vess', trackId: 'health', filled: 2 },
      }),
      anEvent({
        id: 'event-4',
        seq: 4,
        type: 'core.track.set',
        revises: 'event-3',
        payload: { entityId: 'vess', trackId: 'health', filled: 3 },
      }),
    ]);

    expect(onlyEntity(state).tracks[0]?.filled).toBe(3);
  });

  it('refuses a revision that changes what kind of event it revises', () => {
    const state = replay(entities, [
      CREATED_VESS,
      started,
      anEvent({
        id: 'event-3',
        seq: 3,
        type: 'core.track.set',
        revises: 'event-2',
        payload: { entityId: 'vess', trackId: 'health', filled: 0 },
      }),
    ]);

    expect(onlyEntity(state).tracks[0]?.filled).toBe(5);
  });

  it('refuses to revise the same event twice', () => {
    // The correction of a correction revises the correction, as everywhere
    // else. Revising the retired original again is not something to guess at.
    const state = replay(entities, [
      CREATED_VESS,
      started,
      anEvent({
        id: 'event-3',
        seq: 3,
        type: 'core.track.advanced',
        payload: { entityId: 'vess', trackId: 'health', by: 2 },
      }),
      anEvent({
        id: 'event-4',
        seq: 4,
        type: 'core.track.advanced',
        revises: 'event-3',
        payload: { entityId: 'vess', trackId: 'health', by: 3 },
      }),
      anEvent({
        id: 'event-5',
        seq: 5,
        type: 'core.track.advanced',
        revises: 'event-3',
        payload: { entityId: 'vess', trackId: 'health', by: 9 },
      }),
    ]);

    expect(onlyEntity(state).tracks[0]?.filled).toBe(8);
  });
});

describeProjectionIsPredictable(
  'the entities as of now',
  () => entities,
  () => [
    CREATED_VESS,
    anEvent({
      id: 'event-2',
      seq: 2,
      type: ENTITY_CHANGED,
      payload: { entityId: 'vess', fields: { iron: 2 } },
    }),
    anEvent({
      id: 'event-3',
      seq: 3,
      type: ENTITY_CHANGED,
      revises: 'event-2',
      payload: { entityId: 'vess', fields: { iron: 3 } },
    }),
    anEvent({
      id: 'event-4',
      seq: 4,
      type: 'core.track.started',
      payload: { entityId: 'vess', trackId: 'health', segments: 5, filled: 5 },
    }),
    anEvent({
      id: 'event-5',
      seq: 5,
      type: 'core.track.advanced',
      payload: { entityId: 'vess', trackId: 'health', by: -2 },
    }),
    anEvent({
      id: 'event-6',
      seq: 6,
      type: 'core.track.advanced',
      revises: 'event-5',
      payload: { entityId: 'vess', trackId: 'health', by: -1 },
    }),
  ],
);

describeSchemaTranslations(
  'core entity events',
  () => {
    const schemas = createEventSchemas();
    for (const definition of entityEventTypes) schemas.declare(definition);
    return schemas;
  },
  [
    { type: ENTITY_CREATED, payloadsByVersion: { 1: A_CREATION } },
    { type: ENTITY_CHANGED, payloadsByVersion: { 1: A_CHANGE } },
  ],
);
