import { describe, expect, it } from 'vitest';

import { sequenceConsultation } from './consulting-an-oracle.js';
import type { OracleOutcome } from './content.js';
import { ORACLE_CONSULTED, readOracleConsultation } from './oracle.js';
import { ROLL_PERFORMED, readRoll, type RollPerformedV1 } from './roll.js';

/** Obviously-dummy content. Nothing here comes from a published table. */
const AN_ANSWER: OracleOutcome = {
  row: { from: 41, to: 60, text: 'Someone has been here more recently than the dust suggests.' },
  tableId: 'example.dummy-tables/what-the-silence-holds',
  package: { id: 'example.dummy-tables', version: '0.4.1' },
};

function aD100Showing(value: number, from: 'manual' | 'digital'): RollPerformedV1 {
  return {
    request: { dice: [{ sides: 100, count: 1 }] },
    dice: [{ sides: 100, value, source: { kind: from } }],
  };
}

describe('sequencing a consultation', () => {
  it('writes the roll, then the reading of it', () => {
    const sequenced = sequenceConsultation({
      roll: aD100Showing(47, 'manual'),
      outcome: AN_ANSWER,
    });

    expect(sequenced.map((each) => each.draft.type)).toEqual([ROLL_PERFORMED, ORACLE_CONSULTED]);
  });

  it('says the reading was caused by the roll, by position', () => {
    // Nothing has been written yet, so nothing has an identifier. Whatever
    // appends these turns the position into the identifier it wrote.
    const sequenced = sequenceConsultation({
      roll: aD100Showing(47, 'manual'),
      outcome: AN_ANSWER,
    });

    expect(sequenced[0]?.causedBy).toBeUndefined();
    expect(sequenced[1]?.causedBy).toBe(0);
  });

  it('records the table, the row and the package the answer came from', () => {
    const [, reading] = sequenceConsultation({
      roll: aD100Showing(47, 'manual'),
      outcome: AN_ANSWER,
    });

    expect(readOracleConsultation(reading?.draft.payload)).toEqual({
      table: 'example.dummy-tables/what-the-silence-holds',
      package: { id: 'example.dummy-tables', version: '0.4.1' },
      row: AN_ANSWER.row,
    });
  });

  it('does not repeat the number that was rolled', () => {
    // The roll is its own event and this one points at it. Two records of one
    // fact eventually disagree.
    const [, reading] = sequenceConsultation({
      roll: aD100Showing(47, 'manual'),
      outcome: AN_ANSWER,
    });

    expect(JSON.stringify(reading?.draft.payload)).not.toContain('47');
  });

  it('writes the dice exactly as they were handed in, provenance and all', () => {
    const [rolled] = sequenceConsultation({
      roll: aD100Showing(47, 'manual'),
      outcome: AN_ANSWER,
    });

    expect(readRoll(rolled?.draft.payload)?.dice).toEqual([
      { sides: 100, value: 47, source: { kind: 'manual' } },
    ]);
  });

  it('produces the same pair whether the die was thrown or rolled', () => {
    // The seam the whole design rests on: by the time anything is resolved,
    // the number is only a number.
    const thrown = sequenceConsultation({ roll: aD100Showing(47, 'manual'), outcome: AN_ANSWER });
    const rolled = sequenceConsultation({ roll: aD100Showing(47, 'digital'), outcome: AN_ANSWER });

    expect(thrown[1]).toEqual(rolled[1]);
    expect(thrown.map((each) => each.draft.type)).toEqual(rolled.map((each) => each.draft.type));
  });

  it('carries the followUps a provider offered nowhere, because the event has no room for them', () => {
    // Deliberate. Follow-up tables are excluded from this record, and the
    // event was not designed to hold them. A provider may answer with them
    // and a surface may use them; nothing is recorded.
    const [, reading] = sequenceConsultation({
      roll: aD100Showing(47, 'manual'),
      outcome: { ...AN_ANSWER, followUps: ['example.dummy-tables/what-happens-next'] },
    });

    expect(JSON.stringify(reading?.draft.payload)).not.toContain('what-happens-next');
  });
});
