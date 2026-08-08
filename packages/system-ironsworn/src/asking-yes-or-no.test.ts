import { readOracleTable, type ProjectionContext, type RollPerformedV1 } from '@aether-forge/core';
import { describe, expect, it } from 'vitest';

import { YES_OR_NO_PREFIX, YES_OR_NO_TABLES, yesOrNo } from './asking-yes-or-no.js';

/**
 * This provider answers from rules it holds, not from the campaign, and a
 * context that throws proves it.
 */
const NO_CONTEXT: ProjectionContext = {
  stateOf: () => {
    throw new Error('the yes-or-no oracle read campaign state it does not need');
  },
};

function aD100Showing(value: number): RollPerformedV1 {
  return {
    request: { dice: [{ sides: 100, count: 1 }] },
    dice: [{ sides: 100, value, source: { kind: 'manual' } }],
  };
}

function answerAt(odds: string, showing: number): string {
  const outcome = yesOrNo.resolve(`${YES_OR_NO_PREFIX}${odds}`, aD100Showing(showing), NO_CONTEXT);
  if (!outcome.ok) throw new Error(outcome.failure.kind);
  return outcome.value.row.text;
}

describe('the five ways of asking', () => {
  it('offers all five', () => {
    expect(YES_OR_NO_TABLES.map((table) => table.name)).toEqual([
      'Almost certain',
      'Likely',
      'Fifty fifty',
      'Unlikely',
      'Small chance',
    ]);
  });

  it('is a table like any other, so core can read it', () => {
    // The point of building them as tables: nothing downstream has to know
    // this kind of asking exists.
    for (const table of YES_OR_NO_TABLES) {
      expect(readOracleTable(table), table.id).toBeDefined();
    }
  });

  it('covers every number a hundred-sided die can show, with no gap and no overlap', () => {
    for (const table of YES_OR_NO_TABLES) {
      const covered = table.rows.flatMap((row) =>
        Array.from({ length: row.to - row.from + 1 }, (_unused, at) => row.from + at),
      );
      expect(new Set(covered).size, table.id).toBe(100);
      expect(covered.length, table.id).toBe(100);
    }
  });
});

describe('where each line falls', () => {
  it.each([
    ['almost-certain', 90],
    ['likely', 75],
    ['fifty-fifty', 50],
    ['unlikely', 25],
    ['small-chance', 10],
  ])('%s says yes up to %i and no above it', (odds, line) => {
    expect(answerAt(odds, line)).toBe('Yes');
    expect(answerAt(odds, line + 1)).toBe('No');
  });

  it('says yes to the lowest number a die can show, whatever the odds', () => {
    for (const table of YES_OR_NO_TABLES) {
      const odds = table.id.slice(YES_OR_NO_PREFIX.length);
      expect(answerAt(odds, 1), odds).toBe('Yes');
    }
  });

  it('says no to the highest, whatever the odds', () => {
    for (const table of YES_OR_NO_TABLES) {
      const odds = table.id.slice(YES_OR_NO_PREFIX.length);
      expect(answerAt(odds, 100), odds).toBe('No');
    }
  });
});

describe('what it stamps an answer with', () => {
  it('names where the odds came from, so an old answer stays explainable', () => {
    // These thresholds are rules and rules can be revised. An answer with no
    // stamp would be unexplainable after one was.
    const outcome = yesOrNo.resolve(`${YES_OR_NO_PREFIX}likely`, aD100Showing(40), NO_CONTEXT);

    expect(outcome.ok && outcome.value.package).toEqual({
      id: 'ironsworn-starforged.ask',
      version: '1.0.0',
    });
  });
});

describe('what it refuses', () => {
  it('refuses a table it does not have, rather than guessing', () => {
    const outcome = yesOrNo.resolve('someone-elses/table', aD100Showing(40), NO_CONTEXT);

    expect(!outcome.ok && outcome.failure.kind).toBe('unknown-table');
  });

  it('refuses a die outside the range asked for, rather than rounding it into an answer', () => {
    const outcome = yesOrNo.resolve(`${YES_OR_NO_PREFIX}likely`, aD100Showing(0), NO_CONTEXT);

    expect(!outcome.ok && outcome.failure.kind).toBe('no-row-at');
  });
});
