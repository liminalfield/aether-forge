/**
 * What a key pressed inside a check card should do.
 *
 * The rule is that the focused control wins. A chip is a real button, so Enter
 * on a focused chip activates that chip natively and the card must not answer
 * over it. The adjust field claims Enter for its own value, and claims Escape
 * while it holds a draft; it stops those events itself. Only a key nothing
 * else has claimed is answered at the card level: Enter takes the leading
 * chip, Escape is the way out.
 *
 * These are decisions, not handlers, so they can be tested as the table of
 * cases they are. The component maps events in and actions out.
 */

/** Which control the key event came from, as the card wrapper sees it. */
export type FocusedControl = 'card' | 'chip' | 'field';

export type CardKeyIntent = 'accept' | 'decline' | 'none';

/**
 * The card-level answer to a key that bubbled up uncontested.
 *
 * Escape declines wherever it lands, because no control in the card uses
 * Escape for anything else; the adjust field stops it first on the one
 * occasion it does (clearing a draft). Enter accepts only when the card
 * itself is focused: on a chip it is that chip's click, and from the field it
 * never arrives, but the condition holds either way rather than trusting
 * every child to stop what it consumes.
 *
 * A modified Enter is nobody's accept. The adjust chip advertises one, and
 * answering "take it" to a person reaching for "use that instead" is the
 * exact mistake this module exists to prevent.
 */
export function cardKeyIntent(
  key: string,
  withModifier: boolean,
  focused: FocusedControl,
): CardKeyIntent {
  if (key === 'Escape') return 'decline';
  if (key === 'Enter' && !withModifier && focused === 'card') return 'accept';
  return 'none';
}

export type FieldKeyIntent = 'use' | 'clear' | 'none';

/**
 * The adjust field's own answer to a key, given what has been typed so far.
 *
 * Enter uses the draft when it is a number, and does nothing at all when it
 * is not; the field consumes Enter either way, so a mistyped value can never
 * fall through and take the offer unchanged. Escape clears a draft rather
 * than declining over it, so what was typed costs one keypress to abandon and
 * the way out is still one more Escape away.
 */
export function adjustKeyIntent(key: string, draft: string): FieldKeyIntent {
  if (key === 'Enter') return isAdjustableDraft(draft) ? 'use' : 'none';
  if (key === 'Escape' && draft !== '') return 'clear';
  return 'none';
}

/** A draft the adjust controls will act on: some text that reads as a number. */
export function isAdjustableDraft(draft: string): boolean {
  return draft.trim() !== '' && !Number.isNaN(Number(draft));
}
