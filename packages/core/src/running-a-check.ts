/**
 * Turning one check into the events it produces, in order.
 *
 * Core sequences and never decides. It does not choose an input, does not roll,
 * and does not say what the dice meant. It is handed each of those and puts the
 * result in order.
 *
 * Nothing a suggestion proposed is written unless the suggestion was accepted.
 * That is not a rule anybody has to follow: there is no path through this file
 * that appends a proposal without an answer that took it.
 *
 * See `design/checks-and-moves.md`.
 */

import type { CheckDefinition, CheckOutcome } from './check.js';
import type { CoreEventType, ModuleEventType } from './event.js';
import type { RollPerformedV1 } from './roll.js';
import { ROLL_PERFORMED } from './roll.js';
import type { SystemId } from './identifiers.js';
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
  /** What the person did about each of the outcome's suggestions, by suggestion id. */
  readonly answers: Readonly<Record<string, SuggestionAnswer>>;
  /** The event types the module uses either side of the roll. */
  readonly events: { readonly invoked: ModuleEventType; readonly resolved: ModuleEventType };
}

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

function answerType(answer: OfferedInput['answer'] | SuggestionAnswer): CoreEventType {
  if (answer === 'accepted') return SUGGESTION_ACCEPTED;
  if (answer === 'declined') return SUGGESTION_DECLINED;
  if ('adjustedTo' in answer) return SUGGESTION_ADJUSTED;
  if (answer.kind === 'accepted') return SUGGESTION_ACCEPTED;
  if (answer.kind === 'declined') return SUGGESTION_DECLINED;
  return SUGGESTION_ADJUSTED;
}

/**
 * Every event one check produces, in the order it produces them.
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
        proposes: { type: run.events.invoked, payload: { [offer.input]: offer.value } },
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

  // What the module proposed doing about it, and what the person said.
  for (const suggestion of run.outcome.suggests) {
    const answer = run.answers[suggestion.id];
    if (answer === undefined) continue;

    const offered = push(
      {
        type: SUGGESTION_OFFERED,
        payload: {
          suggestion: suggestion.id,
          label: suggestion.label,
          proposes: {
            type: suggestion.proposes.type,
            payload: suggestion.proposes.payload,
          },
        },
      },
      resolved,
    );

    const answered = push(
      {
        type: answerType(answer),
        payload: answer.kind === 'adjusted' ? { used: answer.used } : {},
      },
      offered,
    );

    // The only path that writes a proposal, and it needs an answer that took it.
    if (answer.kind === 'declined') continue;

    const payload =
      answer.kind === 'adjusted'
        ? { ...(suggestion.proposes.payload as Record<string, unknown>), ...answer.used }
        : suggestion.proposes.payload;

    push({ ...suggestion.proposes, payload } as UnversionedEventDraft, answered);
  }

  return drafts;
}
