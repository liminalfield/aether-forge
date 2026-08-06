import type { ReactNode, TextareaHTMLAttributes } from 'react';

import { slot } from './theme.js';
import { tokens } from './tokens.js';

export interface WritingSurfaceProps extends Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  'className'
> {
  readonly label: string;
  /** Hidden when the surface sits where its purpose is already obvious. */
  readonly showLabel?: boolean;
}

/**
 * Somewhere to write prose.
 *
 * Set in the reading typeface rather than the interface one, because what is
 * typed here is the same text that will be read back afterwards, and a person
 * should be looking at the shapes they are going to live with rather than at a
 * form field that happens to contain them.
 *
 * It grows with what is in it rather than scrolling inside a fixed box. A
 * writing surface that hides the beginning of a paragraph while its end is
 * being typed is a worse place to think.
 */
export function WritingSurface({
  label,
  showLabel = true,
  id,
  rows = 3,
  ...rest
}: WritingSurfaceProps): ReactNode {
  return (
    <div style={{ display: 'grid', gap: tokens.space.sm }}>
      <label
        htmlFor={id}
        style={{
          fontFamily: 'var(--font-numeric)',
          fontSize: '10.5px',
          letterSpacing: '.16em',
          textTransform: 'uppercase',
          color: slot('ink', 'muted'),
          ...(showLabel
            ? {}
            : {
                position: 'absolute',
                width: '1px',
                height: '1px',
                overflow: 'hidden',
                clip: 'rect(0 0 0 0)',
                whiteSpace: 'nowrap',
              }),
        }}
      >
        {label}
      </label>
      <textarea
        id={id}
        rows={rows}
        aria-label={showLabel ? undefined : label}
        style={{
          background: slot('ground', 'raised'),
          color: slot('ink', 'primary'),
          border: `1px solid ${slot('ink', 'hairline')}`,
          borderRadius: tokens.radius.md,
          padding: `${tokens.space.md} ${tokens.space.md}`,
          fontFamily: 'var(--font-prose)',
          fontSize: '18px',
          fontWeight: 300,
          lineHeight: 1.6,
          resize: 'vertical',
          outlineColor: slot('accent', 'accent'),
        }}
        {...rest}
      />
    </div>
  );
}
