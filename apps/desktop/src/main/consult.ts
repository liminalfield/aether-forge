import {
  describeFailure,
  sequenceConsultation,
  type EventId,
  type OpenCampaign,
  type OracleProvider,
  type OracleTable,
  type SequencedDraft,
} from '@aether-forge/core';

import type { ConsultationView, ConsultRequest, IpcFailure, IpcResult } from '../shared/ipc';
import type { RegistryHolder } from './import-package';
import { everyProvider, groupOf } from './oracles';
import { performRoll } from './roll';

/**
 * Consulting an oracle, over the IPC contract.
 *
 * Two acts in one channel, unlike a check, which is two. A check waits for a
 * person to answer what it proposed; a consultation proposes nothing, so
 * there is nothing to wait for.
 *
 * The die is rolled here, or handed in already thrown, and the provider is
 * given a number either way. That seam is the reason a die from somebody's
 * desk works everywhere without a special case.
 *
 * See `design/consulting-an-oracle.md`.
 */

function asIpcFailure(kind: string, detail: string): IpcResult<never> {
  const failure: IpcFailure = { kind, detail };
  return { ok: false, failure };
}

/** Which provider answers this table, and what the table asks for. */
function whoAnswers(
  holder: RegistryHolder,
  tableId: string,
): { provider: OracleProvider; table: OracleTable } | undefined {
  const context = {
    stateOf: () => {
      throw new Error('consulting read campaign state, which nothing here supplies');
    },
  };

  for (const provider of everyProvider(holder)) {
    const table = provider.listTables(context).find((each) => each.id === tableId);
    if (table !== undefined) return { provider, table };
  }
  return undefined;
}

function appendAll(
  campaign: OpenCampaign,
  drafts: readonly SequencedDraft[],
): IpcResult<readonly EventId[]> {
  const written: EventId[] = [];

  for (const [index, sequenced] of drafts.entries()) {
    const cause = sequenced.causedBy === undefined ? undefined : written[sequenced.causedBy];

    const appended = campaign.append({
      ...sequenced.draft,
      ...(cause === undefined ? {} : { causationId: cause }),
    });

    if (!appended.ok) {
      // Half of it is already in the log, which is worse than either extreme
      // and cannot be undone here: the log is append-only by design.
      return asIpcFailure(
        appended.failure.kind,
        `the consultation was only partly recorded, after ${String(index)} of ${String(drafts.length)} events: ${describeFailure(appended.failure)}`,
      );
    }

    written.push(appended.value.id);
  }

  return { ok: true, value: written };
}

export function consultOracle(
  campaign: OpenCampaign,
  holder: RegistryHolder,
  request: unknown,
): IpcResult<ConsultationView> {
  const asked = request as Partial<ConsultRequest> | null | undefined;
  if (typeof asked !== 'object' || asked === null || typeof asked.tableId !== 'string') {
    return asIpcFailure('invalid-request', 'consulting an oracle needs a table');
  }

  const answering = whoAnswers(holder, asked.tableId);
  if (answering === undefined) {
    return asIpcFailure('unknown-table', `${asked.tableId} is not a table this machine holds`);
  }

  const { provider, table } = answering;

  const rolled = performRoll({ dice: [table.dice] }, asked.thrown);
  if (!rolled.ok) {
    const failure = rolled.failure;
    const detail =
      failure.kind === 'wrong-number-of-dice'
        ? `this table rolls ${String(failure.asked)} dice and ${String(failure.given)} were given`
        : 'detail' in failure
          ? failure.detail
          : `die ${String(failure.index + 1)} is not a whole number`;

    return asIpcFailure(failure.kind, detail);
  }

  // The provider is handed a number. It never rolls, which is what keeps a
  // die from somebody's desk identical to one the application rolled.
  const outcome = provider.resolve(asked.tableId, rolled.value, {
    stateOf: () => {
      throw new Error('a provider read campaign state, which nothing here supplies');
    },
  });

  if (!outcome.ok) {
    const detail =
      outcome.failure.kind === 'unknown-table'
        ? `${outcome.failure.tableId} is not a table its own provider holds`
        : `${outcome.failure.tableId} has no row at ${String(outcome.failure.landed)}`;

    return asIpcFailure(outcome.failure.kind, detail);
  }

  const written = appendAll(
    campaign,
    sequenceConsultation({ roll: rolled.value, outcome: outcome.value }),
  );
  if (!written.ok) return written;

  return {
    ok: true,
    value: {
      tableId: asked.tableId,
      name: table.name,
      group: groupOf(table.id),
      answer: outcome.value.row.text,
      row: { from: outcome.value.row.from, to: outcome.value.row.to },
      package: outcome.value.package,
      dice: rolled.value.dice.map((die) => ({
        sides: die.sides,
        value: die.value,
        from: die.source.kind === 'service' ? die.source.service : die.source.kind,
      })),
    },
  };
}
