import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { slot } from './theme.js';
import { duration } from './motion.js';
import { tokens } from './tokens.js';

/**
 * How much weight a button carries.
 *
 * `primary` is the thing the surface is for: recording what you wrote, keeping
 * a correction. `quiet` is everything else, and is deliberately not a smaller
 * primary. Backing out of something should look like a different kind of act
 * rather than a lesser version of going ahead with it.
 */
export type ButtonWeight = 'primary' | 'quiet';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  readonly weight?: ButtonWeight;
  readonly children: ReactNode;
}

/**
 * The first component, and it exists because the journal already needed one
 * three times over rather than to prove a point about components.
 *
 * It names no colour and no size of its own. Everything it draws with is a
 * property the application has already set, so a theme reaches it without it
 * knowing a theme exists.
 */
export function Button({
  weight = 'primary',
  type = 'button',
  style,
  ...rest
}: ButtonProps): ReactNode {
  const shared = {
    borderRadius: tokens.radius.md,
    padding: `${tokens.space.sm} ${tokens.space.md}`,
    fontFamily: 'var(--font-ui)',
    fontSize: tokens.fontSize.sm,
    cursor: 'pointer',
    transitionProperty: 'background-color, border-color, color',
    transitionDuration: duration('enter'),
    transitionTimingFunction: 'var(--easing)',
  } as const;

  const look =
    weight === 'primary'
      ? {
          background: slot('accent', 'accent'),
          color: slot('ground', 'void'),
          border: 'none',
          fontWeight: 600,
        }
      : {
          background: 'none',
          color: slot('ink', 'muted'),
          border: `1px solid ${slot('ink', 'hairline')}`,
          fontWeight: 400,
        };

  // The caller's style is merged last rather than spread with the rest of the
  // props. Spreading it would replace everything above wholesale, so a caller
  // nudging one thing would silently lose the button's whole appearance.
  return <button type={type} style={{ ...shared, ...look, ...style }} {...rest} />;
}
