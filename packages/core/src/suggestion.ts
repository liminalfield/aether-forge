/**
 * What the application proposed, and what the player did about it.
 *
 * Four events: a suggestion is offered, and then accepted, adjusted, or
 * declined. Core owns all four, and they are the only part of a check core
 * understands.
 *
 * A declined suggestion is recorded. Without it, a campaign where every
 * suggestion was taken and one where none were ever offered look identical, and
 * there would be no way to check whether the application decides anything.
 *
 * Core stores what a suggestion proposes and never reads it. The proposal
 * belongs to whichever module made it.
 *
 * See `design/checks-and-moves.md`.
 */

import type { CheckOption, ProposalField } from './check.js';
import type { EventEnvelope } from './event.js';
import type { EventId, SystemId } from './identifiers.js';
import type { Projection } from './projection.js';
import type { EventTypeDefinition, Translation } from './schema.js';

export const SUGGESTION_OFFERED = 'core.suggestion.offered';
export const SUGGESTION_ACCEPTED = 'core.suggestion.accepted';
export const SUGGESTION_ADJUSTED = 'core.suggestion.adjusted';
export const SUGGESTION_DECLINED = 'core.suggestion.declined';

/**
 * Version 1 of an offer.
 *
 * Superseded by version 2, which records `systemId` and `fields`. Kept because
 * the log is never rewritten and this is still what an old event says.
 */
export interface SuggestionOfferedV1 {
  /** The module's own identifier for this suggestion. */
  readonly suggestion: string;
  readonly label: string;
  readonly why?: string;
  readonly proposes: { readonly type: string; readonly payload: unknown };
}

/**
 * What accepting an offer would write.
 *
 * A narrow shape rather than a whole draft. A draft can also carry causation
 * and supersession, and those belong to whatever writes the event, not to the
 * module that proposed it.
 *
 * `systemId` is present exactly when the proposal is a module event, because
 * that is when writing it needs one. Core still never reads `payload`.
 */
export interface OfferedProposal {
  readonly type: string;
  readonly systemId?: SystemId;
  readonly payload: unknown;
}

/**
 * Version 2 of an offer.
 *
 * `label` is what a person was shown. `why` is the reason given, when one was
 * given: "your vehicle is built for this". Both are the module's words.
 *
 * Two things joined in version 2, both because an offer can be answered in a
 * later session than the one that made it, and at that point the log is all
 * there is.
 *
 * `fields` says which parts of the proposal a person may change. The contract
 * requires every proposal to describe all of its fields precisely so that
 * nobody pressing adjust is guessing at what is in front of them, and version 1
 * dropped that description on the way into the log.
 *
 * `proposes.systemId` says which module the proposal belongs to. Without it, an
 * offer read back on its own cannot be turned into an event at all, because a
 * module event is required to name its system.
 *
 * The alternative to both was working them out again by asking the module, and
 * that would make an old offer depend on the module still declaring the same
 * check the same way. Recording an answer once, rather than asking again later,
 * is why `CheckOutcome` is written into the log.
 */
export interface SuggestionOfferedV2 {
  /** The module's own identifier for this suggestion. */
  readonly suggestion: string;
  readonly label: string;
  readonly why?: string;
  readonly proposes: OfferedProposal;
  /** Every part of the proposal a person may change. Empty when none may be. */
  readonly fields: readonly ProposalField[];
}

/**
 * Version 1 of an acceptance.
 *
 * Carries nothing. Which offer it answers is the event's own `causationId`, and
 * a second copy of that here would be two records of one fact.
 */
export type SuggestionAcceptedV1 = Record<string, never>;

/**
 * Version 1 of an adjustment.
 *
 * Carries what the player used instead, field by field. The offer still holds
 * what was proposed, so the pair says both.
 */
export interface SuggestionAdjustedV1 {
  readonly used: Readonly<Record<string, unknown>>;
}

/**
 * Version 1 of a decline.
 *
 * Carries nothing beyond the fact that it happened, which is the whole reason
 * it exists. A reason could be added later; nobody has asked for one.
 */
export type SuggestionDeclinedV1 = Record<string, never>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Version 1 offers recorded neither which parts of a proposal could be changed
 * nor which module it belonged to, and neither can be recovered from what was
 * written down.
 *
 * `fields` becomes empty, which says truthfully that nothing about this
 * proposal is known to be adjustable rather than pretending it is all fixed.
 *
 * `systemId` stays absent. An offer written at version 1 proposing a module
 * event can be read and shown, and cannot be accepted, because writing a module
 * event requires naming its system. Nothing has ever written one: a check was
 * not reachable from the window until after version 2 existed.
 *
 * It could have been guessed at instead, by reading it back out of the type,
 * which is namespaced `sys.<systemId>.*` by the module contract. That is a
 * naming convention no code enforces, and a guess in a translation is permanent
 * and applies to every campaign forever.
 */
const offerVersion1To2: Translation = {
  type: SUGGESTION_OFFERED,
  fromVersion: 1,
  translate: (payload) => (isRecord(payload) ? { ...payload, fields: [] } : payload),
};

export const suggestionEventTypes: readonly EventTypeDefinition[] = [
  {
    type: SUGGESTION_OFFERED,
    currentVersion: 2,
    translations: [offerVersion1To2],
    corrections: 'replaces-a-value',
  },
  {
    type: SUGGESTION_ACCEPTED,
    currentVersion: 1,
    translations: [],
    // What a person did is not a value that can be replaced. Changing your mind
    // later is a further event, not a rewriting of the moment you decided.
    corrections: 'records-a-change',
  },
  {
    type: SUGGESTION_ADJUSTED,
    currentVersion: 1,
    translations: [],
    corrections: 'records-a-change',
  },
  {
    type: SUGGESTION_DECLINED,
    currentVersion: 1,
    translations: [],
    corrections: 'records-a-change',
  },
];

/** The values a choice offers, or nothing when the shape is not a list of them. */
function readOptions(value: unknown): readonly CheckOption[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const options: CheckOption[] = [];
  for (const each of value) {
    if (!isRecord(each)) return undefined;

    const id = each['id'];
    const label = each['label'];
    const optionValue = each['value'];
    if (typeof id !== 'string' || typeof label !== 'string') return undefined;
    if (typeof optionValue !== 'number') return undefined;

    options.push({ id, label, value: optionValue });
  }

  return options;
}

const FIELD_KINDS: readonly ProposalField['kind'][] = ['number', 'choice', 'text'];

function isFieldKind(value: unknown): value is ProposalField['kind'] {
  return FIELD_KINDS.some((kind) => kind === value);
}

/**
 * What a person may change about a proposal, or nothing when the shape is not
 * a list of those.
 *
 * A field that does not read is not skipped. One unreadable field means the
 * offer is not the shape it claims, and showing the rest would present a
 * partial set of controls as if it were the whole set.
 */
function readFields(value: unknown): readonly ProposalField[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const fields: ProposalField[] = [];
  for (const each of value) {
    if (!isRecord(each)) return undefined;

    const id = each['id'];
    const label = each['label'];
    const kind = each['kind'];
    if (typeof id !== 'string' || typeof label !== 'string') return undefined;
    if (!isFieldKind(kind)) return undefined;

    if (each['options'] === undefined) {
      fields.push({ id, label, kind });
      continue;
    }

    const options = readOptions(each['options']);
    if (options === undefined) return undefined;
    fields.push({ id, label, kind, options });
  }

  return fields;
}

/** Read an offer off an event payload, or say the shape is not one. */
export function readOffer(payload: unknown): SuggestionOfferedV2 | undefined {
  if (!isRecord(payload)) return undefined;

  const suggestion = payload['suggestion'];
  const label = payload['label'];
  if (typeof suggestion !== 'string' || typeof label !== 'string') return undefined;

  const proposes = payload['proposes'];
  if (!isRecord(proposes) || typeof proposes['type'] !== 'string') return undefined;

  const systemId = proposes['systemId'];
  if (systemId !== undefined && typeof systemId !== 'string') return undefined;

  const why = payload['why'];
  if (why !== undefined && typeof why !== 'string') return undefined;

  const fields = readFields(payload['fields']);
  if (fields === undefined) return undefined;

  const proposal: OfferedProposal =
    systemId === undefined
      ? { type: proposes['type'], payload: proposes['payload'] }
      : { type: proposes['type'], systemId, payload: proposes['payload'] };

  const offer: SuggestionOfferedV2 = { suggestion, label, proposes: proposal, fields };

  return why === undefined ? offer : { ...offer, why };
}

/** Read an adjustment off an event payload, or say the shape is not one. */
export function readAdjustment(payload: unknown): SuggestionAdjustedV1 | undefined {
  if (!isRecord(payload)) return undefined;

  const used = payload['used'];
  if (!isRecord(used)) return undefined;

  return { used };
}

/** What became of a suggestion. */
export type SuggestionFate = 'offered' | 'accepted' | 'adjusted' | 'declined';

/** One suggestion, and what happened to it. */
export interface SuggestionRecord {
  /** The event that offered it. */
  readonly id: EventId;
  readonly suggestion: string;
  readonly label: string;
  readonly why?: string;
  readonly proposes: OfferedProposal;
  /** What a person may still change about it. Empty when nothing may be. */
  readonly fields: readonly ProposalField[];
  /**
   * `offered` means nobody has answered yet, which is a real state rather than
   * a missing one: a suggestion can sit on screen unanswered for as long as a
   * person likes.
   */
  readonly fate: SuggestionFate;
  /** Present when the fate is `adjusted`. */
  readonly used?: Readonly<Record<string, unknown>>;
}

/** Every suggestion in the campaign, and what became of each. */
export interface Suggestions {
  /** In the order they were offered. */
  readonly offers: readonly SuggestionRecord[];
  /**
   * Which offer each answer belongs to.
   *
   * A plain object rather than a Map, so the state stays something that can be
   * written out unchanged when snapshots arrive.
   */
  readonly answerTo: Readonly<Record<EventId, EventId>>;
}

const ANSWERS: Readonly<Record<string, SuggestionFate>> = {
  [SUGGESTION_ACCEPTED]: 'accepted',
  [SUGGESTION_ADJUSTED]: 'adjusted',
  [SUGGESTION_DECLINED]: 'declined',
};

/**
 * What was proposed, and what happened to it.
 *
 * A declined suggestion stays here. So does one nobody has answered yet, which
 * is a real state rather than a missing one: a suggestion can sit unanswered
 * for as long as a person likes.
 *
 * An answer is matched to its offer through the event's own causation. An
 * answer that points at nothing this campaign has seen is left alone rather
 * than guessed about.
 */
export const suggestions: Projection<Suggestions> = {
  id: 'core.suggestions',

  initial: () => ({ offers: [], answerTo: {} }),

  apply: (state, event: EventEnvelope): Suggestions => {
    if (event.type === SUGGESTION_OFFERED) {
      const offer = readOffer(event.payload);
      if (offer === undefined) return state;

      const record: SuggestionRecord = {
        id: event.id,
        suggestion: offer.suggestion,
        label: offer.label,
        proposes: offer.proposes,
        fields: offer.fields,
        fate: 'offered',
        ...(offer.why === undefined ? {} : { why: offer.why }),
      };

      return { offers: [...state.offers, record], answerTo: state.answerTo };
    }

    const fate = ANSWERS[event.type];
    if (fate === undefined) return state;

    const answers = event.causationId;
    if (answers === undefined) return state;
    if (!state.offers.some((offer) => offer.id === answers)) return state;

    const used = fate === 'adjusted' ? readAdjustment(event.payload)?.used : undefined;

    return {
      offers: state.offers.map((offer) =>
        offer.id === answers ? { ...offer, fate, ...(used === undefined ? {} : { used }) } : offer,
      ),
      answerTo: { ...state.answerTo, [event.id]: answers },
    };
  },
};
