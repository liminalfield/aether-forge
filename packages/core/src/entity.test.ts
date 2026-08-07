import { describe, expect, it } from 'vitest';

import {
  ENTITY_CHANGED,
  ENTITY_CREATED,
  entityEventTypes,
  readEntityChanged,
  readEntityCreated,
} from './entity.js';
import { createEventSchemas } from './schema.js';
import { describeSchemaTranslations } from './testing/schema-contract.js';

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
