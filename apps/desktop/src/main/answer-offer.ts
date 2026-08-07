import {
  answerSuggestion,
  describeFailure,
  suggestions,
  type OpenCampaign,
  type SuggestionAnswer,
  type SuggestionOfferedV2,
  type SuggestionRecord,
} from '@aether-forge/core';

import type {
  AnsweredOfferView,
  AnswerOfferRequest,
  IpcFailure,
  IpcResult,
  OfferAnswer,
} from '../shared/ipc';

/**
 * Answering an offer, which is the second of two acts.
 *
 * Separate from running the check because a person cannot answer a suggestion
 * they have not seen. Between the two the log holds an offer nobody has
 * answered, and that survives closing the application: somebody interrupted
 * mid-decision finds the decision waiting rather than gone.
 *
 * Everything this needs comes from the log. The module that made the offer is
 * not asked anything, and may not even be the module that made it any more.
 *
 * A refusal writes the refusal and nothing else. That is the one promise this
 * file exists to keep.
 */

function asIpcFailure(kind: string, detail: string): IpcResult<never> {
  const failure: IpcFailure = { kind, detail };
  return { ok: false, failure };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readAnswer(value: unknown): OfferAnswer | undefined {
  if (!isRecord(value)) return undefined;

  if (value['kind'] === 'accepted') return { kind: 'accepted' };
  if (value['kind'] === 'declined') return { kind: 'declined' };

  if (value['kind'] === 'adjusted' && isRecord(value['used'])) {
    return { kind: 'adjusted', used: value['used'] };
  }

  return undefined;
}

function readRequest(request: unknown): AnswerOfferRequest | undefined {
  if (!isRecord(request)) return undefined;

  const offerId = request['offerId'];
  if (typeof offerId !== 'string' || offerId.length === 0) return undefined;

  const answer = readAnswer(request['answer']);
  return answer === undefined ? undefined : { offerId, answer };
}

/**
 * The offer as core's own shape, rebuilt from what the projection holds.
 *
 * The projection carries the offer plus the bookkeeping that traces answers
 * back to it. Only the offer itself is any of this function's business.
 */
function asOffer(record: SuggestionRecord): SuggestionOfferedV2 {
  const offer: SuggestionOfferedV2 = {
    suggestion: record.suggestion,
    label: record.label,
    proposes: record.proposes,
    fields: record.fields,
  };

  return record.why === undefined ? offer : { ...offer, why: record.why };
}

/** Core and the window use the same words for these, and both are checked. */
function asAnswer(answer: OfferAnswer): SuggestionAnswer {
  return answer.kind === 'adjusted'
    ? { kind: 'adjusted', used: answer.used }
    : { kind: answer.kind };
}

/**
 * Answer one offer.
 *
 * Validates what arrived rather than trusting it. This is called with whatever
 * crossed the IPC boundary, and the window is a different process.
 */
export function answerOffer(
  campaign: OpenCampaign,
  request: unknown,
): IpcResult<AnsweredOfferView> {
  const asked = readRequest(request);
  if (asked === undefined) {
    return asIpcFailure(
      'invalid-request',
      'answering an offer needs the offer and what was decided: accepted, declined, or adjusted with what was used instead',
    );
  }

  const offered = campaign
    .stateOf(suggestions)
    .offers.find((candidate) => candidate.id === asked.offerId);

  if (offered === undefined) {
    return asIpcFailure('unknown-offer', 'that offer is not in this campaign');
  }

  // Rebuilt from the log alone. If this needed the module, an offer answered
  // next year would depend on that module still declaring the same check the
  // same way.
  const answered = answerSuggestion(asOffer(offered), asAnswer(asked.answer));
  if (!answered.ok) {
    return asIpcFailure(
      answered.failure.kind,
      `this offer cannot be taken: ${answered.failure.type} does not say which module it belongs to`,
    );
  }

  const wrote = campaign.append({
    ...answered.value.answer,
    causationId: asked.offerId,
  });

  if (!wrote.ok) {
    return asIpcFailure(wrote.failure.kind, describeFailure(wrote.failure));
  }

  // The only path that writes what a suggestion proposed, and it is reached
  // only when the answer took it. A refusal leaves `applied` absent and stops
  // one line above.
  let appliedEventId: string | undefined;
  if (answered.value.applied !== undefined) {
    const effect = campaign.append({ ...answered.value.applied, causationId: wrote.value.id });

    if (!effect.ok) {
      // The answer is recorded and what it took is not. Said plainly rather
      // than smoothed over: the log is append-only, so the answer cannot be
      // taken back, and a person needs to know the effect did not land.
      return asIpcFailure(
        effect.failure.kind,
        `the answer was recorded and what it proposed was not: ${describeFailure(effect.failure)}`,
      );
    }

    appliedEventId = effect.value.id;
  }

  const nowStands = campaign
    .stateOf(suggestions)
    .offers.find((candidate) => candidate.id === asked.offerId);

  // Read back from the projection rather than assumed from the answer, so what
  // the window is told is what the campaign actually holds.
  const view: AnsweredOfferView = { offerId: asked.offerId, fate: nowStands?.fate ?? 'offered' };

  return {
    ok: true,
    value: appliedEventId === undefined ? view : { ...view, appliedEventId },
  };
}
