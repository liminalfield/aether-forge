/**
 * What a check is, and what a module has to supply to declare one.
 *
 * A check is the structure behind what a rulebook calls a move: you decide how
 * you are going about something, you roll, and what you rolled means something.
 *
 * Core holds these shapes and never fills them in. It does not know what a stat
 * is, what a hit is, or which of them is better. A module says all of that, and
 * core carries the answer without reading it.
 *
 * Nothing here can refuse anything. A check says what inputs it takes and what
 * a result means, and neither of those is somewhere a module could put the word
 * "illegal".
 *
 * See `design/checks-and-moves.md`.
 */

import type { ProjectionContext } from './module-projection.js';
import type { UnversionedEventDraft } from './translating-log.js';
import type { RollPerformedV1, RollRequest } from './roll.js';

/** One of the values an input offers, when it offers a fixed set. */
export interface CheckOption {
  readonly id: string;
  readonly label: string;
  readonly value: number;
}

/**
 * Where an input's starting value comes from.
 *
 * `chosen` means the player picks it. `read` means it was taken from the
 * campaign: the number of boxes filled on a track, a value from a sheet.
 *
 * Both are still editable. The difference is only where the first value came
 * from, and it exists so that a resolved check can record what it was reading
 * without needing a second mechanism for it.
 */
export type InputSource = 'chosen' | 'read';

export interface CheckInput {
  readonly id: string;
  readonly label: string;
  readonly kind: 'choice' | 'number';
  readonly source: InputSource;
  /** Present when `kind` is `choice`. */
  readonly options?: readonly CheckOption[];

  /**
   * What the application would put here, and why.
   *
   * A suggestion, in the ordinary sense of the word: it is shown, it can be
   * taken, and it can be ignored. Whether it was taken is recorded, which is
   * what makes "the application decides nothing" checkable rather than merely
   * claimed.
   */
  readonly suggest?: (context: ProjectionContext) => { value: number; why: string } | undefined;
}

/**
 * A part of a proposal a person can change before accepting it.
 *
 * `id` names a key in the payload of what the suggestion proposes.
 *
 * Every proposal describes all of its fields, and the contract requires this
 * rather than allowing it. If describing them were optional, some suggestions
 * could be adjusted and some could not, and a player pressing adjust would be
 * guessing at which kind was in front of them.
 */
export interface ProposalField {
  readonly id: string;
  readonly label: string;
  readonly kind: 'number' | 'choice' | 'text';
  readonly options?: readonly CheckOption[];
}

/**
 * Something a module proposes doing about an outcome.
 *
 * It proposes one thing. Two effects are two suggestions, so that a player can
 * take one and refuse the other. A suggestion carrying several events would
 * have to be accepted or refused whole.
 *
 * `proposes` is a draft rather than a recorded event. Core assigns the
 * identifier, the position, the timestamp and the schema version when it
 * writes. A module filling those in would leave core with two bad choices:
 * ignore them, which makes the fields pointless, or trust them, which lets a
 * module hand out positions in a log it cannot see.
 */
export interface EffectSuggestion {
  readonly id: string;
  /** What to show a person. Something like "spend one from the resource". */
  readonly label: string;
  /** Every part of the proposal that can be changed. May be empty; may not be absent. */
  readonly fields: readonly ProposalField[];
  /** What accepting appends, with each field at its proposed value. */
  readonly proposes: UnversionedEventDraft;
}

/**
 * What a module says a roll meant.
 *
 * `id` is the module's own word, and core has no opinion about it. `strong-hit`
 * means nothing here.
 *
 * This is worked out once, when the check resolves, and written into the
 * module's own event. It is never worked out again while reading. Asking a
 * module what the dice meant every time the log is read would mean that
 * updating the module changes campaigns finished years ago, and a player who
 * has not opened their game since last winter would find a hit had become a
 * miss.
 */
export interface CheckOutcome {
  readonly id: string;
  readonly label: string;
  readonly summary: string;
  /** What the module proposes doing about it. Never applied on its own. */
  readonly suggests: readonly EffectSuggestion[];
}

/**
 * A check, as a module declares it.
 *
 * `roll` may be absent, for a procedure that has no dice. A system that rolls
 * rarely uses the same machinery, and so does something like taking stock of
 * where you are.
 */
export interface CheckDefinition {
  readonly id: string;
  readonly name: string;
  /** Where the full text lives, for a reference browser to link to. */
  readonly docRef?: string;
  readonly roll: RollRequest | null;
  readonly inputs: readonly CheckInput[];

  /**
   * What the dice meant.
   *
   * Handed the roll and the inputs as they were actually used, including any
   * the player changed. Pure: the same roll and the same inputs always give the
   * same outcome, because the answer is recorded and a check run twice from the
   * same log has to agree with itself.
   *
   * `roll` is null for a check that has none.
   */
  interpret(roll: RollPerformedV1 | null, inputs: Readonly<Record<string, number>>): CheckOutcome;
}

/**
 * Whether a proposal describes every field its payload carries.
 *
 * The contract requires the description, and a module that forgets one would
 * ship a suggestion that is adjustable in some parts and not others. This is
 * how a module's own tests catch that before anybody plays with it.
 */
export function describesEveryField(suggestion: EffectSuggestion): boolean {
  const payload = suggestion.proposes.payload;
  if (typeof payload !== 'object' || payload === null) return true;

  const described = new Set(suggestion.fields.map((field) => field.id));
  return Object.keys(payload).every((key) => described.has(key));
}
