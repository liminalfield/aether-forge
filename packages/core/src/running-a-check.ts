/**
 * Turning one check into the events it produces, in order.
 *
 * Core sequences and never decides. It does not choose an input, does not roll,
 * and does not say what the dice meant. It is handed each of those and puts the
 * result in order.
 *
 * Running a check is two acts, and this file has one function for each.
 * `sequenceCheck` runs the check and leaves its suggestions on the table.
 * `answerSuggestion` takes one of them and what a person decided about it.
 *
 * They are separate because a person cannot answer a suggestion they have not
 * seen. One function taking the answers up front would mean deciding for them,
 * and between the two acts the log holds an offer nobody has answered, which is
 * a real state that outlives the session it was made in.
 *
 * Nothing a suggestion proposed is written unless the suggestion was accepted.
 * That is not a rule anybody has to follow: there is no path through this file
 * that appends a proposal without an answer that took it.
 *
 * See `design/checks-and-moves.md` and `design/the-verdict-card.md`.
 */

import type { CheckDefinition, CheckOutcome, ProposalField } from './check.js';
import type { CoreEventType, ModuleEventType } from './event.js';
import { isCoreEventType, isModuleEventType } from './event.js';
import type { RollPerformedV1 } from './roll.js';
import { ROLL_PERFORMED } from './roll.js';
import type { SystemId } from './identifiers.js';
import { failed, ok, type Result } from './result.js';
import type { OfferedProposal, SuggestionOfferedV2 } from './suggestion.js';
import {
  SUGGESTION_ACCEPTED,
  SUGGESTION_ADJUSTED,
  SUGGESTION_DECLINED,
  SUGGESTION_OFFERED,
} from './suggestion.js';
import type { UnversionedEventDraft } from './translating-log.js';

/** What the application put in front of a person before the check ran. */
export interface OfferedInput {
  readonly input: string;
  readonly label: string;
  readonly value: number;
  readonly why: string;
  /** What the player did about it. */
  readonly answer: 'accepted' | 'declined' | { readonly adjustedTo: number };
}

/** What a person did about one of the outcome's proposals. */
export type SuggestionAnswer =
  | { readonly kind: 'accepted' }
  | { readonly kind: 'declined' }
  | { readonly kind: 'adjusted'; readonly used: Readonly<Record<string, unknown>> };

export interface CheckRun {
  readonly check: CheckDefinition;
  readonly systemId: SystemId;
  /** What the application offered before the roll, and what came of each. */
  readonly offered: readonly OfferedInput[];
  /** The inputs the check actually ran with, after any of that. */
  readonly inputs: Readonly<Record<string, number>>;
  /** Absent for a check with no dice. */
  readonly roll: RollPerformedV1 | null;
  readonly outcome: CheckOutcome;
  /** The event types the module uses either side of the roll. */
  readonly events: { readonly invoked: ModuleEventType; readonly resolved: ModuleEventType };
}

/**
 * What answering one offer writes.
 *
 * Two drafts rather than a list, because they are not interchangeable. The
 * answer is caused by the offer it answers, which is already in the log and is
 * not the caller's to guess at. What the answer took is caused by the answer.
 *
 * `applied` is absent when the answer refused, and that absence is the only
 * thing keeping a refusal from having an effect.
 */
export interface AnsweredSuggestion {
  readonly answer: UnversionedEventDraft;
  readonly applied?: UnversionedEventDraft;
}

/**
 * An offer that cannot be turned back into an event.
 *
 * `proposal-has-no-system` is reachable for an offer written at version 1,
 * which did not record which module its proposal belonged to. A module event
 * has to name its system, and inventing one here would put an event in the log
 * under a module that never proposed it.
 *
 * `proposal-is-not-an-event-type` means the recorded type is in neither
 * namespace. Nothing this codebase writes produces one, so reaching it means
 * the log has been edited or damaged. Saying so beats writing an event whose
 * type nothing will ever recognise.
 */
export type ProposalCannotBeWritten =
  | { readonly kind: 'proposal-has-no-system'; readonly type: string }
  | { readonly kind: 'proposal-is-not-an-event-type'; readonly type: string };

/**
 * One draft, and which earlier draft in the same run caused it.
 *
 * Causation is given by position rather than by identifier, because none of
 * these has an identifier yet. Whatever writes them fills that in as it goes.
 */
export interface SequencedDraft {
  readonly draft: UnversionedEventDraft;
  /** Index into the same list. Absent for the first event of a chain. */
  readonly causedBy?: number;
}

/**
 * What accepting a proposal would write, as the offer records it.
 *
 * Narrower than the draft the module supplied. A draft can also carry causation
 * and supersession, and those belong to whatever writes the event rather than
 * to the module that proposed it.
 */
function proposalOf(draft: UnversionedEventDraft): OfferedProposal {
  const systemId = 'systemId' in draft ? draft.systemId : undefined;

  return systemId === undefined
    ? { type: draft.type, payload: draft.payload }
    : { type: draft.type, systemId, payload: draft.payload };
}

/**
 * The one input a pre-roll offer is about, described as something changeable.
 *
 * An empty list when the check does not declare that input. Nothing here can
 * refuse the offer over it: a check that suggests a value for an input it never
 * declared is a module's bug, and the offer is still a real thing that happened.
 */
function describeInput(check: CheckDefinition, inputId: string): readonly ProposalField[] {
  const input = check.inputs.find((each) => each.id === inputId);
  if (input === undefined) return [];

  const field = { id: input.id, label: input.label, kind: input.kind };

  return [input.options === undefined ? field : { ...field, options: input.options }];
}

function answerType(answer: OfferedInput['answer'] | SuggestionAnswer): CoreEventType {
  if (answer === 'accepted') return SUGGESTION_ACCEPTED;
  if (answer === 'declined') return SUGGESTION_DECLINED;
  if ('adjustedTo' in answer) return SUGGESTION_ADJUSTED;
  if (answer.kind === 'accepted') return SUGGESTION_ACCEPTED;
  if (answer.kind === 'declined') return SUGGESTION_DECLINED;
  return SUGGESTION_ADJUSTED;
}

/**
 * The first act: every event running a check produces, in order.
 *
 * It ends with the outcome's suggestions offered and unanswered, because at
 * this point nobody has seen them. Answering one is `answerSuggestion`, and it
 * can happen a second later or in a session next year.
 *
 * Returned rather than written. Core works out the order; the application, which
 * is the only thing that can reach a log, does the writing.
 */
export function sequenceCheck(run: CheckRun): readonly SequencedDraft[] {
  const drafts: SequencedDraft[] = [];
  const push = (draft: UnversionedEventDraft, causedBy?: number): number => {
    drafts.push(causedBy === undefined ? { draft } : { draft, causedBy });
    return drafts.length - 1;
  };

  // What the application put forward before the check ran, and what came of it.
  for (const offer of run.offered) {
    const offered = push({
      type: SUGGESTION_OFFERED,
      payload: {
        suggestion: `${run.check.id}#${offer.input}`,
        label: offer.label,
        why: offer.why,
        proposes: {
          type: run.events.invoked,
          systemId: run.systemId,
          payload: { [offer.input]: offer.value },
        },
        // The one part of this proposal a person can change is the input it is
        // about, so the input's own shape is what describes it.
        fields: describeInput(run.check, offer.input),
      },
    });

    const adjusted = typeof offer.answer === 'object' ? offer.answer.adjustedTo : undefined;
    push(
      {
        type: answerType(offer.answer),
        payload: adjusted === undefined ? {} : { used: { [offer.input]: adjusted } },
      },
      offered,
    );
  }

  const lastAnswer = drafts.length === 0 ? undefined : drafts.length - 1;

  const invoked = push(
    {
      type: run.events.invoked,
      systemId: run.systemId,
      payload: { check: run.check.id, inputs: run.inputs },
    },
    lastAnswer,
  );

  const rolled =
    run.roll === null ? undefined : push({ type: ROLL_PERFORMED, payload: run.roll }, invoked);

  const resolved = push(
    {
      type: run.events.resolved,
      systemId: run.systemId,
      payload: {
        check: run.check.id,
        outcome: run.outcome.id,
        summary: run.outcome.summary,
        inputs: run.inputs,
      },
    },
    rolled ?? invoked,
  );

  // What the module proposed doing about it. Offered and left there: the person
  // has not seen any of this yet, so there is nothing they could have said.
  for (const suggestion of run.outcome.suggests) {
    push(
      {
        type: SUGGESTION_OFFERED,
        payload: {
          suggestion: suggestion.id,
          label: suggestion.label,
          proposes: proposalOf(suggestion.proposes),
          // Recorded rather than worked out again later. An offer can be
          // answered in a much later session, and the log is all there is then.
          fields: suggestion.fields,
        },
      },
      resolved,
    );
  }

  return drafts;
}

/**
 * What accepting an offer would write, rebuilt from the offer alone.
 *
 * The offer is the only thing available. It may have been read back out of a
 * log written months ago by a build that is no longer installed, so nothing
 * here asks the module anything.
 */
function draftFrom(
  proposal: OfferedProposal,
  payload: unknown,
): Result<UnversionedEventDraft, ProposalCannotBeWritten> {
  if (isModuleEventType(proposal.type)) {
    const systemId = proposal.systemId;

    // A module event without a system cannot be written at all. This is what a
    // version 1 offer of one reads back as, and guessing the system out of the
    // type would put an event in the log under a module that never proposed it.
    return systemId === undefined
      ? failed({ kind: 'proposal-has-no-system', type: proposal.type })
      : ok({ type: proposal.type, systemId, payload });
  }

  // A core event may not carry a system, so one recorded against a core type is
  // dropped rather than refused. The offer is still perfectly answerable.
  if (isCoreEventType(proposal.type)) return ok({ type: proposal.type, payload });

  return failed({ kind: 'proposal-is-not-an-event-type', type: proposal.type });
}

/**
 * Merge what a person used into what was proposed, field by field.
 *
 * A payload that is not an object describes no fields, so a module cannot have
 * offered anything about it to adjust. What the person asked for is used, rather
 * than silently keeping the proposal they were changing.
 */
function withAdjustments(proposed: unknown, used: Readonly<Record<string, unknown>>): unknown {
  return typeof proposed === 'object' && proposed !== null && !Array.isArray(proposed)
    ? { ...proposed, ...used }
    : used;
}

/**
 * The second act: one offer, and what a person decided about it.
 *
 * Takes the offer as the log holds it rather than the suggestion the module
 * made, because by now the module may not be the one that made it. Everything
 * needed is recorded in the offer, which is why it records it.
 *
 * The answer is caused by the offer. What the answer took is caused by the
 * answer. Neither is written here: core works out what follows and the
 * application does the writing.
 *
 * A refusal produces an answer and nothing else, and that is the only place in
 * the codebase where a proposal could have been written without one.
 */
export function answerSuggestion(
  offer: SuggestionOfferedV2,
  answer: SuggestionAnswer,
): Result<AnsweredSuggestion, ProposalCannotBeWritten> {
  const answered: UnversionedEventDraft = {
    type: answerType(answer),
    payload: answer.kind === 'adjusted' ? { used: answer.used } : {},
  };

  if (answer.kind === 'declined') return ok({ answer: answered });

  const payload =
    answer.kind === 'adjusted'
      ? withAdjustments(offer.proposes.payload, answer.used)
      : offer.proposes.payload;

  const applied = draftFrom(offer.proposes, payload);
  if (!applied.ok) return applied;

  return ok({ answer: answered, applied: applied.value });
}
