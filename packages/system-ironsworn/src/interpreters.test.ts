import type { RollPerformedV1 } from '@aether-forge/core';
import { describe, expect, it } from 'vitest';

import { FACE_DANGER } from './index.js';
import { interpretActionRoll, interpretNoRoll, interpretProgressRoll } from './interpreters.js';

function anActionRoll(action: number, first: number, second: number): RollPerformedV1 {
  return {
    request: {
      dice: [
        { sides: 6, count: 1, label: 'action' },
        { sides: 10, count: 2, label: 'challenge' },
      ],
    },
    dice: [
      { sides: 6, value: action, source: { kind: 'manual' } },
      { sides: 10, value: first, source: { kind: 'manual' } },
      { sides: 10, value: second, source: { kind: 'manual' } },
    ],
  };
}

function aProgressRoll(first: number, second: number): RollPerformedV1 {
  return {
    request: { dice: [{ sides: 10, count: 2, label: 'challenge' }] },
    dice: [
      { sides: 10, value: first, source: { kind: 'manual' } },
      { sides: 10, value: second, source: { kind: 'manual' } },
    ],
  };
}

describe('the action roll interpreter', () => {
  it.each([
    ['beats both', 6, 3, 4, 2, 'strong-hit'],
    ['beats one', 4, 2, 9, 2, 'weak-hit'],
    ['beats neither', 1, 5, 8, 1, 'miss'],
    ['a tie does not beat a challenge die', 4, 6, 9, 2, 'miss'],
  ])('%s', (_name, action, first, second, stat, expected) => {
    const outcome = interpretActionRoll(anActionRoll(action, first, second), { stat, bonus: 0 });
    expect(outcome.id).toBe(expected);
  });

  it('reads a roll that is not an action roll as unreadable, not as a miss', () => {
    expect(interpretActionRoll(null, {})).toEqual(expect.objectContaining({ id: 'unreadable' }));
    expect(interpretActionRoll(aProgressRoll(2, 9), {}).id).toBe('unreadable');
  });

  it('agrees with the hand-written Face Danger on every outcome, which is the parity that lets it retire', () => {
    // Face Danger's momentum proposals become the hook; the interpreter with
    // that hook must be indistinguishable from the declaration it replaces.
    const cases: readonly [number, number, number][] = [
      [6, 1, 2],
      [4, 2, 9],
      [1, 8, 9],
      [3, 3, 9],
      [5, 5, 5],
    ];

    for (const [action, first, second] of cases) {
      const roll = anActionRoll(action, first, second);
      const inputs = { stat: 2, bonus: 1 };
      const handWritten = FACE_DANGER.interpret(roll, inputs);
      const joined = interpretActionRoll(roll, inputs, () => []);

      expect(joined.id).toBe(handWritten.id);
      expect(joined.label).toBe(handWritten.label);
      expect(joined.summary).toBe(handWritten.summary);
    }

    expect(FACE_DANGER.interpret(null, {}).id).toBe(interpretActionRoll(null, {}).id);
  });
});

describe('the progress roll interpreter', () => {
  it('scores the track against the challenge, with no action die and no adds', () => {
    expect(interpretProgressRoll(aProgressRoll(3, 4), { progress: 8 }).id).toBe('strong-hit');
    expect(interpretProgressRoll(aProgressRoll(3, 9), { progress: 8 }).id).toBe('weak-hit');
    expect(interpretProgressRoll(aProgressRoll(8, 9), { progress: 2 }).id).toBe('miss');
  });

  it('reads an action roll handed to it as unreadable', () => {
    expect(interpretProgressRoll(anActionRoll(4, 2, 9), { progress: 8 }).id).toBe('unreadable');
  });
});

describe('the no-roll interpreter', () => {
  it('resolves as written, proposing nothing', () => {
    expect(interpretNoRoll()).toEqual({
      id: 'resolved',
      label: 'As written',
      summary: 'It happens as the move says.',
      suggests: [],
    });
  });
});
