import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { duration } from './motion.js';
import { slot } from './theme.js';
import { tokens } from './tokens.js';

/**
 * What kind of answer a chip is.
 *
 * `leading` is the one worth noticing: the response with the most behind it.
 * `ordinary` is everything else that does something. `declining` is refusing
 * the lot, and there is at most one of those in a row.
 *
 * Named for what each one means rather than how it is drawn. A weight called
 * `dashed` would tie the vocabulary to a border style, and the reason the last
 * chip looks different is not that it has a dashed border. It is that the
 * application is saying out loud that ignoring all of this is a legitimate
 * answer, and the border is how it says it.
 */
export type ChipWeight = 'leading' | 'ordinary' | 'declining';

export interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  readonly weight?: ChipWeight;
  /**
   * The key that takes it, as a person reads it: `esc`, `P`, `⌥⏎`.
   *
   * Shown, and hidden from anything reading the page aloud, because a chip
   * announced as "pay the price P" is worse than one announced as "pay the
   * price". Set `aria-keyshortcuts` alongside it to say the same thing in the
   * form a screen reader expects.
   *
   * Displaying the key is all this does. What listens for it belongs to the
   * surface the chips are on, which is the only thing that knows what else is
   * on screen and what has focus.
   */
  readonly hint?: string;
  readonly children: ReactNode;
}

/**
 * One answer a person can give, as a pill.
 *
 * Small, mono, and sized so a row of them reads as a row of choices rather than
 * a row of buttons. It names no colour and no size of its own, so a theme
 * reaches it without it knowing a theme exists.
 */
export function Chip({
  weight = 'ordinary',
  hint,
  type = 'button',
  style,
  children,
  ...rest
}: ChipProps): ReactNode {
  const shared = {
    display: 'inline-flex',
    alignItems: 'baseline',
    gap: tokens.space.sm,
    padding: '5px 10px',
    borderRadius: tokens.radius.pill,
    background: 'none',
    fontFamily: 'var(--font-numeric)',
    fontSize: '12px',
    cursor: 'pointer',
    transitionProperty: 'background-color, border-color, color',
    transitionDuration: duration('enter'),
    transitionTimingFunction: 'var(--easing)',
  } as const;

  const look = {
    leading: {
      border: `1px solid ${slot('accent', 'accent')}`,
      color: slot('accent', 'accent'),
    },
    ordinary: {
      border: `1px solid ${slot('ink', 'hairline')}`,
      color: slot('ink', 'secondary'),
    },
    // Dashed, and it is the only chip in the row that is. A person should be
    // able to find the way out without reading anything.
    declining: {
      border: `1px dashed ${slot('ink', 'hairline')}`,
      color: slot('ink', 'muted'),
    },
  }[weight];

  // The caller's style is merged last rather than spread with the rest of the
  // props. Spreading it would replace everything above wholesale, so a caller
  // nudging one thing would silently lose the chip's whole appearance.
  return (
    <button type={type} style={{ ...shared, ...look, ...style }} {...rest}>
      {children}
      {hint !== undefined && (
        <span aria-hidden="true" style={{ color: slot('ink', 'muted') }}>
          {hint}
        </span>
      )}
    </button>
  );
}
