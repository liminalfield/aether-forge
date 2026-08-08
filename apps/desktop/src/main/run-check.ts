import {
  describeFailure,
  readOffer,
  sequenceCheck,
  SUGGESTION_OFFERED,
  type CheckDefinition,
  type EventId,
  type OfferedInput,
  type OpenCampaign,
  type RollPerformedV1,
  type SequencedDraft,
} from '@aether-forge/core';

import type {
  CheckRunView,
  IpcFailure,
  IpcResult,
  OfferView,
  RolledDieView,
  RunCheckRequest,
} from '../shared/ipc';
import { performRoll } from './roll';
import { LOADED_SYSTEMS, type LoadedSystem } from './systems';

/**
 * Running a check, which is the first of two acts.
 *
 * This writes the invocation, the roll, the resolution, and the module's
 * suggestions as offers nobody has answered. Answering one is a separate
 * request, because a person cannot answer a suggestion they have not seen.
 *
 * Nothing here decides anything. The module says what its check needs, what the
 * dice meant, and what it proposes; this puts the result in order and writes it
 * down. The one thing it will refuse is a die showing a number it does not
 * have, which is a mistyping rather than a rule.
 */

function asIpcFailure(kind: string, detail: string): IpcResult<never> {
  const failure: IpcFailure = { kind, detail };
  return { ok: false, failure };
}

function isNumberRecord(value: unknown): value is Record<string, number> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((each) => typeof each === 'number')
  );
}

/** The request as it arrived, which is whatever another process chose to send. */
function readRequest(request: unknown): RunCheckRequest | undefined {
  if (typeof request !== 'object' || request === null) return undefined;

  const { systemId, checkId, inputs, thrown } = request as Record<string, unknown>;
  if (typeof systemId !== 'string' || typeof checkId !== 'string') return undefined;
  if (!isNumberRecord(inputs)) return undefined;

  if (thrown === undefined) return { systemId, checkId, inputs };
  if (!Array.isArray(thrown) || !thrown.every((die) => typeof die === 'number')) return undefined;

  return { systemId, checkId, inputs, thrown };
}

interface Found {
  readonly system: LoadedSystem;
  readonly check: CheckDefinition;
}

function findCheck(systemId: string, checkId: string): Found | undefined {
  for (const system of LOADED_SYSTEMS) {
    if (system.systemId !== systemId) continue;

    const check = system.checks.find((each) => each.id === checkId);
    if (check !== undefined) return { system, check };
  }

  return undefined;
}

/**
 * The label the check asked this die under.
 *
 * Worked out by walking the request the same way the roll was built, so a die
 * and its label cannot drift apart. The card groups by these, and a system's
 * arrangement is the only thing that produces them.
 */
function labelsFor(roll: RollPerformedV1): readonly (string | undefined)[] {
  return roll.request.dice.flatMap((spec) => Array.from({ length: spec.count }, () => spec.label));
}

function toDiceView(roll: RollPerformedV1 | null): readonly RolledDieView[] {
  if (roll === null) return [];

  const labels = labelsFor(roll);

  return roll.dice.map((die, index) => {
    // A service carries its own identifiers in the log. The window is shown
    // which service it was, and behaves identically whichever it is.
    const from = die.source.kind === 'service' ? die.source.service : die.source.kind;
    const label = labels[index];

    return label === undefined
      ? { sides: die.sides, value: die.value, from }
      : { sides: die.sides, value: die.value, from, label };
  });
}

/**
 * Write the drafts in order, joining each to the one that caused it.
 *
 * Core gives causation by position, because none of the drafts has an
 * identifier until it is written. This is where positions become identifiers,
 * and it is the only place that can do it.
 */
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
      // Part of the check is already in the log. That is a worse state than
      // either extreme and there is no way out of it here: the log is
      // append-only by design, so nothing can be taken back, and a compensating
      // event would need to know what it was compensating for.
      return asIpcFailure(
        appended.failure.kind,
        `the check was only partly recorded, after ${String(index)} of ${String(drafts.length)} events: ${describeFailure(appended.failure)}`,
      );
    }

    written.push(appended.value.id);
  }

  return { ok: true, value: written };
}

/** The offers this run left in the log, in the order it made them. */
function offersFrom(
  drafts: readonly SequencedDraft[],
  written: readonly EventId[],
): readonly OfferView[] {
  const offers: OfferView[] = [];

  for (const [index, sequenced] of drafts.entries()) {
    if (sequenced.draft.type !== SUGGESTION_OFFERED) continue;

    const id = written[index];
    const offer = readOffer(sequenced.draft.payload);
    if (id === undefined || offer === undefined) continue;

    const view: OfferView = { id, label: offer.label, fields: [...offer.fields] };
    offers.push(offer.why === undefined ? view : { ...view, why: offer.why });
  }

  return offers;
}

/**
 * Run one check and record it.
 *
 * Validates what arrived rather than trusting it. This is called with whatever
 * crossed the IPC boundary, and the window is a different process, so "the
 * caller is our own code" is an assumption rather than a fact.
 */
export function runCheck(campaign: OpenCampaign, request: unknown): IpcResult<CheckRunView> {
  const asked = readRequest(request);
  if (asked === undefined) {
    return asIpcFailure(
      'invalid-request',
      'running a check needs a system, a check, and a number for each input',
    );
  }

  const found = findCheck(asked.systemId, asked.checkId);
  if (found === undefined) {
    return asIpcFailure('unknown-check', `${asked.checkId} is not a check this build knows`);
  }

  const { system, check } = found;

  let roll: RollPerformedV1 | null = null;
  if (check.roll !== null) {
    const rolled = performRoll(check.roll, asked.thrown);
    if (!rolled.ok) {
      const failure = rolled.failure;
      const detail =
        failure.kind === 'wrong-number-of-dice'
          ? `this check rolls ${String(failure.asked)} dice and ${String(failure.given)} were given`
          : 'detail' in failure
            ? failure.detail
            : `die ${String(failure.index + 1)} is not a whole number`;

      return asIpcFailure(failure.kind, detail);
    }

    roll = rolled.value;
  }

  // The module says what the dice meant. It is asked once, here, and the answer
  // is written down, so that updating the module never changes a campaign
  // somebody finished last winter.
  const outcome = check.interpret(roll, asked.inputs);

  // What the application suggested for each input, and what the player did
  // about it, worked out by comparing the suggestion against the value the
  // check actually ran with. Recomputed here rather than trusted from the
  // window, because the suggestion is a pure function of campaign state and
  // the log should record what was computed, not what a window claims it saw.
  const offered: OfferedInput[] = [];
  for (const input of check.inputs) {
    const suggested = input.suggest?.(campaign);
    if (suggested === undefined) continue;

    const used = asked.inputs[input.id] ?? 0;
    offered.push({
      input: input.id,
      label: input.label,
      value: suggested.value,
      why: suggested.why,
      answer: used === suggested.value ? 'accepted' : { adjustedTo: used },
    });
  }

  const drafts = sequenceCheck({
    check,
    systemId: system.systemId,
    offered,
    inputs: asked.inputs,
    roll,
    outcome,
    events: system.checkEvents,
  });

  const written = appendAll(campaign, drafts);
  if (!written.ok) return written;

  return {
    ok: true,
    value: {
      checkId: check.id,
      systemId: system.systemId,
      name: check.name,
      outcome: { id: outcome.id, label: outcome.label, summary: outcome.summary },
      dice: toDiceView(roll),
      offers: offersFrom(drafts, written.value),
    },
  };
}
