import {
  answerSuggestion,
  describesEveryField,
  readOffer,
  sequenceCheck,
  SUGGESTION_OFFERED,
  type ContentPackage,
  type EventEnvelope,
  type RollPerformedV1,
  describesRecordableEntities,
  type ProjectionContext,
} from '@aether-forge/core';
import { asProjection, describeProjectionIsPredictable } from '@aether-forge/core/testing';
import { describe, expect, it } from 'vitest';

import {
  checksFrom,
  COMPATIBLE_CORE_CONTRACT_VERSION,
  IRONSWORN_SYSTEM_ID,
  momentum,
  MOMENTUM_CHANGED,
  MOVE_INVOKED,
  MOVE_RESOLVED,
  STARFORGED_SYSTEM_ID,
  STARTING_MOMENTUM,
  CHARACTER_TEMPLATE,
  templates,
  VOW_TEMPLATE,
} from './index.js';

/**
 * A fixture package carrying the facts the importer would produce, with a
 * move of each kind, so the checks are built the way the application builds
 * them: from content joined to the interpreters. Face Danger's facts are the
 * real ones, because its behaviour is what the tuned proposals preserve.
 */
const CONTENT_FIXTURE: ContentPackage = {
  manifest: {
    id: 'example.fixture-content',
    version: '1.0.0',
    title: 'Fixture Content',
    systems: [STARFORGED_SYSTEM_ID],
    license: 'CC-BY-4.0',
    source: 'bundled',
    contentHash: 'sha256-irrelevant-here',
  },
  tables: [],
  documents: [],
  entityTemplates: [],
  raw: {
    formatVersion: 1,
    moves: [
      {
        id: 'starforged/adventure/face_danger',
        name: 'Face Danger',
        kind: 'action',
        stats: ['edge', 'heart', 'iron', 'shadow', 'wits'],
      },
      {
        id: 'starforged/quest/fulfill_your_vow',
        name: 'Fulfill Your Vow',
        kind: 'progress',
        stats: [],
      },
      { id: 'starforged/session/take_a_break', name: 'Take a Break', kind: 'none', stats: [] },
      {
        id: 'starforged/legacy/continue_a_legacy',
        name: 'Continue a Legacy',
        kind: 'special',
        stats: [],
      },
    ],
  },
};

function builtCheck(id: string) {
  const found = checksFrom([CONTENT_FIXTURE]).find((check) => check.id === id);
  if (found === undefined) throw new Error(`the fixture content built no check ${id}`);
  return found;
}

const FACE_DANGER = builtCheck('starforged/adventure/face_danger');

function aChange(seq: number, by: number): EventEnvelope {
  return {
    id: `event-${seq}`,
    campaignId: 'campaign-under-test',
    seq,
    at: '2026-08-04T09:00:00.000Z',
    type: MOMENTUM_CHANGED,
    schemaVersion: 1,
    systemId: STARFORGED_SYSTEM_ID,
    payload: { by },
  };
}

const aSession = (): readonly EventEnvelope[] => [
  aChange(1, 1),
  aChange(2, 1),
  aChange(3, -2),
  aChange(4, 3),
];

describe('@aether-forge/system-ironsworn', () => {
  it('declares both supported system ids', () => {
    expect(STARFORGED_SYSTEM_ID).toBe('ironsworn-starforged');
    expect(IRONSWORN_SYSTEM_ID).toBe('ironsworn-classic');
  });

  it('tracks the core contract version', () => {
    expect(COMPATIBLE_CORE_CONTRACT_VERSION).toBe(1);
  });
});

describe('momentum', () => {
  const run = (events: readonly EventEnvelope[]) =>
    events.reduce(
      (state, event) => momentum.apply(state, event, { stateOf: () => undefined as never }),
      momentum.initial(),
    );

  it('starts where the rules say it starts', () => {
    expect(momentum.initial().current).toBe(STARTING_MOMENTUM);
  });

  it('is the sum of every recorded change', () => {
    expect(run(aSession()).current).toBe(STARTING_MOMENTUM + 1 + 1 - 2 + 3);
  });

  it('remembers how far it went in each direction', () => {
    const state = run(aSession());
    expect(state.highest).toBe(5);
    expect(state.lowest).toBe(2);
  });

  it('does not cap it, because a cap is a suggestion and not a fact', () => {
    // The rules put a ceiling on momentum. That ceiling belongs to what the
    // application suggests, not to what it records. Clamping here would make
    // the events add up to one number while the state showed another.
    const runaway = Array.from({ length: 20 }, (_, index) => aChange(index + 1, 1));
    expect(run(runaway).current).toBe(STARTING_MOMENTUM + 20);
  });

  it('ignores a change it cannot read', () => {
    const nonsense: EventEnvelope = { ...aChange(1, 1), payload: { by: 'quite a lot' } };
    expect(run([nonsense]).changes).toBe(0);
  });
});

// The other half of the canary, held to the same checks as the toy module.
describeProjectionIsPredictable('momentum', () => asProjection(momentum), aSession);

describe('Face Danger, as a check', () => {
  function anActionRoll(action: number, first: number, second: number): RollPerformedV1 {
    return {
      request: {
        dice: [
          { sides: 6, count: 1, label: 'action' },
          { sides: 10, count: 2, label: 'challenge' },
        ],
      },
      dice: [
        { sides: 6, value: action, source: { kind: 'digital' } },
        { sides: 10, value: first, source: { kind: 'digital' } },
        { sides: 10, value: second, source: { kind: 'digital' } },
      ],
    };
  }

  it('beats both challenge dice for a strong hit', () => {
    expect(FACE_DANGER.interpret(anActionRoll(6, 2, 3), { stat: 3, bonus: 0 }).id).toBe(
      'strong-hit',
    );
  });

  it('beats one for a weak hit', () => {
    expect(FACE_DANGER.interpret(anActionRoll(4, 2, 9), { stat: 2, bonus: 0 }).id).toBe('weak-hit');
  });

  it('beats neither for a miss', () => {
    expect(FACE_DANGER.interpret(anActionRoll(1, 8, 9), { stat: 1, bonus: 0 }).id).toBe('miss');
  });

  it('does not beat a challenge die it merely equals', () => {
    // The boundary, and the rule: the total has to exceed the die, not match
    // it. A test using only clear wins and clear losses walks straight past
    // an off-by-one here.
    const tie = anActionRoll(4, 6, 9);
    expect(FACE_DANGER.interpret(tie, { stat: 2, bonus: 0 }).id).toBe('miss');

    // One more, and it beats the first die.
    const over = anActionRoll(4, 6, 9);
    expect(FACE_DANGER.interpret(over, { stat: 2, bonus: 1 }).id).toBe('weak-hit');
  });

  it('counts the bonus as well as the stat', () => {
    // Same dice, different bonus, different outcome. This is what an input is
    // for, and it is why every one of them stays editable.
    const dice = anActionRoll(3, 5, 6);
    expect(FACE_DANGER.interpret(dice, { stat: 1, bonus: 0 }).id).toBe('miss');
    expect(FACE_DANGER.interpret(dice, { stat: 1, bonus: 3 }).id).toBe('strong-hit');
  });

  it('gives the same answer for the same roll and inputs, every time', () => {
    const dice = anActionRoll(4, 2, 9);
    expect(FACE_DANGER.interpret(dice, { stat: 2, bonus: 0 })).toEqual(
      FACE_DANGER.interpret(dice, { stat: 2, bonus: 0 }),
    );
  });

  it('says so rather than guessing when the roll is not an action roll', () => {
    const twoDice: RollPerformedV1 = {
      request: { dice: [{ sides: 6, count: 1 }] },
      dice: [{ sides: 6, value: 4, source: { kind: 'manual' } }],
    };

    expect(FACE_DANGER.interpret(twoDice, { stat: 2, bonus: 0 }).id).toBe('unreadable');
    expect(FACE_DANGER.interpret(null, { stat: 2, bonus: 0 }).id).toBe('unreadable');
  });

  it('offers every stat, and has an opinion about none of them', () => {
    const stat = FACE_DANGER.inputs.find((input) => input.id === 'stat');
    expect(stat?.options?.map((option) => option.id)).toEqual([
      'edge',
      'heart',
      'iron',
      'shadow',
      'wits',
    ]);
  });
});

describe('what Face Danger proposes', () => {
  function anActionRoll(action: number, first: number, second: number): RollPerformedV1 {
    return {
      request: {
        dice: [
          { sides: 6, count: 1, label: 'action' },
          { sides: 10, count: 2, label: 'challenge' },
        ],
      },
      dice: [
        { sides: 6, value: action, source: { kind: 'digital' } },
        { sides: 10, value: first, source: { kind: 'digital' } },
        { sides: 10, value: second, source: { kind: 'digital' } },
      ],
    };
  }

  it('proposes a gain on a strong hit and a loss on a miss', () => {
    const strong = FACE_DANGER.interpret(anActionRoll(6, 2, 3), { stat: 3, bonus: 0 });
    const miss = FACE_DANGER.interpret(anActionRoll(1, 8, 9), { stat: 1, bonus: 0 });

    expect((strong.suggests[0]?.proposes.payload as { by: number }).by).toBe(1);
    expect((miss.suggests[0]?.proposes.payload as { by: number }).by).toBe(-2);
  });

  it('describes every field of what it proposes', () => {
    // The contract requires it. A proposal describing only part of its payload
    // would be adjustable in parts, and a player pressing adjust would be
    // guessing at which parts.
    const outcome = FACE_DANGER.interpret(anActionRoll(4, 2, 9), { stat: 2, bonus: 0 });

    for (const suggestion of outcome.suggests) {
      expect(describesEveryField(suggestion), suggestion.id).toBe(true);
    }
  });

  it('proposes one thing, so it can be refused on its own', () => {
    const outcome = FACE_DANGER.interpret(anActionRoll(4, 2, 9), { stat: 2, bonus: 0 });
    expect(outcome.suggests).toHaveLength(1);
    expect(Array.isArray(outcome.suggests[0]?.proposes)).toBe(false);
  });
});

describe('running Face Danger through core', () => {
  /** Both acts, joined the way the application will join them. */
  function run(answer: 'accepted' | 'declined') {
    const roll: RollPerformedV1 = {
      request: {
        dice: [
          { sides: 6, count: 1, label: 'action' },
          { sides: 10, count: 2, label: 'challenge' },
        ],
      },
      dice: [
        { sides: 6, value: 4, source: { kind: 'digital' } },
        { sides: 10, value: 2, source: { kind: 'digital' } },
        { sides: 10, value: 9, source: { kind: 'digital' } },
      ],
    };
    const inputs = { stat: 2, bonus: 0 };
    const outcome = FACE_DANGER.interpret(roll, inputs);

    const ran = sequenceCheck({
      check: FACE_DANGER,
      systemId: STARFORGED_SYSTEM_ID,
      offered: [
        {
          input: 'stat',
          label: 'Use edge',
          value: 2,
          why: 'your vehicle is built for this',
          answer: 'accepted',
        },
      ],
      inputs,
      roll,
      outcome,
      events: { invoked: MOVE_INVOKED, resolved: MOVE_RESOLVED },
    });

    // Read back out of what was written, with nothing kept from the run above.
    const lastOffer = [...ran].reverse().find((each) => each.draft.type === SUGGESTION_OFFERED);
    const offer = readOffer(JSON.parse(JSON.stringify(lastOffer?.draft.payload)));
    if (offer === undefined) throw new Error('the offer did not read back');

    const answered = answerSuggestion(offer, { kind: answer });
    if (!answered.ok) throw new Error(`could not answer: ${answered.failure.kind}`);

    return {
      ran,
      types: [
        ...ran.map((each) => each.draft.type),
        answered.value.answer.type,
        ...(answered.value.applied === undefined ? [] : [answered.value.applied.type]),
      ],
    };
  }

  it('produces the eight-event chain when the effect is accepted', () => {
    expect(run('accepted').types).toEqual([
      SUGGESTION_OFFERED,
      'core.suggestion.accepted',
      MOVE_INVOKED,
      'core.roll.performed',
      MOVE_RESOLVED,
      SUGGESTION_OFFERED,
      'core.suggestion.accepted',
      MOMENTUM_CHANGED,
    ]);
  });

  it('writes nothing to momentum when the effect is refused', () => {
    const types = run('declined').types;
    expect(types).not.toContain(MOMENTUM_CHANGED);
    expect(types[types.length - 1]).toBe('core.suggestion.declined');
  });

  it('says which stat was suggested and that it was taken', () => {
    const [offered, answered] = run('accepted').ran;
    expect((offered?.draft.payload as { why: string }).why).toBe('your vehicle is built for this');
    expect(answered?.draft.type).toBe('core.suggestion.accepted');
  });
});

describe('the entities this system describes', () => {
  it('describes recordable entities, both of them', () => {
    for (const template of templates) {
      expect(describesRecordableEntities(template)).toBe(true);
    }
    expect(templates).toHaveLength(2);
  });

  it('gives a character the five stats and three condition meters', () => {
    const stats = CHARACTER_TEMPLATE.fields.filter((field) => field.kind === 'number');
    expect(stats.map((field) => field.id)).toEqual(['edge', 'heart', 'iron', 'shadow', 'wits']);
    expect(CHARACTER_TEMPLATE.tracks.map((track) => track.id)).toEqual([
      'health',
      'spirit',
      'supply',
    ]);
    expect(CHARACTER_TEMPLATE.tracks.every((track) => track.startsFilled === track.segments)).toBe(
      true,
    );
  });

  it('gives a vow ten segments of progress, starting empty', () => {
    const [progress] = VOW_TEMPLATE.tracks;
    expect(progress?.segments).toBe(10);
    expect(progress?.startsFilled).toBe(0);
  });

  it('does not describe momentum as a track, because burning it is a rule', () => {
    expect(CHARACTER_TEMPLATE.tracks.some((track) => track.id === 'momentum')).toBe(false);
  });
});

describe('the stat the application would use', () => {
  const statInput = FACE_DANGER.inputs.find((input) => input.id === 'stat');

  const aCampaignHolding = (held: unknown): ProjectionContext => ({
    stateOf: <State>() => held as State,
  });

  const character = (fields: Record<string, string | number | boolean>) => ({
    entities: [
      {
        id: 'vess',
        entityType: `sys.${STARFORGED_SYSTEM_ID}.character`,
        fields,
        tracks: [],
        createdBy: 'event-1',
        touchedBy: 'event-1',
      },
    ],
    entityOf: {},
    trackEventOf: {},
  });

  it('suggests the strongest stat, read from the character, saying whose it is', () => {
    const suggested = statInput?.suggest?.(
      aCampaignHolding(character({ name: 'Vess', edge: 1, heart: 2, iron: 1, shadow: 2, wits: 3 })),
    );

    expect(suggested).toEqual({ value: 3, why: 'wits is the strongest Vess has' });
  });

  it('suggests nothing when the campaign has no character, and nothing must work', () => {
    expect(
      statInput?.suggest?.(aCampaignHolding({ entities: [], entityOf: {}, trackEventOf: {} })),
    ).toBeUndefined();
  });

  it('suggests nothing from a character whose stats are not numbers yet', () => {
    expect(statInput?.suggest?.(aCampaignHolding(character({ name: 'Vess' })))).toBeUndefined();
  });
});

describe('building checks from content', () => {
  it('offers a check for every runnable kind, and none for the special pair', () => {
    const built = checksFrom([CONTENT_FIXTURE]);

    expect(built.map((check) => check.id)).toEqual([
      'starforged/adventure/face_danger',
      'starforged/quest/fulfill_your_vow',
      'starforged/session/take_a_break',
    ]);
  });

  it('gives an action move its dice, its stats and its document reference', () => {
    const built = builtCheck('starforged/adventure/face_danger');

    expect(built.name).toBe('Face Danger');
    expect(built.docRef).toBe('starforged/adventure/face_danger');
    expect(built.decisive).toBe('challenge');
    expect(built.roll?.dice).toEqual([
      { sides: 6, count: 1, label: 'action' },
      { sides: 10, count: 2, label: 'challenge' },
    ]);
    expect(
      built.inputs.find((input) => input.id === 'stat')?.options?.map((option) => option.id),
    ).toEqual(['edge', 'heart', 'iron', 'shadow', 'wits']);
  });

  it('gives a progress move its score and no action die', () => {
    const built = builtCheck('starforged/quest/fulfill_your_vow');

    expect(built.roll?.dice).toEqual([{ sides: 10, count: 2, label: 'challenge' }]);
    expect(built.inputs.map((input) => input.id)).toEqual(['progress']);
    expect(built.interpret(null, { progress: 10 }).id).toBe('unreadable');
  });

  it('gives a no-roll move no dice and one outcome', () => {
    const built = builtCheck('starforged/session/take_a_break');

    expect(built.roll).toBeNull();
    expect(built.interpret(null, {}).id).toBe('resolved');
  });

  it('builds nothing from a package another system owns, or from a compartment it cannot read', () => {
    const foreign: ContentPackage = {
      ...CONTENT_FIXTURE,
      manifest: { ...CONTENT_FIXTURE.manifest, systems: ['someone-else'] },
    };
    const garbled: ContentPackage = { ...CONTENT_FIXTURE, raw: { formatVersion: 99 } };

    expect(checksFrom([foreign])).toEqual([]);
    expect(checksFrom([garbled])).toEqual([]);
  });

  it('proposes momentum only where a move was tuned by hand', () => {
    // Face Danger was tuned; the others were not, and a move nobody tuned
    // proposes nothing rather than pretending to know a rule.
    const faceDanger = builtCheck('starforged/adventure/face_danger');
    const withTuning = faceDanger.interpret(
      {
        request: {
          dice: [
            { sides: 6, count: 1 },
            { sides: 10, count: 2 },
          ],
        },
        dice: [
          { sides: 6, value: 4, source: { kind: 'manual' } },
          { sides: 10, value: 2, source: { kind: 'manual' } },
          { sides: 10, value: 9, source: { kind: 'manual' } },
        ],
      },
      { stat: 2, bonus: 0 },
    );
    expect(withTuning.suggests).toHaveLength(1);
    expect(withTuning.suggests[0]?.label).toBe('Momentum -1');

    const untuned = builtCheck('starforged/quest/fulfill_your_vow').interpret(
      {
        request: { dice: [{ sides: 10, count: 2 }] },
        dice: [
          { sides: 10, value: 2, source: { kind: 'manual' } },
          { sides: 10, value: 9, source: { kind: 'manual' } },
        ],
      },
      { progress: 5 },
    );
    expect(untuned.suggests).toEqual([]);
  });
});
