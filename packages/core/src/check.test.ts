import { describe, expect, it } from 'vitest';

import { describesEveryField, type CheckDefinition, type EffectSuggestion } from './check.js';
import type { RollPerformedV1 } from './roll.js';

/**
 * The simplest check anything could declare: a coin, two outcomes, nothing
 * proposed afterwards.
 *
 * Written here rather than in the toy module, because what is being checked is
 * that the shapes can be satisfied at all. The toy declaring one for real is
 * its own step.
 */
const A_COIN: CheckDefinition = {
  id: 'example.dummy/flip',
  name: 'Flip it',
  roll: { dice: [{ sides: 2, count: 1, label: 'coin' }] },
  inputs: [],
  interpret: (roll) => {
    const showed = roll?.dice[0]?.value;
    return showed === 1
      ? { id: 'heads', label: 'Heads', summary: 'It came up heads.', suggests: [] }
      : { id: 'tails', label: 'Tails', summary: 'It came up tails.', suggests: [] };
  },
};

function aRoll(value: number): RollPerformedV1 {
  return {
    request: { dice: [{ sides: 2, count: 1, label: 'coin' }] },
    dice: [{ sides: 2, value, source: { kind: 'digital' } }],
  };
}

describe('the simplest check anything could declare', () => {
  it('needs no inputs and proposes nothing', () => {
    expect(A_COIN.inputs).toEqual([]);
    expect(A_COIN.interpret(aRoll(1), {}).suggests).toEqual([]);
  });

  it('says what the dice meant', () => {
    expect(A_COIN.interpret(aRoll(1), {}).id).toBe('heads');
    expect(A_COIN.interpret(aRoll(2), {}).id).toBe('tails');
  });

  it('gives the same answer for the same roll, every time', () => {
    // Interpretation is recorded rather than worked out again while reading, so
    // a check that answered differently on two runs would put a campaign in a
    // state nobody could explain.
    expect(A_COIN.interpret(aRoll(1), {})).toEqual(A_COIN.interpret(aRoll(1), {}));
  });
});

describe('a check with no dice', () => {
  it('runs on its inputs alone', () => {
    const takingStock: CheckDefinition = {
      id: 'example.dummy/take-stock',
      name: 'Take stock',
      roll: null,
      inputs: [{ id: 'supplies', label: 'Supplies', kind: 'number', source: 'read' }],
      interpret: (_roll, inputs) => ({
        id: (inputs['supplies'] ?? 0) > 3 ? 'comfortable' : 'thin',
        label: 'Where you stand',
        summary: 'You take stock.',
        suggests: [],
      }),
    };

    expect(takingStock.roll).toBeNull();
    expect(takingStock.interpret(null, { supplies: 5 }).id).toBe('comfortable');
    expect(takingStock.interpret(null, { supplies: 1 }).id).toBe('thin');
  });
});

describe('where an input got its first value', () => {
  it('separates what a player picked from what was read off the campaign', () => {
    // Both are editable. The distinction exists so that a resolved check can
    // record what it was reading without a second mechanism for it.
    const check: CheckDefinition = {
      id: 'example.dummy/progress',
      name: 'Make progress',
      roll: { dice: [{ sides: 10, count: 2 }] },
      inputs: [
        { id: 'filled', label: 'Boxes filled', kind: 'number', source: 'read' },
        {
          id: 'approach',
          label: 'Approach',
          kind: 'choice',
          source: 'chosen',
          options: [
            { id: 'careful', label: 'Careful', value: 1 },
            { id: 'quick', label: 'Quick', value: 2 },
          ],
        },
      ],
      interpret: () => ({ id: 'done', label: 'Done', summary: '', suggests: [] }),
    };

    expect(check.inputs.map((input) => input.source)).toEqual(['read', 'chosen']);
  });
});

describe('a proposal describes every field it carries', () => {
  const proposal = (fields: EffectSuggestion['fields'], payload: unknown): EffectSuggestion => ({
    id: 'example.dummy/pay',
    label: 'Pay the price',
    fields,
    proposes: { type: 'sys.example.price.paid', systemId: 'example', payload },
  });

  it('accepts one that describes all of them', () => {
    const suggestion = proposal(
      [
        { id: 'amount', label: 'Amount', kind: 'number' },
        { id: 'reason', label: 'Reason', kind: 'text' },
      ],
      { amount: -1, reason: 'a hard landing' },
    );

    expect(describesEveryField(suggestion)).toBe(true);
  });

  it('refuses one that leaves a field out', () => {
    // A proposal that describes some of its payload is adjustable in parts. A
    // player pressing adjust would be guessing at which parts.
    const suggestion = proposal([{ id: 'amount', label: 'Amount', kind: 'number' }], {
      amount: -1,
      reason: 'a hard landing',
    });

    expect(describesEveryField(suggestion)).toBe(false);
  });

  it('accepts an empty description of an empty payload', () => {
    expect(describesEveryField(proposal([], {}))).toBe(true);
  });

  it('accepts a payload that is not an object', () => {
    // Nothing to describe, so nothing is missing.
    expect(describesEveryField(proposal([], 'a bare string'))).toBe(true);
  });

  it('does not mind a field described that the payload does not carry', () => {
    // The rule is that nothing is undescribed. A description of something
    // absent is untidy rather than dangerous, and refusing it would stop a
    // module describing a field it sets conditionally.
    expect(
      describesEveryField(proposal([{ id: 'spare', label: 'Spare', kind: 'number' }], {})),
    ).toBe(true);
  });
});

describe('what a suggestion proposes', () => {
  it('is one thing, so that two effects can be refused separately', () => {
    // A suggestion carrying several events would have to be accepted or refused
    // whole, and a player who wanted one of them would have to take all three.
    const suggestion: EffectSuggestion = {
      id: 'example.dummy/one',
      label: 'One thing',
      fields: [],
      proposes: { type: 'sys.example.thing.happened', systemId: 'example', payload: {} },
    };

    expect(Array.isArray(suggestion.proposes)).toBe(false);
  });

  it('is a draft, without the fields core assigns when it writes', () => {
    const suggestion: EffectSuggestion = {
      id: 'example.dummy/one',
      label: 'One thing',
      fields: [],
      proposes: { type: 'sys.example.thing.happened', systemId: 'example', payload: {} },
    };

    for (const assigned of ['id', 'seq', 'at', 'campaignId', 'schemaVersion']) {
      expect(suggestion.proposes, assigned).not.toHaveProperty(assigned);
    }
  });
});
