import { describe, expect, it } from 'vitest';

import { openCampaign } from './campaign.js';
import { createMemoryEventLog } from './memory-log.js';
import type { Projection } from './projection.js';
import {
  readRoll,
  ROLL_PERFORMED,
  rollEventTypes,
  rolls,
  validateRoll,
  type RollPerformedV1,
  type RollRequest,
} from './roll.js';
import { describeProjectionIsPredictable } from './testing/projection-contract.js';
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

describe('a roll that replaces an earlier one', () => {
  const FIRST: RollPerformedV1 = {
    request: { dice: [{ sides: 10, count: 1 }] },
    dice: [{ sides: 10, value: 4, source: { kind: 'manual' } }],
  };

  function replacing(value: number, because: 'corrected' | 'rerolled'): RollPerformedV1 {
    return {
      request: { dice: [{ sides: 10, count: 1 }] },
      dice: [{ sides: 10, value, source: { kind: 'manual' } }],
      supersedes: { because },
    };
  }

  it('keeps both events, and says which was a correction', () => {
    const log = aLog();
    const campaign = openWith(log);

    const first = campaign.append({ type: ROLL_PERFORMED, payload: FIRST });
    if (!first.ok) throw new Error('could not write the first roll');

    const second = campaign.append({
      type: ROLL_PERFORMED,
      revises: first.value.id,
      payload: replacing(7, 'corrected'),
    });
    if (!second.ok) throw new Error('could not correct the roll');

    const events = log.read();
    if (!events.ok) throw new Error('could not read the log');

    // The whole point: nothing was edited, and the log says why the second one
    // is there rather than leaving a reader to guess.
    expect(events.value.map((event) => readRoll(event.payload)?.dice[0]?.value)).toEqual([4, 7]);
    expect(events.value[1]?.revises).toBe(first.value.id);
    expect(readRoll(events.value[1]?.payload)?.supersedes).toEqual({ because: 'corrected' });
  });

  it('tells a reroll apart from a correction in the raw events', () => {
    const log = aLog();
    const campaign = openWith(log);

    const first = campaign.append({ type: ROLL_PERFORMED, payload: FIRST });
    if (!first.ok) throw new Error('could not write the first roll');

    const again = campaign.append({
      type: ROLL_PERFORMED,
      revises: first.value.id,
      payload: replacing(9, 'rerolled'),
    });
    if (!again.ok) throw new Error('could not reroll');

    const events = log.read();
    if (!events.ok) throw new Error('could not read the log');

    expect(readRoll(events.value[1]?.payload)?.supersedes).toEqual({ because: 'rerolled' });
  });

  it('reads as a chain when a replacement is itself replaced', () => {
    const log = aLog();
    const campaign = openWith(log);

    const first = campaign.append({ type: ROLL_PERFORMED, payload: FIRST });
    if (!first.ok) throw new Error('could not write the first roll');

    const second = campaign.append({
      type: ROLL_PERFORMED,
      revises: first.value.id,
      payload: replacing(7, 'corrected'),
    });
    if (!second.ok) throw new Error('could not correct the roll');

    const third = campaign.append({
      type: ROLL_PERFORMED,
      revises: second.value.id,
      payload: replacing(2, 'corrected'),
    });
    if (!third.ok) throw new Error('could not correct the correction');

    // A chain, not a star. Each replacement points at the version it actually
    // replaced, which is what makes the history readable in order.
    expect(second.value.revises).toBe(first.value.id);
    expect(third.value.revises).toBe(second.value.id);
    expect(third.value.revises).not.toBe(first.value.id);
  });

  it('survives being written and read back with its reason', () => {
    const campaign = openWith(aLog());
    const first = campaign.append({ type: ROLL_PERFORMED, payload: FIRST });
    if (!first.ok) throw new Error('could not write the first roll');

    const corrected = replacing(7, 'corrected');
    const second = campaign.append({
      type: ROLL_PERFORMED,
      revises: first.value.id,
      payload: corrected,
    });
    if (!second.ok) throw new Error('could not correct the roll');

    expect(readRoll(second.value.payload)).toEqual(corrected);
  });
});

describe('the two halves of a replacement have to agree', () => {
  const A_ROLL: RollPerformedV1 = {
    request: { dice: [{ sides: 6, count: 1 }] },
    dice: [{ sides: 6, value: 3, source: { kind: 'digital' } }],
  };

  it('refuses a replacement that does not say why', () => {
    const checked = validateRoll(A_ROLL, { supersedes: 'event-1' });
    expect(checked.ok).toBe(false);
    if (checked.ok) return;
    expect(checked.failure.kind).toBe('replacement-does-not-say-why');
  });

  it('refuses a reason on a roll that replaces nothing', () => {
    const checked = validateRoll({ ...A_ROLL, supersedes: { because: 'rerolled' } });
    expect(checked.ok).toBe(false);
    if (checked.ok) return;
    expect(checked.failure.kind).toBe('says-why-but-replaces-nothing');
  });

  it('accepts a first roll that replaces nothing and says nothing', () => {
    expect(validateRoll(A_ROLL).ok).toBe(true);
  });

  it('accepts a replacement that says why', () => {
    const checked = validateRoll(
      { ...A_ROLL, supersedes: { because: 'corrected' } },
      { supersedes: 'event-1' },
    );
    expect(checked.ok).toBe(true);
  });
});

describe('reading a reason that is not one', () => {
  it.each([
    ['a reason nobody declared', { because: 'improved' }],
    ['no reason inside', {}],
    ['not a record', 'corrected'],
  ])('says no to %s', (_name, supersedes) => {
    expect(
      readRoll({
        request: { dice: [] },
        dice: [],
        supersedes,
      }),
    ).toBeUndefined();
  });
});

describe('the roll that stands', () => {
  const A_D10: RollRequest = { dice: [{ sides: 10, count: 1 }] };

  function showing(value: number): RollPerformedV1 {
    return { request: A_D10, dice: [{ sides: 10, value, source: { kind: 'manual' } }] };
  }

  function nowShowing(value: number, because: 'corrected' | 'rerolled'): RollPerformedV1 {
    return { ...showing(value), supersedes: { because } };
  }

  function openWithRolls() {
    const log = aLog();
    const opened = openCampaign(log, { projections: [rolls as Projection<unknown>] });
    if (!opened.ok) throw new Error(`could not open: ${opened.failure.kind}`);
    return opened.value;
  }

  it('shows a roll nobody has touched', () => {
    const campaign = openWithRolls();
    const written = campaign.append({ type: ROLL_PERFORMED, payload: showing(4) });
    if (!written.ok) throw new Error('could not write');

    expect(campaign.stateOf(rolls).rolls).toEqual([
      {
        id: written.value.id,
        request: A_D10,
        dice: [{ sides: 10, value: 4, source: { kind: 'manual' } }],
        currentVersionId: written.value.id,
        replacements: [],
      },
    ]);
  });

  it('shows the dice that now stand, not the ones first recorded', () => {
    const campaign = openWithRolls();
    const first = campaign.append({ type: ROLL_PERFORMED, payload: showing(4) });
    if (!first.ok) throw new Error('could not write');

    const corrected = campaign.append({
      type: ROLL_PERFORMED,
      revises: first.value.id,
      payload: nowShowing(7, 'corrected'),
    });
    if (!corrected.ok) throw new Error('could not correct');

    const [standing] = campaign.stateOf(rolls).rolls;
    expect(standing?.dice[0]?.value).toBe(7);
    expect(standing?.id).toBe(first.value.id);
    expect(standing?.currentVersionId).toBe(corrected.value.id);
  });

  it('reads three corrections as one roll, not three', () => {
    const campaign = openWithRolls();
    const first = campaign.append({ type: ROLL_PERFORMED, payload: showing(4) });
    if (!first.ok) throw new Error('could not write');

    let previous = first.value.id;
    for (const value of [7, 2, 9]) {
      const again = campaign.append({
        type: ROLL_PERFORMED,
        revises: previous,
        payload: nowShowing(value, 'corrected'),
      });
      if (!again.ok) throw new Error('could not correct');
      previous = again.value.id;
    }

    const state = campaign.stateOf(rolls);
    expect(state.rolls).toHaveLength(1);
    expect(state.rolls[0]?.dice[0]?.value).toBe(9);
    expect(state.rolls[0]?.replacements).toHaveLength(3);
    expect(state.rolls[0]?.currentVersionId).toBe(previous);
  });

  it('keeps why each replacement happened, in order', () => {
    // A count would say how often this changed. The reasons say whether the
    // player got lucky or kept fixing typos, which is what the log records them
    // for.
    const campaign = openWithRolls();
    const first = campaign.append({ type: ROLL_PERFORMED, payload: showing(4) });
    if (!first.ok) throw new Error('could not write');

    let previous = first.value.id;
    for (const [value, because] of [
      [7, 'corrected'],
      [2, 'rerolled'],
      [9, 'corrected'],
    ] as const) {
      const again = campaign.append({
        type: ROLL_PERFORMED,
        revises: previous,
        payload: nowShowing(value, because),
      });
      if (!again.ok) throw new Error('could not replace');
      previous = again.value.id;
    }

    expect(campaign.stateOf(rolls).rolls[0]?.replacements.map((one) => one.because)).toEqual([
      'corrected',
      'rerolled',
      'corrected',
    ]);
  });

  it('keeps several rolls apart', () => {
    const campaign = openWithRolls();
    const first = campaign.append({ type: ROLL_PERFORMED, payload: showing(4) });
    const second = campaign.append({ type: ROLL_PERFORMED, payload: showing(8) });
    if (!first.ok || !second.ok) throw new Error('could not write');

    const corrected = campaign.append({
      type: ROLL_PERFORMED,
      revises: second.value.id,
      payload: nowShowing(3, 'corrected'),
    });
    if (!corrected.ok) throw new Error('could not correct');

    const state = campaign.stateOf(rolls);
    expect(state.rolls.map((one) => one.dice[0]?.value)).toEqual([4, 3]);
    expect(state.rolls[0]?.replacements).toEqual([]);
  });

  it.each([
    [
      'a replacement of something it has never seen',
      { revises: 'event-nobody-recorded', payload: nowShowing(7, 'corrected') },
    ],
    ['a payload that is not a roll', { payload: { nonsense: true } }],
    ['a reason on an event that replaces nothing', { payload: nowShowing(7, 'corrected') }],
    ['a replacement that does not say why', { revises: 'event-1', payload: showing(7) }],
  ])('ignores %s entirely', (_name, draft) => {
    // The whole state, not just the list. An event that lands in rollOf while
    // leaving rolls empty looks harmless and means the projection believes an
    // event belongs to a roll that does not exist.
    const campaign = openWithRolls();
    const untouched = campaign.stateOf(rolls);

    const written = campaign.append({ type: ROLL_PERFORMED, ...draft });
    if (!written.ok) throw new Error('could not write');

    expect(campaign.stateOf(rolls)).toEqual(untouched);
  });
});

describeProjectionIsPredictable(
  'the roll that stands',
  () => rolls,
  () => [
    {
      id: 'event-1',
      seq: 1,
      at: '2026-08-05T09:00:01.000Z',
      type: ROLL_PERFORMED,
      schemaVersion: 1,
      payload: {
        request: { dice: [{ sides: 10, count: 1 }] },
        dice: [{ sides: 10, value: 4, source: { kind: 'manual' } }],
      },
    },
    {
      id: 'event-2',
      seq: 2,
      at: '2026-08-05T09:00:02.000Z',
      type: ROLL_PERFORMED,
      schemaVersion: 1,
      revises: 'event-1',
      payload: {
        request: { dice: [{ sides: 10, count: 1 }] },
        dice: [{ sides: 10, value: 7, source: { kind: 'digital' } }],
        supersedes: { because: 'rerolled' },
      },
    },
  ],
);
