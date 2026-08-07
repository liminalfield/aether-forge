import { describe, expect, it } from 'vitest';

import type { CheckDefinition } from './check.js';
import { ROLL_PERFORMED, type RollPerformedV1 } from './roll.js';
import {
  answerSuggestion,
  sequenceCheck,
  type CheckRun,
  type SuggestionAnswer,
} from './running-a-check.js';
import {
  readOffer,
  SUGGESTION_ACCEPTED,
  SUGGESTION_ADJUSTED,
  SUGGESTION_DECLINED,
  SUGGESTION_OFFERED,
  type SuggestionOfferedV2,
} from './suggestion.js';

const INVOKED = 'sys.example.check.invoked';
const RESOLVED = 'sys.example.check.resolved';
const SPENT = 'sys.example.resource.spent';

const A_CHECK: CheckDefinition = {
  id: 'example.dummy/face-it',
  name: 'Face it',
  roll: { dice: [{ sides: 6, count: 1 }] },
  inputs: [
    {
      id: 'approach',
      label: 'Approach',
      kind: 'choice',
      source: 'chosen',
      options: [
        { id: 'careful', label: 'Careful', value: 1 },
        { id: 'quick', label: 'Quick', value: 3 },
      ],
    },
  ],
  interpret: () => ({ id: 'weak-hit', label: 'Weak hit', summary: 'At a cost.', suggests: [] }),
};

const A_ROLL: RollPerformedV1 = {
  request: { dice: [{ sides: 6, count: 1 }] },
  dice: [{ sides: 6, value: 4, source: { kind: 'digital' } }],
};

const A_PROPOSAL = {
  id: 'example.dummy/spend-one',
  label: 'Spend one from the resource',
  fields: [{ id: 'by', label: 'Amount', kind: 'number' as const }],
  proposes: { type: SPENT, systemId: 'example', payload: { by: -1 } },
};

function aRun(overrides: Partial<CheckRun> = {}): CheckRun {
  return {
    check: A_CHECK,
    systemId: 'example',
    offered: [],
    inputs: { approach: 3 },
    roll: A_ROLL,
    outcome: A_CHECK.interpret(A_ROLL, { approach: 3 }),
    events: { invoked: INVOKED, resolved: RESOLVED },
    ...overrides,
  };
}

const typesOf = (run: CheckRun): readonly string[] =>
  sequenceCheck(run).map((each) => each.draft.type);

describe('the plainest check', () => {
  it('is an invocation, a roll and a resolution', () => {
    expect(typesOf(aRun())).toEqual([INVOKED, ROLL_PERFORMED, RESOLVED]);
  });

  it('has the roll caused by the invocation, and the resolution by the roll', () => {
    const drafts = sequenceCheck(aRun());
    expect(drafts[1]?.causedBy).toBe(0);
    expect(drafts[2]?.causedBy).toBe(1);
  });

  it('records the inputs it ran with on both events', () => {
    // The resolution carries them so that it says what it was reading, which is
    // what stops a later correction making the outcome unexplainable.
    const drafts = sequenceCheck(aRun());
    expect((drafts[0]?.draft.payload as { inputs: unknown }).inputs).toEqual({ approach: 3 });
    expect((drafts[2]?.draft.payload as { inputs: unknown }).inputs).toEqual({ approach: 3 });
  });
});

describe('a check with no dice', () => {
  it('skips the roll and joins the resolution to the invocation', () => {
    const drafts = sequenceCheck(aRun({ roll: null }));
    expect(drafts.map((each) => each.draft.type)).toEqual([INVOKED, RESOLVED]);
    expect(drafts[1]?.causedBy).toBe(0);
  });
});

describe('what the application put forward before the roll', () => {
  const offered = [
    {
      input: 'approach',
      label: 'Go quickly',
      value: 3,
      why: 'the vehicle is built for it',
      answer: 'accepted' as const,
    },
  ];

  it('offers it, records the answer, and then runs the check', () => {
    expect(typesOf(aRun({ offered }))).toEqual([
      SUGGESTION_OFFERED,
      SUGGESTION_ACCEPTED,
      INVOKED,
      ROLL_PERFORMED,
      RESOLVED,
    ]);
  });

  it('records a refusal, and the check still runs', () => {
    // Declining is a real answer, not an abandonment. The player chose
    // something else and the check goes ahead with it.
    expect(typesOf(aRun({ offered: [{ ...offered[0]!, answer: 'declined' as const }] }))).toEqual([
      SUGGESTION_OFFERED,
      SUGGESTION_DECLINED,
      INVOKED,
      ROLL_PERFORMED,
      RESOLVED,
    ]);
  });

  it('records what the player used when they changed it', () => {
    const drafts = sequenceCheck(
      aRun({ offered: [{ ...offered[0]!, answer: { adjustedTo: 1 } }] }),
    );

    expect(drafts[1]?.draft.type).toBe(SUGGESTION_ADJUSTED);
    expect(drafts[1]?.draft.payload).toEqual({ used: { approach: 1 } });
  });

  it('says why it was offered', () => {
    const drafts = sequenceCheck(aRun({ offered }));
    expect((drafts[0]?.draft.payload as { why: string }).why).toBe('the vehicle is built for it');
  });
});

describe('what the module proposed afterwards', () => {
  const outcome = {
    id: 'weak-hit',
    label: 'Weak hit',
    summary: 'At a cost.',
    suggests: [A_PROPOSAL],
  };

  it('offers it, and stops there', () => {
    // The first act ends with the suggestion on the table. Nobody has seen it
    // yet, so there is nothing they could have said about it.
    expect(typesOf(aRun({ outcome }))).toEqual([
      INVOKED,
      ROLL_PERFORMED,
      RESOLVED,
      SUGGESTION_OFFERED,
    ]);
  });

  it('joins the offer to the resolution that produced it', () => {
    const drafts = sequenceCheck(aRun({ outcome }));
    expect(drafts[3]?.causedBy).toBe(2);
  });

  it('offers every suggestion the outcome made', () => {
    const two = {
      ...outcome,
      suggests: [A_PROPOSAL, { ...A_PROPOSAL, id: 'example.dummy/other' }],
    };

    expect(typesOf(aRun({ outcome: two }))).toEqual([
      INVOKED,
      ROLL_PERFORMED,
      RESOLVED,
      SUGGESTION_OFFERED,
      SUGGESTION_OFFERED,
    ]);
  });

  it('writes nothing at all for an outcome that proposes nothing', () => {
    expect(typesOf(aRun())).toEqual([INVOKED, ROLL_PERFORMED, RESOLVED]);
  });
});

describe('answering an offer, whenever that happens', () => {
  const outcome = {
    id: 'weak-hit',
    label: 'Weak hit',
    summary: 'At a cost.',
    suggests: [A_PROPOSAL],
  };

  /**
   * The offer as a later session would find it: written down, serialised, and
   * read back with no module anywhere near it.
   */
  function anOfferFromTheLog(run: CheckRun = aRun({ outcome })): SuggestionOfferedV2 {
    const offered = sequenceCheck(run).find((each) => each.draft.type === SUGGESTION_OFFERED);
    const read = readOffer(JSON.parse(JSON.stringify(offered?.draft.payload)));
    if (read === undefined) throw new Error('the offer did not read back');
    return read;
  }

  function answered(answer: SuggestionAnswer, offer = anOfferFromTheLog()) {
    const result = answerSuggestion(offer, answer);
    if (!result.ok) throw new Error(`could not answer: ${result.failure.kind}`);
    return result.value;
  }

  it('writes the acceptance and what it took', () => {
    const { answer, applied } = answered({ kind: 'accepted' });

    expect(answer.type).toBe(SUGGESTION_ACCEPTED);
    expect(applied?.type).toBe(SPENT);
  });

  it('writes the refusal and nothing else', () => {
    // The whole promise, in one assertion. There is no path through this that
    // appends a proposal without an answer that took it.
    const { answer, applied } = answered({ kind: 'declined' });

    expect(answer.type).toBe(SUGGESTION_DECLINED);
    expect(applied).toBeUndefined();
  });

  it('leaves the proposal alone when it was accepted unchanged', () => {
    expect(answered({ kind: 'accepted' }).applied?.payload).toEqual({ by: -1 });
  });

  it('writes what the player used when they adjusted it', () => {
    const { answer, applied } = answered({ kind: 'adjusted', used: { by: -2 } });

    expect(answer.type).toBe(SUGGESTION_ADJUSTED);
    expect(answer.payload).toEqual({ used: { by: -2 } });
    expect(applied?.payload).toEqual({ by: -2 });
  });

  it('keeps the parts of the proposal the player did not change', () => {
    const offer = anOfferFromTheLog(
      aRun({
        outcome: {
          ...outcome,
          suggests: [
            {
              ...A_PROPOSAL,
              proposes: { type: SPENT, systemId: 'example', payload: { by: -1, why: 'a cost' } },
            },
          ],
        },
      }),
    );

    expect(answered({ kind: 'adjusted', used: { by: -2 } }, offer).applied?.payload).toEqual({
      by: -2,
      why: 'a cost',
    });
  });

  it('carries the system through, so the event can be written at all', () => {
    const { applied } = answered({ kind: 'accepted' });
    expect(applied).toHaveProperty('systemId', 'example');
  });

  it('refuses to accept an offer that does not say which module proposed it', () => {
    // What a version 1 offer of a module event reads back as. Guessing the
    // system out of the type would put an event in the log under a module that
    // never proposed it.
    const fromVersion1: SuggestionOfferedV2 = {
      suggestion: 'example.dummy/spend-one',
      label: 'Spend one from the resource',
      proposes: { type: SPENT, payload: { by: -1 } },
      fields: [],
    };

    const result = answerSuggestion(fromVersion1, { kind: 'accepted' });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.failure.kind).toBe('proposal-has-no-system');
  });

  it('still lets that offer be refused', () => {
    // A refusal needs nothing rebuilt. Somebody should always be able to say no.
    const fromVersion1: SuggestionOfferedV2 = {
      suggestion: 'example.dummy/spend-one',
      label: 'Spend one from the resource',
      proposes: { type: SPENT, payload: { by: -1 } },
      fields: [],
    };

    const result = answerSuggestion(fromVersion1, { kind: 'declined' });

    expect(result.ok && result.value.answer.type).toBe(SUGGESTION_DECLINED);
    expect(result.ok && result.value.applied).toBeUndefined();
  });

  it('answers an offer proposing an event that belongs to core', () => {
    const proposingACoreEvent: SuggestionOfferedV2 = {
      suggestion: 'example.dummy/write-it-down',
      label: 'Write it down',
      proposes: { type: 'core.entry.created', payload: { text: 'It answered.' } },
      fields: [],
    };

    const result = answerSuggestion(proposingACoreEvent, { kind: 'accepted' });

    expect(result.ok && result.value.applied?.type).toBe('core.entry.created');
    expect(result.ok && result.value.applied).not.toHaveProperty('systemId');
  });

  it('says so when the recorded type belongs to no namespace at all', () => {
    // Nothing this codebase writes produces one, so reaching it means the log
    // has been edited or damaged.
    const damaged: SuggestionOfferedV2 = {
      suggestion: 'a',
      label: 'x',
      proposes: { type: 'nonsense.happened', payload: {} },
      fields: [],
    };

    const result = answerSuggestion(damaged, { kind: 'accepted' });

    expect(!result.ok && result.failure.kind).toBe('proposal-is-not-an-event-type');
  });
});

describe('the whole chain from the design record', () => {
  const outcome = {
    id: 'weak-hit',
    label: 'Weak hit',
    summary: 'At a cost.',
    suggests: [A_PROPOSAL],
  };

  const A_WHOLE_RUN = aRun({
    offered: [
      {
        input: 'approach',
        label: 'Go quickly',
        value: 3,
        why: 'the vehicle is built for it',
        answer: 'accepted',
      },
    ],
    outcome,
  });

  /**
   * Both acts, joined the way the application will join them: run the check,
   * write it down, and come back later to answer what it offered.
   *
   * The offer goes through a serialisation on the way, because the point of the
   * split is that the second act works from the log rather than from anything
   * left in memory when the first one finished.
   */
  function bothActs(answer: SuggestionAnswer): readonly string[] {
    const first = sequenceCheck(A_WHOLE_RUN);

    const lastOffer = [...first].reverse().find((each) => each.draft.type === SUGGESTION_OFFERED);
    const offer = readOffer(JSON.parse(JSON.stringify(lastOffer?.draft.payload)));
    if (offer === undefined) throw new Error('the offer did not read back');

    const second = answerSuggestion(offer, answer);
    if (!second.ok) throw new Error(`could not answer: ${second.failure.kind}`);

    return [
      ...first.map((each) => each.draft.type),
      second.value.answer.type,
      ...(second.value.applied === undefined ? [] : [second.value.applied.type]),
    ];
  }

  it('comes out in the order the record sets out', () => {
    expect(bothActs({ kind: 'adjusted', used: { by: -2 } })).toEqual([
      SUGGESTION_OFFERED,
      SUGGESTION_ACCEPTED,
      INVOKED,
      ROLL_PERFORMED,
      RESOLVED,
      SUGGESTION_OFFERED,
      SUGGESTION_ADJUSTED,
      SPENT,
    ]);
  });

  it('is eight events', () => {
    // The number the record puts at the top, so that the cost is visible.
    // Splitting the run in two did not change it.
    expect(bothActs({ kind: 'adjusted', used: { by: -2 } })).toHaveLength(8);
  });

  it('is the same chain whether it is answered now or in a later session', () => {
    // The gate. Nothing about the second act depends on the first still being
    // in memory, so a decision left overnight arrives at the same log.
    const first = sequenceCheck(A_WHOLE_RUN);
    const lastOffer = [...first].reverse().find((each) => each.draft.type === SUGGESTION_OFFERED);

    const inMemory = readOffer(lastOffer?.draft.payload);
    const fromDisk = readOffer(JSON.parse(JSON.stringify(lastOffer?.draft.payload)));
    if (inMemory === undefined || fromDisk === undefined) {
      throw new Error('the offer did not read back');
    }

    const adjustment: SuggestionAnswer = { kind: 'adjusted', used: { by: -2 } };

    expect(answerSuggestion(fromDisk, adjustment)).toEqual(answerSuggestion(inMemory, adjustment));
  });

  it('is seven events when the effect is refused, and none of them is the effect', () => {
    expect(bothActs({ kind: 'declined' })).toEqual([
      SUGGESTION_OFFERED,
      SUGGESTION_ACCEPTED,
      INVOKED,
      ROLL_PERFORMED,
      RESOLVED,
      SUGGESTION_OFFERED,
      SUGGESTION_DECLINED,
    ]);
  });
});

describe('what an offer records for later', () => {
  const outcome = {
    id: 'weak-hit',
    label: 'Weak hit',
    summary: 'At a cost.',
    suggests: [A_PROPOSAL],
  };

  /** The offer as the log would hold it, having been nowhere near the module. */
  function offerFromTheLog(run: CheckRun): SuggestionOfferedV2 {
    const drafts = sequenceCheck(run);
    const offered = drafts.find((each) => each.draft.type === SUGGESTION_OFFERED);

    // Through a serialisation and back, which is the only honest way to test a
    // claim about what survives being written down and read in another session.
    const read = readOffer(JSON.parse(JSON.stringify(offered?.draft.payload)));
    if (read === undefined) throw new Error('the offer did not read back');
    return read;
  }

  it('records the fields the module said could be changed', () => {
    const offer = offerFromTheLog(aRun({ outcome }));

    expect(offer.fields).toEqual([{ id: 'by', label: 'Amount', kind: 'number' }]);
  });

  it('records which module the proposal belongs to', () => {
    // A module event is required to name its system, so an offer read back on
    // its own could not be turned into one without this.
    const offer = offerFromTheLog(aRun({ outcome }));

    expect(offer.proposes.systemId).toBe('example');
  });

  it('is enough on its own to rebuild what accepting would write', () => {
    const offer = offerFromTheLog(aRun({ outcome }));

    expect({
      type: offer.proposes.type,
      systemId: offer.proposes.systemId,
      payload: offer.proposes.payload,
    }).toEqual(A_PROPOSAL.proposes);
  });

  it('describes the input a pre-roll offer is about, with its choices', () => {
    // The one part of that proposal a person can change is the input itself, so
    // the input's own shape is what describes it.
    const offer = offerFromTheLog(
      aRun({
        offered: [
          {
            input: 'approach',
            label: 'Go quickly',
            value: 3,
            why: 'the vehicle is built for it',
            answer: 'accepted',
          },
        ],
      }),
    );

    expect(offer.fields).toEqual([
      {
        id: 'approach',
        label: 'Approach',
        kind: 'choice',
        options: [
          { id: 'careful', label: 'Careful', value: 1 },
          { id: 'quick', label: 'Quick', value: 3 },
        ],
      },
    ]);
  });

  it('says nothing is changeable about an input the check never declared', () => {
    // A module's bug, not a reason to refuse. The offer is still a real thing
    // that happened and the log says so.
    const offer = offerFromTheLog(
      aRun({
        offered: [
          { input: 'not-an-input', label: 'Try it', value: 1, why: 'why not', answer: 'accepted' },
        ],
      }),
    );

    expect(offer.fields).toEqual([]);
  });
});

describe('core does not decide', () => {
  it('produces the same drafts for the same run, every time', () => {
    expect(sequenceCheck(aRun())).toEqual(sequenceCheck(aRun()));
  });

  it('never rolls, and never interprets', () => {
    // Both are handed in. If this function could produce a different outcome
    // from the same inputs, a campaign replayed would not agree with itself.
    const run = aRun();
    expect(run.roll).toBe(A_ROLL);
    expect(sequenceCheck(run)[1]?.draft.payload).toBe(A_ROLL);
  });
});
