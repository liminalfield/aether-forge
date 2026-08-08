import type { ContentPackage, RollPerformedV1 } from '@aether-forge/core';
import { describe, expect, it } from 'vitest';

import { checksFrom, STARFORGED_SYSTEM_ID } from './index.js';
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

  it('is what a content-built check answers with, exactly', () => {
    // The hand-written Face Danger retired against this parity: a check
    // built from content facts is the interpreter and nothing else, so the
    // two can never drift apart again.
    const fixture: ContentPackage = {
      manifest: {
        id: 'example.fixture',
        version: '1.0.0',
        title: 'Fixture',
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
        moves: [{ id: 'example/doing/try_it', name: 'Try It', kind: 'action', stats: ['edge'] }],
      },
    };
    const [built] = checksFrom([fixture]);
    if (built === undefined) throw new Error('the fixture built no check');

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
      expect(built.interpret(roll, inputs)).toEqual(interpretActionRoll(roll, inputs));
    }
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
