import type { HTMLAttributes, ReactNode } from 'react';

import { tokens } from './tokens.js';

export interface ChipRowProps extends Omit<HTMLAttributes<HTMLDivElement>, 'className'> {
  /** What this set of answers is for, for anything reading the page aloud. */
  readonly label: string;
  readonly children: ReactNode;
}

/**
 * A row of answers, laid out and grouped.
 *
 * It does not decide the order. Chips are ordered by consequence, and only the
 * thing that knows what they mean can say what that order is: a component
 * sorting them would be deciding which of a person's options matters most.
 *
 * Nor does it place the declining chip. That chip is last by convention, and
 * making the row enforce it would mean the row knowing which chip is which,
 * which is the same mistake one level up.
 *
 * It wraps rather than scrolling. A row of choices that runs off the edge hides
 * an answer somebody has, and there is never a useful number of them to scroll.
 */
export function ChipRow({ label, style, children, ...rest }: ChipRowProps): ReactNode {
  return (
    <div
      role="group"
      aria-label={label}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: tokens.space.sm,
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
