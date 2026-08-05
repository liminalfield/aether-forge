import { describe, expect, it } from 'vitest';

import { openCampaign } from './campaign.js';
import { createMemoryEventLog } from './memory-log.js';
import { readRoll, ROLL_PERFORMED, rollEventTypes, type RollPerformedV1 } from './roll.js';
import { createEventSchemas } from './schema.js';
import { describeSchemaTranslations } from './testing/schema-contract.js';
import { createTranslatingLog, type TranslatingLog } from './translating-log.js';

function aLog(): TranslatingLog {
  let tick = 0;
  const schemas = createEventSchemas();
  for (const definition of rollEventTypes) schemas.declare(definition);

  return createTranslatingLog(
    createMemoryEventLog({
      campaignId: 'campaign-under-test',
      now: () => `2026-08-05T09:00:0${(tick += 1)}.000Z`,
      nextEventId: () => `event-${tick}`,
    }),
    schemas,
  );
}

function openWith(log: TranslatingLog) {
  const opened = openCampaign(log, { projections: [] });
  if (!opened.ok) throw new Error(`could not open: ${opened.failure.kind}`);
  return opened.value;
}

/** Two six-sided dice: the app rolled one, the player typed in the other. */
const A_MIXED_ROLL: RollPerformedV1 = {
  request: { dice: [{ sides: 6, count: 2 }] },
  dice: [
    { sides: 6, value: 4, source: { kind: 'digital' } },
    { sides: 6, value: 2, source: { kind: 'manual' } },
  ],
};

describe('a roll survives being written and read back', () => {
  it('comes back exactly as it went in', () => {
    const campaign = openWith(aLog());

    const written = campaign.append({ type: ROLL_PERFORMED, payload: A_MIXED_ROLL });
    if (!written.ok) throw new Error('could not write the roll');

    const read = campaign.count();
    expect(read.ok).toBe(true);

    expect(readRoll(written.value.payload)).toEqual(A_MIXED_ROLL);
  });

  it('keeps a service roll reference through the round trip', () => {
    // The case the old two-word shape could not have held, and the reason the
    // shape was settled before any roll event was ever written.
    const throughAService: RollPerformedV1 = {
      request: { dice: [{ sides: 10, count: 2, label: 'challenge' }] },
      dice: [
        {
          sides: 10,
          value: 7,
          source: { kind: 'service', service: 'dddice', ref: 'room/4kD9/roll/8812' },
        },
        {
          sides: 10,
          value: 3,
          source: { kind: 'service', service: 'dddice', ref: 'room/4kD9/roll/8812' },
        },
      ],
    };

    const campaign = openWith(aLog());
    const written = campaign.append({ type: ROLL_PERFORMED, payload: throughAService });
    if (!written.ok) throw new Error('could not write the roll');

    expect(readRoll(written.value.payload)).toEqual(throughAService);
  });

  it('keeps a module label on the dice that were asked for', () => {
    const campaign = openWith(aLog());
    const labelled: RollPerformedV1 = {
      request: {
        dice: [
          { sides: 6, count: 1, label: 'first' },
          { sides: 10, count: 2, label: 'second' },
        ],
      },
      dice: [
        { sides: 6, value: 5, source: { kind: 'digital' } },
        { sides: 10, value: 9, source: { kind: 'digital' } },
        { sides: 10, value: 1, source: { kind: 'digital' } },
      ],
    };

    const written = campaign.append({ type: ROLL_PERFORMED, payload: labelled });
    if (!written.ok) throw new Error('could not write the roll');

    expect(readRoll(written.value.payload)?.request.dice).toEqual(labelled.request.dice);
  });
});

describe('reading a payload that is not a roll', () => {
  it.each([
    ['not an object', 42],
    ['null', null],
    ['no request', { dice: [] }],
    ['no dice', { request: { dice: [] } }],
    ['request dice is not a list', { request: { dice: 2 }, dice: [] }],
    ['a die with no source', { request: { dice: [] }, dice: [{ sides: 6, value: 4 }] }],
    [
      'a source that names no kind',
      { request: { dice: [] }, dice: [{ sides: 6, value: 4, source: {} }] },
    ],
    [
      'a service source with no reference',
      {
        request: { dice: [] },
        dice: [{ sides: 6, value: 4, source: { kind: 'service', service: 'dddice' } }],
      },
    ],
    [
      'a label that is not text',
      { request: { dice: [{ sides: 6, count: 1, label: 7 }] }, dice: [] },
    ],
  ])('says no to %s', (_name, payload) => {
    expect(readRoll(payload)).toBeUndefined();
  });

  it('says no rather than dropping the dice it could not read', () => {
    // A partial read would be worse than no read: it would look like a roll of
    // one die, and nothing downstream would know a die had gone missing.
    const oneBadDie = {
      request: { dice: [{ sides: 6, count: 2 }] },
      dice: [
        { sides: 6, value: 4, source: { kind: 'digital' } },
        { sides: 6, value: 2, source: { kind: 'invented' } },
      ],
    };

    expect(readRoll(oneBadDie)).toBeUndefined();
  });
});

describe('what the shape check does not do', () => {
  it('reads a die showing more than it has sides', () => {
    // Range is a separate question with a separate answer, and this test exists
    // so that whoever adds range checking sees that this was deliberate.
    const impossible = {
      request: { dice: [{ sides: 10, count: 1 }] },
      dice: [{ sides: 10, value: 12, source: { kind: 'manual' } }],
    };

    expect(readRoll(impossible)).toEqual(impossible);
  });
});

describeSchemaTranslations(
  'core roll events',
  () => {
    const schemas = createEventSchemas();
    for (const definition of rollEventTypes) schemas.declare(definition);
    return schemas;
  },
  [{ type: ROLL_PERFORMED, payloadsByVersion: { 1: A_MIXED_ROLL } }],
);
