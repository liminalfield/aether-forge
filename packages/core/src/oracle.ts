/**
 * Consulting an oracle, which is a separate act from rolling the dice.
 *
 * Core owns the `core.oracle.*` family. A roll is a number. Turning that number
 * into a row of a table is this event, and it points back at the roll that fed
 * it through the event's `causationId`.
 *
 * That seam is what makes physical dice work everywhere without a special case.
 * A d100 typed in by hand and a d100 the application rolled produce the same
 * consultation, because by the time anything is resolved the number is just a
 * number.
 *
 * It is also the only place a content package is recorded. A roll of dice rolls
 * against no package; what a package version can change is which row a number
 * lands on, and that happens here.
 *
 * See `design/rolling-dice.md`.
 */

import type { PackageId, SemVer } from './identifiers.js';
import type { EventTypeDefinition } from './schema.js';

export const ORACLE_CONSULTED = 'core.oracle.consulted';

/**
 * Which content package answered, and which version of it.
 *
 * Recorded on the event rather than looked up later, because a player can
 * update a package mid-campaign and the log has to keep explaining itself
 * afterwards.
 */
export interface PackageStamp {
  readonly id: PackageId;
  readonly version: SemVer;
}

/**
 * The row a number landed on.
 *
 * The range is kept as well as the text. Without it, a consultation read back
 * after the package changed says what the answer was but not why that answer,
 * and the reader cannot tell whether the table moved underneath them.
 */
export interface OracleRow {
  readonly from: number;
  readonly to: number;
  readonly text: string;
}

/**
 * Version 1 of an oracle consultation.
 *
 * It does not repeat the number that was rolled. The roll is its own event and
 * this one is caused by it, and two records of one fact eventually disagree.
 */
export interface OracleConsultedV1 {
  /** The table, named the way its package names it. */
  readonly table: string;
  readonly package: PackageStamp;
  readonly row: OracleRow;
}

export const oracleEventTypes: readonly EventTypeDefinition[] = [
  { type: ORACLE_CONSULTED, currentVersion: 1, translations: [], corrections: 'replaces-a-value' },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readStamp(value: unknown): PackageStamp | undefined {
  if (!isRecord(value)) return undefined;

  const id = value['id'];
  const version = value['version'];
  if (typeof id !== 'string' || typeof version !== 'string') return undefined;

  return { id, version };
}

function readRow(value: unknown): OracleRow | undefined {
  if (!isRecord(value)) return undefined;

  const from = value['from'];
  const to = value['to'];
  const text = value['text'];
  if (typeof from !== 'number' || typeof to !== 'number' || typeof text !== 'string') {
    return undefined;
  }

  return { from, to, text };
}

/**
 * Read a consultation off an event payload, or say the shape is not one.
 *
 * Shape only, in the same way and for the same reason as reading a roll: an
 * event recorded years ago is a fact whatever it holds, and refusing to read one
 * would lose a campaign rather than protect it.
 */
export function readOracleConsultation(payload: unknown): OracleConsultedV1 | undefined {
  if (!isRecord(payload)) return undefined;

  const table = payload['table'];
  if (typeof table !== 'string') return undefined;

  const stamp = readStamp(payload['package']);
  if (stamp === undefined) return undefined;

  const row = readRow(payload['row']);
  if (row === undefined) return undefined;

  return { table, package: stamp, row };
}
