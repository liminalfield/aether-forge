import {
  failed,
  ok,
  rowFor,
  type OracleFailure,
  type OracleOutcome,
  type OracleProvider,
  type OracleTable,
  type RollPerformedV1,
} from '@aether-forge/core';

import type { RegistryHolder } from './import-package';

/**
 * The first oracle provider: it answers from the packages this machine
 * holds. It never rolls; a number is handed in, having come from the dice
 * machinery, typed in or rolled, which is what makes a d100 from the table
 * and a d100 from the application identical here.
 *
 * A table the machine does not hold is a failure value, not a guess: a
 * campaign can reference packages this machine has never seen, and honesty
 * about that is the design. What was consulted in the past needs no
 * provider at all, because every consultation recorded its row.
 */

/** What a roll landed on: its dice added together, which for one die is the die. */
function landedBy(roll: RollPerformedV1): number {
  return roll.dice.reduce((total, die) => total + die.value, 0);
}

export function createPackagesProvider(holder: RegistryHolder): OracleProvider {
  const find = (
    tableId: string,
  ): { table: OracleTable; packageId: string; version: string } | undefined => {
    for (const box of holder.current.packages) {
      const table = box.tables.find((each) => each.id === tableId);
      if (table !== undefined) {
        return { table, packageId: box.manifest.id, version: box.manifest.version };
      }
    }
    return undefined;
  };

  return {
    id: 'installed-packages',

    listTables: () => holder.current.packages.flatMap((box) => box.tables),

    resolve: (tableId, roll) => {
      const found = find(tableId);
      if (found === undefined) {
        return failed<OracleFailure>({ kind: 'unknown-table', tableId });
      }

      const landed = landedBy(roll);
      const row = rowFor(found.table, landed);
      if (row === undefined) {
        // The table skips this number. Content is recorded as its publisher
        // wrote it, and a gap answers nothing rather than the nearest thing.
        return failed<OracleFailure>({ kind: 'no-row-at', tableId, landed });
      }

      return ok<OracleOutcome>({
        row,
        tableId,
        package: { id: found.packageId, version: found.version },
      });
    },
  };
}
