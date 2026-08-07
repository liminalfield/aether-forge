import { describe, expect, it } from 'vitest';

import { createEventSchemas } from './schema.js';
import { describeSchemaTranslations } from './testing/schema-contract.js';
import {
  readTrackAdvanced,
  readTrackSet,
  readTrackStarted,
  TRACK_ADVANCED,
  TRACK_SET,
  TRACK_STARTED,
  trackEventTypes,
} from './track.js';

const A_START = { entityId: 'vess', trackId: 'health', segments: 5, filled: 5 };
const AN_ADVANCE = { entityId: 'vess', trackId: 'health', by: -2 };
const A_SET = { entityId: 'vess', trackId: 'health', filled: 3 };

describe('reading a started track', () => {
  it('reads the shape back', () => {
    expect(readTrackStarted(A_START)).toEqual(A_START);
  });

  it.each([
    ['no payload', undefined],
    ['a missing entity', { trackId: 't', segments: 5, filled: 0 }],
    ['an empty track name', { entityId: 'e', trackId: '', segments: 5, filled: 0 }],
    [
      'no segments at all, which is not a track',
      { entityId: 'e', trackId: 't', segments: 0, filled: 0 },
    ],
    ['negative segments', { entityId: 'e', trackId: 't', segments: -4, filled: 0 }],
    ['a fractional shape', { entityId: 'e', trackId: 't', segments: 4.5, filled: 0 }],
    ['a fractional fill', { entityId: 'e', trackId: 't', segments: 4, filled: 0.5 }],
    ['a missing fill', { entityId: 'e', trackId: 't', segments: 4 }],
  ])('says no to %s', (_name, payload) => {
    expect(readTrackStarted(payload)).toBeUndefined();
  });
});

describe('reading an advance', () => {
  it('reads a negative amount as readily as a positive one', () => {
    expect(readTrackAdvanced(AN_ADVANCE)).toEqual(AN_ADVANCE);
    expect(readTrackAdvanced({ ...AN_ADVANCE, by: 2 })).toEqual({ ...AN_ADVANCE, by: 2 });
  });

  it('reads an advance of nothing, because zero is a number somebody may record', () => {
    expect(readTrackAdvanced({ ...AN_ADVANCE, by: 0 })).toEqual({ ...AN_ADVANCE, by: 0 });
  });

  it.each([
    ['a fractional amount', { entityId: 'e', trackId: 't', by: 1.5 }],
    ['a missing amount', { entityId: 'e', trackId: 't' }],
    ['an amount in words', { entityId: 'e', trackId: 't', by: 'two' }],
  ])('says no to %s', (_name, payload) => {
    expect(readTrackAdvanced(payload)).toBeUndefined();
  });
});

describe('reading a set', () => {
  it('reads the stated fill back', () => {
    expect(readTrackSet(A_SET)).toEqual(A_SET);
  });

  it('accepts a fill past full and below empty, which is the projection reporting, not judging', () => {
    expect(readTrackSet({ ...A_SET, filled: 99 })).toEqual({ ...A_SET, filled: 99 });
    expect(readTrackSet({ ...A_SET, filled: -3 })).toEqual({ ...A_SET, filled: -3 });
  });

  it.each([
    ['a fractional fill', { entityId: 'e', trackId: 't', filled: 2.5 }],
    ['a missing fill', { entityId: 'e', trackId: 't' }],
  ])('says no to %s', (_name, payload) => {
    expect(readTrackSet(payload)).toBeUndefined();
  });
});

describeSchemaTranslations(
  'core track events',
  () => {
    const schemas = createEventSchemas();
    for (const definition of trackEventTypes) schemas.declare(definition);
    return schemas;
  },
  [
    { type: TRACK_STARTED, payloadsByVersion: { 1: A_START } },
    { type: TRACK_ADVANCED, payloadsByVersion: { 1: AN_ADVANCE } },
    { type: TRACK_SET, payloadsByVersion: { 1: A_SET } },
  ],
);
