import type { HTMLAttributes, ReactNode } from 'react';

import { slot } from './theme.js';
import { tokens } from './tokens.js';

/**
 * The small capitalised label that sits beside things.
 *
 * Above a field, at the head of a rail group, along a provenance strip. It
 * was written out by hand in six files before it was a component, which is
 * how the six had already begun to disagree with each other about size.
 *
 * Two sizes, because the design uses two. `field` is the smallest, for a
 * label above something a person types into. `line` is a shade larger, for a
 * line of text that is itself the information.
 */

export type LabelSize = 'field' | 'line';

export interface LabelProps extends Omit<HTMLAttributes<HTMLElement>, 'className'> {
  readonly size?: LabelSize;
  /**
   * What to render as. A label above a field should be a `label` element and
   * carry `htmlFor`; a heading in a rail should be a heading. Defaults to a
   * span, which is right for a label that names nothing in particular.
   */
  readonly as?: 'span' | 'label' | 'h2' | 'p';
  /** Set the label's own colour, for the rare line that is not muted. */
  readonly tone?: 'muted' | 'primary';
  /** Which field this labels, when it is a label. */
  readonly htmlFor?: string;
  readonly children: ReactNode;
}

/** The style alone, for the places that spread it into a larger object. */
export function labelStyle(size: LabelSize = 'field', tone: 'muted' | 'primary' = 'muted') {
  return {
    fontFamily: 'var(--font-numeric)',
    fontSize: size === 'field' ? tokens.type.micro : tokens.type.tiny,
    letterSpacing: size === 'field' ? tokens.tracking.capsWide : tokens.tracking.caps,
    textTransform: 'uppercase',
    color: tone === 'muted' ? slot('ink', 'muted') : slot('ink', 'primary'),
  } as const;
}

export function Label({
  size = 'field',
  as = 'span',
  tone = 'muted',
  style,
  children,
  ...rest
}: LabelProps): ReactNode {
  const Element = as;

  // The caller's style is merged last, so a caller can position a label
  // without having to restate what a label looks like.
  return (
    <Element style={{ margin: 0, ...labelStyle(size, tone), ...style }} {...rest}>
      {children}
    </Element>
  );
}
