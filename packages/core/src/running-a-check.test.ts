import { describe, expect, it } from 'vitest';

import type { CheckDefinition } from './check.js';
import { ROLL_PERFORMED, type RollPerformedV1 } from './roll.js';
import { sequenceCheck, type CheckRun } from './running-a-check.js';
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
    answers: {},
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

  it('writes the proposal only when it was accepted', () => {
    expect(typesOf(aRun({ outcome, answers: { [A_PROPOSAL.id]: { kind: 'accepted' } } }))).toEqual([
      INVOKED,
      ROLL_PERFORMED,
      RESOLVED,
      SUGGESTION_OFFERED,
      SUGGESTION_ACCEPTED,
      SPENT,
    ]);
  });

  it('writes nothing beyond the refusal when it was declined', () => {
    // The whole promise, in one assertion. There is no path through this that
    // appends a proposal without an answer that took it.
    expect(typesOf(aRun({ outcome, answers: { [A_PROPOSAL.id]: { kind: 'declined' } } }))).toEqual([
      INVOKED,
      ROLL_PERFORMED,
      RESOLVED,
      SUGGESTION_OFFERED,
      SUGGESTION_DECLINED,
    ]);
  });

  it('writes what the player used when they adjusted it', () => {
    const drafts = sequenceCheck(
      aRun({
        outcome,
        answers: { [A_PROPOSAL.id]: { kind: 'adjusted', used: { by: -2 } } },
      }),
    );

    const written = drafts[drafts.length - 1];
    expect(written?.draft.type).toBe(SPENT);
    expect(written?.draft.payload).toEqual({ by: -2 });
  });

  it('leaves the proposal alone when it was accepted unchanged', () => {
    const drafts = sequenceCheck(
      aRun({ outcome, answers: { [A_PROPOSAL.id]: { kind: 'accepted' } } }),
    );

    expect(drafts[drafts.length - 1]?.draft.payload).toEqual({ by: -1 });
  });

  it('says nothing about a suggestion nobody answered', () => {
    // A suggestion can sit unanswered. Nothing is written until it is.
    expect(typesOf(aRun({ outcome, answers: {} }))).toEqual([INVOKED, ROLL_PERFORMED, RESOLVED]);
  });
});

describe('the whole chain from the design record', () => {
  it('comes out in the order the record sets out', () => {
    const outcome = {
      id: 'weak-hit',
      label: 'Weak hit',
      summary: 'At a cost.',
      suggests: [A_PROPOSAL],
    };

    expect(
      typesOf(
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
          outcome,
          answers: { [A_PROPOSAL.id]: { kind: 'adjusted', used: { by: -2 } } },
        }),
      ),
    ).toEqual([
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
    const outcome = {
      id: 'weak-hit',
      label: 'Weak hit',
      summary: 'At a cost.',
      suggests: [A_PROPOSAL],
    };

    expect(
      sequenceCheck(
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
          outcome,
          answers: { [A_PROPOSAL.id]: { kind: 'adjusted', used: { by: -2 } } },
        }),
      ),
    ).toHaveLength(8);
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
    const offer = offerFromTheLog(
      aRun({ outcome, answers: { [A_PROPOSAL.id]: { kind: 'accepted' } } }),
    );

    expect(offer.fields).toEqual([{ id: 'by', label: 'Amount', kind: 'number' }]);
  });

  it('records which module the proposal belongs to', () => {
    // A module event is required to name its system, so an offer read back on
    // its own could not be turned into one without this.
    const offer = offerFromTheLog(
      aRun({ outcome, answers: { [A_PROPOSAL.id]: { kind: 'accepted' } } }),
    );

    expect(offer.proposes.systemId).toBe('example');
  });

  it('is enough on its own to rebuild what accepting would write', () => {
    const offer = offerFromTheLog(
      aRun({ outcome, answers: { [A_PROPOSAL.id]: { kind: 'accepted' } } }),
    );

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
