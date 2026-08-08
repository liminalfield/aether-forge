/**
 * Turning a consultation into the events that record it.
 *
 * Two events, in order: the roll, then the reading of the row it landed on.
 * The second is caused by the first, which is what makes a die typed in by
 * hand and a die the application rolled produce the same pair. By the time
 * anything is resolved, the number is only a number.
 *
 * The consultation does not repeat the number. The roll is its own event and
 * this one points at it, and two records of one fact eventually disagree.
 *
 * This is the same shape as `sequenceCheck` with less in it. A check gathers
 * inputs, asks a module what the dice meant, and may propose effects. A
 * consultation takes a table and reads a row, and there is nothing to decide
 * about the answer.
 *
 * See `design/consulting-an-oracle.md`.
 */

import type { OracleOutcome } from './content.js';
import { ORACLE_CONSULTED, type OracleConsultedV1 } from './oracle.js';
import { ROLL_PERFORMED, type RollPerformedV1 } from './roll.js';
import type { SequencedDraft } from './running-a-check.js';

export interface Consultation {
  /** The dice that were rolled or handed in, exactly as they will be recorded. */
  readonly roll: RollPerformedV1;
  /** What the provider answered with, already resolved. */
  readonly outcome: OracleOutcome;
}

/**
 * The two drafts a consultation writes, in the order they land.
 *
 * Positions rather than identifiers, because nothing here has written
 * anything yet and an identifier does not exist until it does. Whatever
 * appends them turns the position into the identifier of the event it wrote.
 */
export function sequenceConsultation(consultation: Consultation): readonly SequencedDraft[] {
  const { roll, outcome } = consultation;

  const consulted: OracleConsultedV1 = {
    table: outcome.tableId,
    package: outcome.package,
    row: outcome.row,
  };

  return [
    { draft: { type: ROLL_PERFORMED, payload: roll } },
    { draft: { type: ORACLE_CONSULTED, payload: consulted }, causedBy: 0 },
  ];
}
