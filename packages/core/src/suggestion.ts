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

import type { EventId } from './identifiers.js';
import type { EventTypeDefinition } from './schema.js';

export const SUGGESTION_OFFERED = 'core.suggestion.offered';
export const SUGGESTION_ACCEPTED = 'core.suggestion.accepted';
export const SUGGESTION_ADJUSTED = 'core.suggestion.adjusted';
export const SUGGESTION_DECLINED = 'core.suggestion.declined';

/**
 * Version 1 of an offer.
 *
 * `label` is what a person was shown. `why` is the reason given, when one was
 * given: "your vehicle is built for this". Both are the module's words.
 *
 * `proposes` is the draft that accepting would write, exactly as the module
 * supplied it. Core keeps it and never looks inside.
 */
export interface SuggestionOfferedV1 {
  /** The module's own identifier for this suggestion. */
  readonly suggestion: string;
  readonly label: string;
  readonly why?: string;
  readonly proposes: { readonly type: string; readonly payload: unknown };
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

export const suggestionEventTypes: readonly EventTypeDefinition[] = [
  {
    type: SUGGESTION_OFFERED,
    currentVersion: 1,
    translations: [],
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Read an offer off an event payload, or say the shape is not one. */
export function readOffer(payload: unknown): SuggestionOfferedV1 | undefined {
  if (!isRecord(payload)) return undefined;

  const suggestion = payload['suggestion'];
  const label = payload['label'];
  if (typeof suggestion !== 'string' || typeof label !== 'string') return undefined;

  const proposes = payload['proposes'];
  if (!isRecord(proposes) || typeof proposes['type'] !== 'string') return undefined;

  const why = payload['why'];
  if (why !== undefined && typeof why !== 'string') return undefined;

  const offer: SuggestionOfferedV1 = {
    suggestion,
    label,
    proposes: { type: proposes['type'], payload: proposes['payload'] },
  };

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
  readonly proposes: { readonly type: string; readonly payload: unknown };
  /**
   * `offered` means nobody has answered yet, which is a real state rather than
   * a missing one: a suggestion can sit on screen unanswered for as long as a
   * person likes.
   */
  readonly fate: SuggestionFate;
  /** Present when the fate is `adjusted`. */
  readonly used?: Readonly<Record<string, unknown>>;
}
