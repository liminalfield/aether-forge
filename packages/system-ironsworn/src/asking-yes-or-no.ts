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

/**
 * Asking a yes-or-no question, with odds.
 *
 * "Is the airlock still powered?" You decide how likely it is, roll a
 * hundred-sided die, and get an answer. There is no table of phrases anywhere:
 * there is a threshold, and if you said the answer was likely then anything up
 * to 75 is yes.
 *
 * Those thresholds are rules. They live in the rulebook and not in the
 * interchange data, which is why this is in the module and not in a content
 * package. Datasworn ships the move that names the five likelihoods in its
 * prose and no numbers to go with them.
 *
 * Built as five ordinary tables so that nothing downstream has to know this
 * kind of asking exists. A yes-or-no answer is recorded by the same event as a
 * table answer, drawn by the same card, and read back by the same reader.
 *
 * See `design/consulting-an-oracle.md`.
 */

/** How likely a person thinks the answer is, and where the line falls. */
const ODDS: readonly { readonly id: string; readonly said: string; readonly yesUpTo: number }[] = [
  { id: 'almost-certain', said: 'Almost certain', yesUpTo: 90 },
  { id: 'likely', said: 'Likely', yesUpTo: 75 },
  { id: 'fifty-fifty', said: 'Fifty fifty', yesUpTo: 50 },
  { id: 'unlikely', said: 'Unlikely', yesUpTo: 25 },
  { id: 'small-chance', said: 'Small chance', yesUpTo: 10 },
];

/** Where this provider's tables live, so nothing collides with a package's. */
export const YES_OR_NO_PREFIX = 'ironsworn-starforged/ask/';

function asTable(odds: (typeof ODDS)[number]): OracleTable {
  return {
    id: `${YES_OR_NO_PREFIX}${odds.id}`,
    name: odds.said,
    dice: { sides: 100, count: 1 },
    rows: [
      { from: 1, to: odds.yesUpTo, text: 'Yes' },
      { from: odds.yesUpTo + 1, to: 100, text: 'No' },
    ],
  };
}

/** The five, as tables. */
export const YES_OR_NO_TABLES: readonly OracleTable[] = ODDS.map(asTable);

/**
 * The version this provider stamps its answers with.
 *
 * A stamp is how a campaign explains itself after content changes underneath
 * it, and these odds can change: a module that revised a threshold would make
 * every old answer unexplainable without one. It names the module rather than
 * a package because that is what it came from.
 */
export const YES_OR_NO_STAMP = { id: 'ironsworn-starforged.ask', version: '1.0.0' } as const;

export const yesOrNo: OracleProvider = {
  id: 'ironsworn-starforged-ask',

  listTables: () => YES_OR_NO_TABLES,

  resolve: (tableId: string, roll: RollPerformedV1) => {
    const table = YES_OR_NO_TABLES.find((each) => each.id === tableId);
    if (table === undefined) {
      return failed<OracleFailure>({ kind: 'unknown-table', tableId });
    }

    const landed = roll.dice.reduce((total, die) => total + die.value, 0);
    const row = rowFor(table, landed);
    if (row === undefined) {
      // The two rows cover 1 to 100 between them, so this is a die outside the
      // range asked for. Refused rather than rounded into an answer.
      return failed<OracleFailure>({ kind: 'no-row-at', tableId, landed });
    }

    return ok<OracleOutcome>({ row, tableId, package: YES_OR_NO_STAMP });
  },
};
