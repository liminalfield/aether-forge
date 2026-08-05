import { describe, expect, it } from 'vitest';

import { openCampaign } from './campaign.js';
import { createMemoryEventLog } from './memory-log.js';
import {
  readRoll,
  ROLL_PERFORMED,
  rollEventTypes,
  validateRoll,
  type RollPerformedV1,
} from './roll.js';
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

describe('a die shows one to the number of sides it has', () => {
  function aDie(sides: number, value: number): RollPerformedV1 {
    return {
      request: { dice: [{ sides, count: 1 }] },
      dice: [{ sides, value, source: { kind: 'manual' } }],
    };
  }

  it('accepts every value a d10 can show', () => {
    for (let value = 1; value <= 10; value += 1) {
      const checked = validateRoll(aDie(10, value));
      expect(checked.ok, `a d10 should be able to show ${value}`).toBe(true);
    }
  });

  it.each([2, 4, 6, 8, 10, 12, 20, 100])('refuses a d%i showing one more than it has', (sides) => {
    // The boundary, checked on its own, because an off-by-one here is the
    // mistake that a test using 12 and 1000 walks straight past.
    expect(validateRoll(aDie(sides, sides)).ok, `a d${sides} should show ${sides}`).toBe(true);

    const checked = validateRoll(aDie(sides, sides + 1));
    expect(checked.ok, `a d${sides} should not show ${sides + 1}`).toBe(false);
    if (checked.ok) return;
    expect(checked.failure.kind).toBe('die-outside-its-range');
  });

  it.each([
    ['above its range', 12],
    ['far above its range', 1000],
    ['zero', 0],
    ['negative', -1],
  ])('refuses a d10 showing %s', (_name, value) => {
    const checked = validateRoll(aDie(10, value));
    expect(checked.ok).toBe(false);
    if (checked.ok) return;
    expect(checked.failure.kind).toBe('die-outside-its-range');
  });

  it('refuses a value between two numbers', () => {
    const checked = validateRoll(aDie(10, 7.5));
    expect(checked.ok).toBe(false);
    if (checked.ok) return;
    expect(checked.failure.kind).toBe('die-value-is-not-whole');
  });

  it.each([
    ['no sides', 0],
    ['a negative number of sides', -3],
    ['a fractional number of sides', 6.5],
  ])('refuses a die with %s', (_name, sides) => {
    const checked = validateRoll(aDie(sides, 1));
    expect(checked.ok).toBe(false);
    if (checked.ok) return;
    expect(checked.failure.kind).toBe('die-has-impossible-sides');
  });

  it('says which die is wrong when several are the same size', () => {
    const roll: RollPerformedV1 = {
      request: { dice: [{ sides: 6, count: 3 }] },
      dice: [
        { sides: 6, value: 4, source: { kind: 'digital' } },
        { sides: 6, value: 2, source: { kind: 'digital' } },
        { sides: 6, value: 9, source: { kind: 'manual' } },
      ],
    };

    const checked = validateRoll(roll);
    expect(checked.ok).toBe(false);
    if (checked.ok) return;
    expect(checked.failure).toEqual({
      kind: 'die-outside-its-range',
      index: 2,
      sides: 6,
      value: 9,
    });
  });

  it('gives the roll back so it can be recorded', () => {
    const roll = aDie(6, 3);
    const checked = validateRoll(roll);
    expect(checked.ok).toBe(true);
    if (!checked.ok) return;
    expect(checked.value).toBe(roll);
  });
});

describe('what range checking must never become', () => {
  it('records three sixes on three dice without comment', () => {
    // Improbable is not illegal. The application computes and does not decide,
    // and a check that started having opinions about combinations would be the
    // first crack in that.
    const roll: RollPerformedV1 = {
      request: { dice: [{ sides: 6, count: 3 }] },
      dice: [
        { sides: 6, value: 6, source: { kind: 'manual' } },
        { sides: 6, value: 6, source: { kind: 'manual' } },
        { sides: 6, value: 6, source: { kind: 'manual' } },
      ],
    };

    expect(validateRoll(roll).ok).toBe(true);
  });

  it('accepts dice that nobody asked for', () => {
    // Whether a roll may record dice outside its request is an open question in
    // design/rolling-dice.md. Answering it here, by accident, would settle it
    // the wrong way round.
    const roll: RollPerformedV1 = {
      request: { dice: [{ sides: 6, count: 1 }] },
      dice: [
        { sides: 6, value: 4, source: { kind: 'digital' } },
        { sides: 20, value: 17, source: { kind: 'manual' } },
      ],
    };

    expect(validateRoll(roll).ok).toBe(true);
  });

  it('accepts a roll with no dice at all', () => {
    expect(validateRoll({ request: { dice: [] }, dice: [] }).ok).toBe(true);
  });
});

describe('reading and checking are different jobs', () => {
  it('still reads an out-of-range die off an old event', () => {
    // A recorded event is a fact whatever it contains. Refusing to read one
    // would lose a campaign rather than protect it.
    const impossible = {
      request: { dice: [{ sides: 10, count: 1 }] },
      dice: [{ sides: 10, value: 12, source: { kind: 'manual' } }],
    };

    const read = readRoll(impossible);
    expect(read).toEqual(impossible);
    if (read === undefined) return;
    expect(validateRoll(read).ok).toBe(false);
  });
});
