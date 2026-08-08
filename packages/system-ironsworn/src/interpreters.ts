import {
  readRoll,
  type CheckOutcome,
  type EffectSuggestion,
  type OutcomeStyle,
  type RollPerformedV1,
} from '@aether-forge/core';

/**
 * The three interpreters: what the dice meant, for every move of a kind.
 *
 * A move arrives as content (its name, its text, which stats it offers) and
 * is joined to one of these, because what a strong hit is belongs to the
 * module and never to the content. Three interpreters cover the whole move
 * list; if that number starts growing toward the number of moves, the
 * moves-as-content split was wrong and the contract's warning about
 * exhaustive executable rules is being re-learned.
 *
 * What an outcome proposes is a per-move question this module mostly cannot
 * answer without inventing rules, so proposals are a hook: a hand-tuned move
 * passes its own, and a content-built move passes none, which is honest. The
 * application computes and suggests; it never pretends to know a rule it was
 * not taught.
 */

/** How an outcome proposes effects, per move. Nothing, for a move nobody tuned. */
export type SuggestsFor = (outcomeId: string) => readonly EffectSuggestion[];

const NOTHING: SuggestsFor = () => [];

export const ACTION_ROLL_OUTCOMES: readonly OutcomeStyle[] = [
  { id: 'strong-hit', label: 'Strong hit', tone: 'strong', glyph: '◆' },
  { id: 'weak-hit', label: 'Weak hit', tone: 'weak', glyph: '◇' },
  { id: 'miss', label: 'Miss', tone: 'miss', glyph: '△' },
  { id: 'unreadable', label: 'Unreadable', tone: 'miss', glyph: '?' },
];

export const PROGRESS_ROLL_OUTCOMES: readonly OutcomeStyle[] = ACTION_ROLL_OUTCOMES;

export const NO_ROLL_OUTCOMES: readonly OutcomeStyle[] = [
  { id: 'resolved', label: 'As written', tone: 'match', glyph: '○' },
];

function labelled(styles: readonly OutcomeStyle[], id: string): string {
  return styles.find((style) => style.id === id)?.label ?? id;
}

function hitsAndMisses(
  total: number,
  challenge: readonly { readonly value: number }[],
  suggests: SuggestsFor,
): CheckOutcome {
  const beaten = challenge.filter((die) => total > die.value).length;

  if (beaten === 2) {
    return {
      id: 'strong-hit',
      label: labelled(ACTION_ROLL_OUTCOMES, 'strong-hit'),
      summary: 'You do it, and you are in control.',
      suggests: [...suggests('strong-hit')],
    };
  }

  if (beaten === 1) {
    return {
      id: 'weak-hit',
      label: labelled(ACTION_ROLL_OUTCOMES, 'weak-hit'),
      summary: 'You do it, but at a cost.',
      suggests: [...suggests('weak-hit')],
    };
  }

  return {
    id: 'miss',
    label: labelled(ACTION_ROLL_OUTCOMES, 'miss'),
    summary: 'It goes badly.',
    suggests: [...suggests('miss')],
  };
}

function unreadable(what: string): CheckOutcome {
  return {
    id: 'unreadable',
    label: labelled(ACTION_ROLL_OUTCOMES, 'unreadable'),
    summary: `That roll was not ${what}.`,
    suggests: [],
  };
}

/**
 * The action roll: one d6 plus stat and adds, against two d10.
 *
 * Pure over the roll and the inputs as actually used, because the answer is
 * recorded and a check run twice from the same log has to agree with itself.
 */
export function interpretActionRoll(
  roll: RollPerformedV1 | null,
  inputs: Readonly<Record<string, number>>,
  suggests: SuggestsFor = NOTHING,
): CheckOutcome {
  const read = roll === null ? undefined : readRoll(roll);
  const action = read?.dice[0];
  const challenge = read?.dice.slice(1) ?? [];

  if (action === undefined || challenge.length !== 2) return unreadable('an action roll');

  const total = action.value + (inputs['stat'] ?? 0) + (inputs['bonus'] ?? 0);
  return hitsAndMisses(total, challenge, suggests);
}

/**
 * The progress roll: a score already earned, against two d10. No action die
 * and no adds; the score comes from the track, typed in until sheets read it.
 */
export function interpretProgressRoll(
  roll: RollPerformedV1 | null,
  inputs: Readonly<Record<string, number>>,
  suggests: SuggestsFor = NOTHING,
): CheckOutcome {
  const read = roll === null ? undefined : readRoll(roll);
  const challenge = read?.dice ?? [];

  if (challenge.length !== 2) return unreadable('a progress roll');

  return hitsAndMisses(inputs['progress'] ?? 0, challenge, suggests);
}

/** A move with no dice: it happens as the move says, and the log records that it did. */
export function interpretNoRoll(): CheckOutcome {
  return {
    id: 'resolved',
    label: labelled(NO_ROLL_OUTCOMES, 'resolved'),
    summary: 'It happens as the move says.',
    suggests: [],
  };
}
