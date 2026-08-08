import type { ReactNode } from 'react';

import { slot } from './theme.js';

/**
 * Which key does the thing beside it.
 *
 * Shown, and hidden from anything reading the page aloud. A screen reader
 * already announces the shortcut from the control's own
 * `aria-keyshortcuts`, and hearing it twice is worse than hearing it once.
 * That is why this is a component rather than a string: the hiding is easy
 * to forget and impossible to see.
 */
export interface KeyHintProps {
  /** The key as a person would recognise it: an arrow, a word, a symbol. */
  readonly children: ReactNode;
}

export function KeyHint({ children }: KeyHintProps): ReactNode {
  return (
    <span aria-hidden="true" style={{ color: slot('ink', 'muted') }}>
      {children}
    </span>
  );
}
