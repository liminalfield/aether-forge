import type { HTMLAttributes, ReactNode } from 'react';

import { tokens } from './tokens.js';

/**
 * Anything the application is suggesting, drawn so it cannot be mistaken for
 * something already decided.
 *
 * This is the product's whole position, made visible. A person has to be able
 * to tell, without reading a word, what the application proposed from what
 * they chose. Everything the application offers sits in one of these, and
 * nothing that has already happened ever does.
 *
 * A dashed border in the accent colour, a faint wash of it, and a slow
 * breathing glow. The dashes are the load-bearing part: they say "not yet"
 * in a way colour alone cannot, which matters for anyone whose palette or
 * eyesight makes the accent hard to pick out.
 *
 * The glow stops when a person has asked for less movement. It stops rather
 * than arriving at once, because a pulse played instantly is a flash. The
 * border and the wash stay, so the meaning survives with the movement gone.
 *
 * See `design/themes-and-components.md`, which calls this one component and
 * not a style, and the handoff, which calls it the one principle that
 * governs everything.
 */

/** The keyframes the pulse needs, injected once by the application. */
export const GHOST_KEYFRAMES = `
@keyframes ghost-pulse {
  0%, 100% { box-shadow: 0 0 0 0 var(--ghost-wash); }
  50% { box-shadow: 0 0 0 4px var(--ghost-wash); }
}
`;

export interface GhostBlockProps extends Omit<HTMLAttributes<HTMLDivElement>, 'className'> {
  readonly children: ReactNode;
}

export function GhostBlock({ style, children, ...rest }: GhostBlockProps): ReactNode {
  return (
    <div
      style={{
        border: `${tokens.border.hair} dashed var(--ghost-border)`,
        borderRadius: tokens.radius.md,
        background: 'var(--ghost-wash)',
        padding: tokens.space[12],
        animation: 'var(--pulse-ghost)',
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
